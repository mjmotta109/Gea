import { describe, expect, it } from 'vitest';
import { adjustReputation, reputationTier, REPUTATION_MAX, REPUTATION_MIN } from '../src/game/reputation.js';
import { availableEdges, resolveEncounter, startFreeExpedition, travel } from '../src/game/expedition.js';
import type { Encounter } from '../src/game/expedition.js';
import { newCampaign } from '../src/game/mercenary.js';
import { ECONOMY } from '../src/data/economy.js';
import { FACTIONS, PLACE_FACTIONS } from '../src/data/factions.js';
import { SALT_PASS_REGION } from '../src/data/world.js';

const noLoadout = (): { weapons: string[]; slots: Record<string, string> } => ({ weapons: [], slots: {} });

describe('reputación: cómo nos miran las facciones', () => {
  it('ajusta, acumula y clava al rango [−100, +100]', () => {
    let rep = adjustReputation({}, 'colonos', 8);
    expect(rep['colonos']).toBe(8);
    rep = adjustReputation(rep, 'colonos', -20);
    expect(rep['colonos']).toBe(-12);
    rep = adjustReputation(rep, 'colonos', -500);
    expect(rep['colonos']).toBe(REPUTATION_MIN);
    rep = adjustReputation(rep, 'colonos', 9999);
    expect(rep['colonos']).toBe(REPUTATION_MAX);
  });

  it('los tramos de trato cubren todo el rango sin huecos', () => {
    expect(reputationTier(55).id).toBe('aliado');
    expect(reputationTier(40).id).toBe('aliado');
    expect(reputationTier(15).id).toBe('apreciado');
    expect(reputationTier(0).id).toBe('neutral');
    expect(reputationTier(-9).id).toBe('neutral');
    expect(reputationTier(-20).id).toBe('hostil');
    expect(reputationTier(-40).id).toBe('odiado');
    expect(reputationTier(REPUTATION_MIN).id).toBe('odiado');
  });

  it('la campaña nueva arranca sin deudas ni favores', () => {
    const campaign = newCampaign(ECONOMY, noLoadout, { starterRoster: [] });
    expect(campaign.reputation).toEqual({});
  });

  it('toda ciudad adscrita responde a una facción que existe', () => {
    const ids = new Set(FACTIONS.map((f) => f.id));
    for (const [place, factionId] of Object.entries(PLACE_FACTIONS)) {
      expect(ids.has(factionId), `${place} → ${factionId}`).toBe(true);
      expect(SALT_PASS_REGION.nodes.some((n) => n.id === place), place).toBe(true);
    }
  });
});

describe('encrucijadas morales: decisiones con testigos', () => {
  const exp = startFreeExpedition(SALT_PASS_REGION, 'moral');
  const enc = (kind: Encounter['kind']): Encounter => ({ id: 'x', kind, prompt: '', options: [] });

  it('saquear la caravana paga bien y cuesta caro con los Colonos', () => {
    const outcome = resolveEncounter(exp, enc('caravana'), 'saquear');
    expect(outcome.cargo!.value).toBeGreaterThan(220); // más que ayudar
    const colonos = outcome.reputation!.find((r) => r.factionId === 'colonos')!;
    expect(colonos.delta).toBeLessThan(0);
    expect(outcome.stressDelta).toBeGreaterThan(0); // el peso de lo hecho
  });

  it('el peaje tiene 4 salidas y ninguna es gratis del todo', () => {
    const pagar = resolveEncounter(exp, enc('peaje'), 'pagar');
    expect(pagar.supplyDelta).toBeLessThan(0);
    const plantarse = resolveEncounter(exp, enc('peaje'), 'plantarse');
    expect(plantarse.stressDelta).toBeGreaterThan(0);
    expect(plantarse.reputation!.some((r) => r.delta < 0)).toBe(true);
    const unirse = resolveEncounter(exp, enc('peaje'), 'unirse');
    expect(unirse.reputation!.find((r) => r.factionId === 'colonos')!.delta).toBeLessThanOrEqual(-15);
    const rodear = resolveEncounter(exp, enc('peaje'), 'rodear');
    expect(rodear.expedition.day).toBe(exp.day + 1);
  });

  it('no todo son 3 opciones: hay encuentros de 2, de 3 y de 4', () => {
    // Caza determinista: claves distintas hasta ver los cuatro tipos.
    const optionsByKind: Record<string, number> = {};
    for (let i = 0; i < 2000 && Object.keys(optionsByKind).length < 4; i++) {
      const probe = startFreeExpedition(SALT_PASS_REGION, `var-${i}`);
      const edge = availableEdges(probe, SALT_PASS_REGION)[0]!;
      const result = travel(probe, SALT_PASS_REGION, edge);
      if (result.encounter) optionsByKind[result.encounter.kind] = result.encounter.options.length;
    }
    expect(Object.keys(optionsByKind).sort()).toEqual(['caravana', 'manada', 'peaje', 'perdido']);
    expect(optionsByKind['manada']).toBe(2);
    expect(optionsByKind['caravana']).toBe(3);
    expect(optionsByKind['perdido']).toBe(3);
    expect(optionsByKind['peaje']).toBe(4);
    const distinct = new Set(Object.values(optionsByKind));
    expect(distinct.size).toBeGreaterThanOrEqual(3); // 2, 3 y 4: variedad real
  });
});
