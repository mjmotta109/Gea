import { describe, expect, it } from 'vitest';
import {
  newCampaign, rebuildZoid, scarLevel, serviceTier, updateZoidRecord, zoidRecord,
  type OwnedZoid,
} from '../src/game/mercenary.js';
import { ECONOMY } from '../src/data/economy.js';
import { scarOverlay, spriteBody } from '../src/web/sprites.js';

// Mismo loadout de fábrica esquemático que usa tests/mercenary.test.ts.
const factoryLoadout = (unitTypeId: string) => ({
  weapons: [] as string[], slots: {} as Record<string, string>, ...(void unitTypeId, {}),
});

const bare = (over: Partial<OwnedZoid> = {}): OwnedZoid =>
  ({ unitTypeId: 'liger-zero', hp: 100, destroyed: false, weapons: [], slots: {}, ...over });

describe('hoja de servicio: la máquina no gana XP, pero sí historia', () => {
  it('los guardados viejos leen una hoja a cero (sin migración)', () => {
    expect(zoidRecord(bare())).toEqual({ battles: 0, kills: 0, rebuilds: 0, ejections: 0, retreats: 0 });
  });

  it('updateZoidRecord acumula sin mutar', () => {
    const zoid = bare();
    const once = updateZoidRecord(zoid, { battles: 1, kills: 2 });
    const twice = updateZoidRecord(once, { battles: 1, ejections: 1 });
    expect(zoidRecord(twice)).toEqual({ battles: 2, kills: 2, rebuilds: 0, ejections: 1, retreats: 0 });
    expect(zoid.record).toBeUndefined(); // el original quedó intacto
  });

  it('reconstruir en el taller deja constancia en la hoja', () => {
    let state = newCampaign(ECONOMY, factoryLoadout);
    state = { ...state, credits: 99999, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 0, destroyed: true } : z)) };
    const rebuilt = rebuildZoid(state, 0, 120, ECONOMY);
    expect(zoidRecord(rebuilt.roster[0]!).rebuilds).toBe(1);
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
    expect(scarOverlay('liger-zero', 0)).toBe('');
    for (const level of [1, 2, 3, 4]) {
      const marks = scarOverlay('liger-zero', level);
      const count = (marks.match(/<path|<rect/g) ?? []).length;
      expect(count).toBe(level);
    }
  });

  it('mismo chasis y nivel → mismas marcas; chasis distinto → distintas', () => {
    expect(scarOverlay('liger-zero', 3)).toBe(scarOverlay('liger-zero', 3));
    expect(scarOverlay('liger-zero', 3)).not.toBe(scarOverlay('gustav', 3));
  });

  it('spriteBody con cicatrices contiene la silueta Y las marcas', () => {
    const clean = spriteBody('gustav');
    const scarred = spriteBody('gustav', 2);
    expect(scarred.startsWith(clean)).toBe(true);
    expect(scarred.length).toBeGreaterThan(clean.length);
  });
});
