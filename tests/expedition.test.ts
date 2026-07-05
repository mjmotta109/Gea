import { describe, expect, it } from 'vitest';
import {
  assignTarget, availableEdges, distancesFrom, edgeKey, startExpedition, travel,
} from '../src/game/expedition.js';
import {
  buyBlueprint, buySupplies, cityRepair, consumeSupplies, newCampaign, sellCargo, stashCargo,
} from '../src/game/mercenary.js';
import { canExplore, exploreSite } from '../src/game/expedition.js';
import { adjustStress, newPilot, observeBattle, pilotModifiers } from '../src/core/progression.js';
import { CITY_TIERS, CONTRACT_ENEMY_POOL } from '../src/data/economy.js';
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

describe('la compañera: marcas y compenetración', () => {
  it('las tormentas y las cazas de comandantes graban marcas deterministas', async () => {
    const { newCompanion, observeCompanionBattle, companionModifiers, bondExpedition, recordCompanionEvent } =
      await import('../src/game/companion.js');
    const { COMPANION_TABLE } = await import('../src/data/marks.js');
    let companion = newCompanion();
    // Dos batallas en tormenta → "Forjada en el desierto".
    const stormBattle = { events: [] as never[], unitId: 'P1', finalHpRatio: 1, weather: 'sandstorm' };
    companion = observeCompanionBattle(companion, stormBattle, COMPANION_TABLE).companion;
    const second = observeCompanionBattle(companion, stormBattle, COMPANION_TABLE);
    expect(second.gained.map((m) => m.id)).toEqual(['forjada-en-el-desierto']);
    companion = second.companion;
    // La caza de un comandante: baja propia seguida de enlace perdido.
    const huntEvents = [
      { type: 'damage-dealt', unitId: 'P1', targetUnitId: 'E1', amount: 50, targetHp: 0 },
      { type: 'unit-destroyed', unitId: 'E1' },
      { type: 'command-link-lost', team: 'enemy' },
    ];
    companion = observeCompanionBattle(companion, { events: huntEvents as never, unitId: 'P1', finalHpRatio: 1, weather: 'clear' }, COMPANION_TABLE).companion;
    expect(companion.memory['cazas']).toBe(1);
    // La biografía entra al pipeline del despliegue.
    const mods = companionModifiers(companion, COMPANION_TABLE);
    expect(mods.some((m) => m.source === 'mark:forjada-en-el-desierto')).toBe(true);
    // Compenetración con techo y tramo.
    for (let i = 0; i < 20; i++) companion = bondExpedition(companion, COMPANION_TABLE);
    expect(companion.rapport).toBe(COMPANION_TABLE.rapportCap);
    expect(companionModifiers(companion, COMPANION_TABLE).some((m) => m.source === 'rapport:leyenda')).toBe(true);
    // La reconstrucción deja cicatriz (mixta) a la primera.
    const scarred = recordCompanionEvent(newCompanion(), 'reconstrucciones', COMPANION_TABLE);
    expect(scarred.gained.map((m) => m.id)).toEqual(['cicatriz-del-taller']);
  });

  it('motor: los modificadores adjuntos al spawn entran a effectiveStats', async () => {
    const { Battle } = await import('../src/core/battle.js');
    const { ABILITIES } = await import('../src/data/abilities.js');
    const { VALLEY_CROSSING } = await import('../src/data/maps.js');
    const battle = new Battle({
      map: VALLEY_CROSSING, unitCatalog: ZOIDS, abilityCatalog: ABILITIES, seed: 5,
      spawns: [
        { id: 'A', name: 'Marcada', unitTypeId: 'molga', team: 'player', position: { x: 1, y: 3 },
          modifiers: [{ source: 'mark:test', stat: 'atk', add: 7 }] },
        { id: 'B', name: 'Limpia', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 3 } },
      ],
    });
    expect(battle.effectiveStats(battle.unit('A')).atk).toBe(30 + 7);
    expect(battle.effectiveStats(battle.unit('B')).atk).toBe(30);
  });
});

describe('desahogos y terapia', () => {
  it('la terapia reencuadra la manía (no la borra) y es determinista', async () => {
    const { newPilot: mk, recordPilotEvent, reframeQuirk } = await import('../src/core/progression.js');
    let pilot = mk('t', 'Terapiado');
    pilot = { ...pilot, quirks: ['paranoia'] };
    const reframed = reframeQuirk(pilot, 'paranoia', PERKS);
    expect(reframed).not.toBeNull();
    expect(reframed!.quirks).toEqual(['vigilancia']); // transformada, no borrada
    // Una manía sin reencuadre definido no es tratable.
    expect(reframeQuirk({ ...pilot, quirks: ['curtido'] }, 'curtido', PERKS)).toBeNull();
    // Las reencuadradas jamás se adquieren por contadores (umbral infinito).
    let party = mk('p', 'Parrandero');
    for (let i = 0; i < 3; i++) party = recordPilotEvent(party, 'parrandas', PERKS).pilot;
    expect(party.quirks).toEqual([]);
    const fourth = recordPilotEvent(party, 'parrandas', PERKS);
    expect(fourth.gained.map((q) => q.id)).toEqual(['juerguista']); // 4 parrandas
    expect(fourth.pilot.quirks).not.toContain('alma-de-la-compania');
    // Y la Juerguista también tiene salida terapéutica.
    expect(reframeQuirk(fourth.pilot, 'juerguista', PERKS)!.quirks).toEqual(['alma-de-la-compania']);
  });
});

describe('ciudad: pantalla y reglas nuevas', () => {
  it('sin suministros solo hay rutas hacia la civilización', async () => {
    const { edgesTowardCivilization } = await import('../src/game/expedition.js');
    // En el Nido del Grande (lo más lejano), las salidas civilizadas
    // apuntan a Puesto Cardo o hacia las ruinas (camino a Porto Azul).
    const exp = { ...startExpedition(SALT_PASS_REGION, 'c3-caza', 'caza'), at: 'nido-del-grande' };
    const toward = edgesTowardCivilization(exp, SALT_PASS_REGION);
    expect(toward.length).toBeGreaterThan(0);
    expect(toward.length).toBeLessThanOrEqual(availableEdges(exp, SALT_PASS_REGION).length);
    // Desde un paraje junto a ciudad, la ruta a la ciudad está incluida.
    const exp2 = { ...exp, at: 'dunas-rotas' };
    const toward2 = edgesTowardCivilization(exp2, SALT_PASS_REGION);
    expect(toward2.some((e) => otherEnd2(e, 'dunas-rotas') === 'villa-brasa')).toBe(true);
  });

  it('reparación parcial: eliges cuánto gastar', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = { ...state, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 40 } : z)) };
    const tier = CITY_TIERS[2];
    const half = cityRepair(state, 0, 140, tier.repairCostPerHp, tier.repairCapRatio, 0.5);
    expect(half.roster[0]!.hp).toBe(90); // 40 + 50 (la mitad de 100 reparables)
    expect(half.credits).toBe(state.credits - Math.round(50 * tier.repairCostPerHp));
  });

  it('el trabajo de taberna es determinista y escala con el nivel', async () => {
    const { tavernJob } = await import('../src/game/mercenary.js');
    const a = tavernJob('puesto-cardo', 1, 3, ECONOMY, CONTRACT_ENEMY_POOL);
    const b = tavernJob('puesto-cardo', 1, 3, ECONOMY, CONTRACT_ENEMY_POOL);
    expect(a).toEqual(b);
    expect(a.enemySquad).toHaveLength(3); // más pequeño que un contrato
    expect(a.id.startsWith('tav-')).toBe(true);
    const big = tavernJob('porto-azul', 2, 3, ECONOMY, CONTRACT_ENEMY_POOL);
    expect(big.reward).toBeGreaterThan(a.reward);
  });
});

function otherEnd2(edge: { a: string; b: string }, from: string): string {
  return edge.a === from ? edge.b : edge.a;
}

describe('regresión: el cerco de puentes rotos (atasco del día 17)', () => {
  it('el candado de suministros respeta los puentes rotos y nunca deja cero salidas', async () => {
    const { edgesTowardCivilization } = await import('../src/game/expedition.js');
    // La situación real del jugador: en Dunas Rotas, con los puentes a
    // Base Arcadia y a Villa Brasa caídos. Única salida física: Paso de Sal.
    const exp = {
      ...startExpedition(SALT_PASS_REGION, 'c5-escolta', 'escolta'),
      at: 'dunas-rotas',
      blockedEdges: [edgeKey('base-arcadia', 'dunas-rotas'), edgeKey('villa-brasa', 'dunas-rotas')],
    };
    const toward = edgesTowardCivilization(exp, SALT_PASS_REGION);
    expect(toward.length).toBeGreaterThan(0); // JAMÁS cero salidas
    expect(toward.some((e) => otherEnd2(e, 'dunas-rotas') === 'paso-de-sal')).toBe(true);
  });

  it('un puente no se rompe si es la última salida transitable del nodo', async () => {
    const { travel: go } = await import('../src/game/expedition.js');
    // Con dos tramos ya rotos en Dunas Rotas, viajar por el único
    // restante no puede romperlo (buscamos muchos contratos: ninguno).
    for (let i = 0; i < 60; i++) {
      const exp = {
        ...startExpedition(SALT_PASS_REGION, `probe2-${i}`, 'caza'),
        at: 'dunas-rotas',
        blockedEdges: [edgeKey('base-arcadia', 'dunas-rotas'), edgeKey('villa-brasa', 'dunas-rotas')],
      };
      const edge = SALT_PASS_REGION.edges.find((e) => edgeKey(e.a, e.b) === edgeKey('dunas-rotas', 'paso-de-sal'))!;
      const result = go(exp, SALT_PASS_REGION, edge);
      expect(result.event).not.toBe('bridge');
      expect(result.expedition.at).toBe('paso-de-sal');
    }
  });
});

describe('regresión: cerco TOTAL de puentes (los 3 tramos rotos)', () => {
  it('vadear siempre es posible: +1 jornada por el puente caído', async () => {
    const { travel: go, edgesTowardCivilization } = await import('../src/game/expedition.js');
    // El estado real del jugador: LOS TRES tramos de Dunas Rotas rotos.
    const exp = {
      ...startExpedition(SALT_PASS_REGION, 'c3-escolta', 'escolta'),
      at: 'dunas-rotas', day: 17,
      blockedEdges: [
        edgeKey('base-arcadia', 'dunas-rotas'),
        edgeKey('villa-brasa', 'dunas-rotas'),
        edgeKey('dunas-rotas', 'paso-de-sal'),
      ],
    };
    // Aun sin suministros hay salidas (vadeando).
    const toward = edgesTowardCivilization(exp, SALT_PASS_REGION);
    expect(toward.length).toBeGreaterThan(0);
    // Vadear hacia Villa Brasa: 1 jornada del tramo + 1 del vado.
    const edge = SALT_PASS_REGION.edges.find(
      (e) => edgeKey(e.a, e.b) === edgeKey('villa-brasa', 'dunas-rotas'))!;
    const ford = go(exp, SALT_PASS_REGION, edge);
    expect(ford.expedition.at).toBe('villa-brasa');
    expect(ford.expedition.day).toBe(19); // 17 + 1 + 1
    expect(ford.supplyCost).toBe(2);
    expect(ford.event).toBe('calm'); // sin sorpresas en el vado
  });
});
