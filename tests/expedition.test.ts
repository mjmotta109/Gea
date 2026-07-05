import { describe, expect, it } from 'vitest';
import {
  assignTarget, availableEdges, distancesFrom, edgeKey, startExpedition, travel,
} from '../src/game/expedition.js';
import {
  buyBlueprint, buySupplies, cityRepair, consumeSupplies, newCampaign, sellCargo, stashCargo,
} from '../src/game/mercenary.js';
import { canExplore, exploreSite } from '../src/game/expedition.js';
import { adjustStress, newPilot, observeBattle, pilotModifiers } from '../src/core/progression.js';
import { CITY_TIERS } from '../src/data/economy.js';
import { PERKS } from '../src/data/progression.js';
import { ECONOMY } from '../src/data/economy.js';
import { SALT_PASS_REGION } from '../src/data/world.js';
import { ZOIDS } from '../src/data/zoids.js';

const factoryLoadout = (unitTypeId: string) => ({
  weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])],
  slots: {},
});

describe('capa de viaje: la región y las expediciones', () => {
  it('las distancias desde el taller son coherentes con los tramos', () => {
    const dist = distancesFrom(SALT_PASS_REGION, SALT_PASS_REGION.hq);
    expect(dist['base-arcadia']).toBe(0);
    expect(dist['cruce-del-rio']).toBe(1);
    expect(dist['paso-de-sal']).toBe(2);
    expect(dist['nido-del-grande']).toBe(4); // lo más profundo
    // Todos los nodos son alcanzables.
    for (const node of SALT_PASS_REGION.nodes) expect(dist[node.id]).toBeDefined();
  });

  it('el objetivo del contrato escala con la dificultad y es determinista', () => {
    const dist = distancesFrom(SALT_PASS_REGION, SALT_PASS_REGION.hq);
    const escolta = assignTarget(SALT_PASS_REGION, 'c0-escolta', 'escolta');
    const caza = assignTarget(SALT_PASS_REGION, 'c0-caza', 'caza');
    expect(dist[escolta]!).toBeLessThanOrEqual(2);
    expect(dist[caza]!).toBeGreaterThanOrEqual(3);
    expect(assignTarget(SALT_PASS_REGION, 'c0-caza', 'caza')).toBe(caza); // mismo contrato, mismo lugar
  });

  it('viajar consume jornadas, registra el diario y es determinista', () => {
    const exp = startExpedition(SALT_PASS_REGION, 'c1-asalto', 'asalto');
    expect(exp.at).toBe('base-arcadia');
    const edge = availableEdges(exp, SALT_PASS_REGION)[0]!;
    const a = travel(exp, SALT_PASS_REGION, edge);
    const b = travel(exp, SALT_PASS_REGION, edge);
    expect(a).toEqual(b); // reintentar no cambia la suerte
    expect(a.expedition.day).toBeGreaterThan(exp.day);
    expect(a.expedition.log.length).toBe(exp.log.length + 1);
    expect(a.supplyCost).toBeGreaterThan(0);
  });

  it('el puente roto corta el tramo pero nunca aísla la misión', () => {
    // Buscar un contrato/tramo donde ocurra el evento del puente.
    let found = false;
    for (let i = 0; i < 40 && !found; i++) {
      const exp = startExpedition(SALT_PASS_REGION, `probe-${i}`, 'caza');
      for (const edge of availableEdges(exp, SALT_PASS_REGION)) {
        const result = travel(exp, SALT_PASS_REGION, edge);
        if (result.event === 'bridge') {
          found = true;
          // Sigue en el mismo nodo, con el tramo bloqueado y un día perdido.
          expect(result.expedition.at).toBe(exp.at);
          expect(result.expedition.blockedEdges).toContain(edgeKey(edge.a, edge.b));
          expect(result.expedition.day).toBe(exp.day + 1);
          // Queda al menos una salida.
          expect(availableEdges(result.expedition, SALT_PASS_REGION).length).toBeGreaterThan(0);
        }
      }
    }
    expect(found).toBe(true);
  });

  it('suministros y bodega: comprar, consumir con déficit y vender al volver', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    expect(state.supplies).toBe(ECONOMY.startingSupplies);
    state = buySupplies(state, 3, ECONOMY);
    expect(state.supplies).toBe(ECONOMY.startingSupplies + 3);
    expect(state.credits).toBe(ECONOMY.startingCredits - 3 * ECONOMY.supplyPrice);
    // Consumir más de lo que hay: déficit para la marcha forzada.
    const drained = consumeSupplies({ ...state, supplies: 1 }, 3);
    expect(drained.state.supplies).toBe(0);
    expect(drained.shortage).toBe(2);
    // Bodega con tope y venta.
    state = stashCargo(state, { name: 'Chatarra', value: 100 }, 2);
    state = stashCargo(state, { name: 'Núcleo', value: 200 }, 2);
    state = stashCargo(state, { name: 'No cabe', value: 999 }, 2);
    expect(state.cargo).toHaveLength(2);
    const sold = sellCargo(state);
    expect(sold.earned).toBe(300);
    expect(sold.state.cargo).toHaveLength(0);
  });
});

describe('ciudades: servicios por nivel', () => {
  it('el taller de aldea es barato pero no repara del todo', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = { ...state, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 40 } : z)) };
    const tier = CITY_TIERS[1];
    const repaired = cityRepair(state, 0, 140, tier.repairCostPerHp, tier.repairCapRatio);
    expect(repaired.roster[0]!.hp).toBe(98); // 70% de 140
    expect(repaired.credits).toBe(state.credits - Math.round(58 * tier.repairCostPerHp));
    // La capital repara a tope, más caro.
    const capital = cityRepair(state, 0, 140, CITY_TIERS[3].repairCostPerHp, CITY_TIERS[3].repairCapRatio);
    expect(capital.roster[0]!.hp).toBe(140);
  });

  it('vender la bodega a tasa de aldea paga menos; planos solo una vez', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = stashCargo(state, { name: 'Chatarra', value: 100 }, 4);
    const village = sellCargo(state, CITY_TIERS[1].cargoRate);
    expect(village.earned).toBe(80);
    state = buyBlueprint(state, 'am-heavy-claws', 450);
    expect(state.moduleBlueprints).toEqual(['am-heavy-claws']);
    const again = buyBlueprint(state, 'am-heavy-claws', 450);
    expect(again).toEqual(state); // ya lo tiene: sin cambios
  });
});

describe('estrés de pilotos', () => {
  it('el combate estresa, la victoria alivia y los tramos penalizan', () => {
    let pilot = newPilot('s', 'Sudoroso');
    const events = [
      { type: 'damage-dealt', unitId: 'E', targetUnitId: 'U', amount: 60, targetHp: 40 },
    ];
    // Derrota + castigo + aliado perdido + roce: estrés considerable.
    let result = observeBattle(pilot, {
      events: events as never, unitId: 'U', finalHpRatio: 0.15, victory: false, alliesLost: 1,
    }, PERKS);
    // castigo 60/15=4 + aliado 6 + roce 6 + derrota 4 = 20
    expect(result.pilot.stress).toBe(20);
    // La victoria alivia.
    result = observeBattle(result.pilot, {
      events: [] as never, unitId: 'U', finalHpRatio: 1, victory: true,
    }, PERKS);
    expect(result.pilot.stress).toBe(12);
    // Tramos: a 80 de estrés, "Al límite" entra al pipeline.
    pilot = adjustStress(result.pilot, 68);
    expect(pilot.stress).toBe(80);
    const mods = pilotModifiers(pilot, [], PERKS);
    expect(mods.some((m) => m.source === 'stress:al-limite' && m.stat === 'accuracy' && m.add === -4)).toBe(true);
    // Y solo el tramo más alto (no se apilan Tenso + Al límite).
    expect(mods.some((m) => m.source === 'stress:tenso')).toBe(false);
    // El descanso acota a [0, 100].
    expect(adjustStress(pilot, -500).stress).toBe(0);
  });
});

describe('ruinas: exploración', () => {
  it('explorar cuesta un día, es determinista y solo una vez por sitio', () => {
    let exp = startExpedition(SALT_PASS_REGION, 'c9-caza', 'caza');
    exp = { ...exp, at: 'ruinas-de-helio' };
    expect(canExplore(exp, SALT_PASS_REGION)).toBe(true);
    const a = exploreSite(exp, SALT_PASS_REGION);
    const b = exploreSite(exp, SALT_PASS_REGION);
    expect(a).toEqual(b); // determinista
    expect(a.expedition.day).toBe(exp.day + 1);
    expect(['find', 'dust', 'scare']).toContain(a.outcome);
    expect(canExplore(a.expedition, SALT_PASS_REGION)).toBe(false); // ya explorado
    // En un paraje no hay nada que explorar.
    expect(canExplore({ ...exp, at: 'paso-de-sal' }, SALT_PASS_REGION)).toBe(false);
  });
});
