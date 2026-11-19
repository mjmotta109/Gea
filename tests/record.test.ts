import { describe, expect, it } from 'vitest';
import {
  buyYantra, newCampaign, rebuildYantra, scarLevel, serviceTier, updateYantraRecord,
  yantraCore, yantraRecord,
  type OwnedYantra,
} from '../src/game/mercenary.js';
import { bondExpedition, newCompanion, observeCompanionBattle } from '../src/game/companion.js';
import { COMPANION_TABLE, CORE_TABLE } from '../src/data/marks.js';
import { ECONOMY } from '../src/data/economy.js';
import { scarOverlay, spriteBody } from '../src/web/sprites.js';

// Mismo loadout de fábrica esquemático que usa tests/mercenary.test.ts.
const factoryLoadout = (unitTypeId: string) => ({
  weapons: [] as string[], slots: {} as Record<string, string>, ...(void unitTypeId, {}),
});

const bare = (over: Partial<OwnedYantra> = {}): OwnedYantra =>
  ({ unitTypeId: 'centella', hp: 100, destroyed: false, weapons: [], slots: {}, ...over });

describe('hoja de servicio: la máquina no gana XP, pero sí historia', () => {
  it('los guardados viejos leen una hoja a cero (sin migración)', () => {
    expect(yantraRecord(bare())).toEqual({ battles: 0, kills: 0, rebuilds: 0, ejections: 0, retreats: 0 });
  });

  it('updateYantraRecord acumula sin mutar', () => {
    const yantra = bare();
    const once = updateYantraRecord(yantra, { battles: 1, kills: 2 });
    const twice = updateYantraRecord(once, { battles: 1, ejections: 1 });
    expect(yantraRecord(twice)).toEqual({ battles: 2, kills: 2, rebuilds: 0, ejections: 1, retreats: 0 });
    expect(yantra.record).toBeUndefined(); // el original quedó intacto
  });

  it('reconstruir en el taller deja constancia en la hoja', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = { ...state, credits: 99999, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 0, destroyed: true } : z)) };
    const rebuilt = rebuildYantra(state, 0, 120, ECONOMY);
    expect(yantraRecord(rebuilt.roster[0]!).rebuilds).toBe(1);
    expect(rebuilt.roster[0]!.destroyed).toBe(false);
  });

  it('la veteranía sube por batallas servidas y nunca baja', () => {
    const tiers = [0, 1, 3, 5, 8, 12, 15, 30].map((battles) =>
      serviceTier({ battles, kills: 0, rebuilds: 0, ejections: 0, retreats: 0 }).id);
    expect(tiers[0]).toBe('a-estrenar');
    expect(tiers[2]).toBe('curtido');
    expect(tiers[4]).toBe('veterano');
    expect(tiers[6]).toBe('leyenda');
    // Monótona: más batallas jamás rebajan el tramo.
    const order = ['a-estrenar', 'curtido', 'veterano', 'leyenda'];
    for (let i = 1; i < tiers.length; i++) {
      expect(order.indexOf(tiers[i]!)).toBeGreaterThanOrEqual(order.indexOf(tiers[i - 1]!));
    }
  });

  it('las cicatrices crecen con lo vivido y se cortan en 4', () => {
    const level = (battles: number, rebuilds: number): number =>
      scarLevel({ battles, kills: 0, rebuilds, ejections: 0, retreats: 0 });
    expect(level(0, 0)).toBe(0);
    expect(level(4, 0)).toBe(1);
    expect(level(8, 1)).toBe(3);
    expect(level(40, 5)).toBe(4); // el tope: no es un árbol de navidad
  });
});

describe('cicatrices en la silueta: deterministas y visibles', () => {
  it('nivel 0 no pinta nada; cada nivel añade una marca', () => {
    expect(scarOverlay('centella', 0)).toBe('');
    for (const level of [1, 2, 3, 4]) {
      const marks = scarOverlay('centella', level);
      const count = (marks.match(/<path|<rect/g) ?? []).length;
      expect(count).toBe(level);
    }
  });

  it('mismo chasis y nivel → mismas marcas; chasis distinto → distintas', () => {
    expect(scarOverlay('centella', 3)).toBe(scarOverlay('centella', 3));
    expect(scarOverlay('centella', 3)).not.toBe(scarOverlay('mula', 3));
  });

  it('spriteBody con cicatrices contiene la silueta Y las marcas', () => {
    const clean = spriteBody('mula');
    const scarred = spriteBody('mula', 2);
    expect(scarred.startsWith(clean)).toBe(true);
    expect(scarred.length).toBeGreaterThan(clean.length);
  });
});

describe('todo Yantra está vivo: núcleo para las no-compañeras', () => {
  it('los guardados viejos leen un núcleo verde', () => {
    expect(yantraCore(bare())).toEqual({ markIds: [], memory: {}, rapport: 0 });
  });

  it('CORE_TABLE es el vínculo menor: 3 marcas, compenetración 6, sin tramos altos', () => {
    expect(CORE_TABLE.markCap).toBe(3);
    expect(CORE_TABLE.rapportCap).toBe(6);
    expect(CORE_TABLE.rapportTiers.every((t) => t.min <= 6)).toBe(true);
    // La compañera conserva su techo completo: su vínculo sigue único.
    expect(COMPANION_TABLE.markCap).toBeGreaterThan(CORE_TABLE.markCap);
    expect(COMPANION_TABLE.rapportCap).toBeGreaterThan(CORE_TABLE.rapportCap);
  });

  it('el núcleo menor deja de grabar al llenar sus 3 espacios', () => {
    let core = newCompanion();
    // Memoria al borde de CUATRO umbrales a la vez: solo caben 3 marcas.
    core = { ...core, memory: { tormentas: 2, apagados: 2, roces: 3, reconstrucciones: 1 } };
    const observed = observeCompanionBattle(core, {
      events: [], unitId: 'P2', finalHpRatio: 1, weather: 'clear',
    }, CORE_TABLE);
    expect(observed.companion.markIds).toHaveLength(3);
  });

  it('la compenetración del núcleo menor se corta en 6', () => {
    let core = newCompanion();
    for (let i = 0; i < 12; i++) core = bondExpedition(core, CORE_TABLE);
    expect(core.rapport).toBe(6);
  });

  it('cambiar de chasis entrega una máquina verde: el núcleo no se muda', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = {
      ...state,
      credits: 99999,
      roster: state.roster.map((z, i) =>
        (i === 1 ? { ...z, core: { markIds: ['diente-mellado'], memory: { bajas: 10 }, rapport: 4 } } : z)),
    };
    const after = buyYantra(state, 1, 'tornillo', 120, ECONOMY, factoryLoadout);
    expect(after).not.toBe(state); // la compra ocurrió
    expect(after.roster[1]!.core).toBeUndefined();
  });
});
