import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { wearModifiers, wearTier } from '../src/core/wear.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

/**
 * Desgaste de combate (block 5): el daño acumulado degrada la máquina en vez
 * de que el enemigo aguante más (nada de esponjas de balas). La dificultad
 * escala la severidad; el motor con severidad 0 se comporta idéntico (golden).
 */
describe('desgaste de combate: cada impacto deja marca', () => {
  it('sin severidad, a HP pleno o muerta, no hay desgaste', () => {
    expect(wearModifiers(50, 100, 0)).toEqual([]); // severidad 0
    expect(wearModifiers(100, 100, 1)).toEqual([]); // entera
    expect(wearModifiers(0, 100, 1)).toEqual([]); // muerta
  });

  it('los tramos escalan con el HP', () => {
    expect(wearTier(100, 100)).toBe('entera');
    expect(wearTier(60, 100)).toBe('castigada'); // ≤66%
    expect(wearTier(30, 100)).toBe('malherida'); // ≤33%
  });

  it('más severidad = más castigo, y NUNCA toca el HP', () => {
    const acc = (mods: ReturnType<typeof wearModifiers>) =>
      mods.find((m) => m.stat === 'accuracy')?.add ?? 0;
    expect(acc(wearModifiers(30, 100, 1.6))).toBeLessThan(acc(wearModifiers(30, 100, 1)));
    // Toca puntería, evasión y movimiento; jamás maxHp (no infla nada).
    expect(wearModifiers(30, 100, 1.6).some((m) => m.stat === 'maxHp')).toBe(false);
  });

  it('en batalla, una máquina dañada apunta y se mueve peor (y a wear 0, no)', () => {
    const mk = (wear: number) => new Battle({
      map: FLAT_ARENA, unitCatalog: ZOIDS, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS,
      moduleCatalog: MODULES, seed: 1, wear,
      spawns: [
        { id: 'H', name: 'sano', unitTypeId: 'command-wolf', team: 'player', position: { x: 1, y: 1 } },
        { id: 'D', name: 'dañado', unitTypeId: 'command-wolf', team: 'player', position: { x: 3, y: 1 }, hp: 10 },
      ],
    });
    const worn = mk(1);
    const healthy = worn.effectiveStats(worn.unit('H'));
    const damaged = worn.effectiveStats(worn.unit('D'));
    expect(damaged.accuracy).toBeLessThan(healthy.accuracy);
    expect(damaged.move).toBeLessThanOrEqual(healthy.move);
    expect(damaged.maxHp).toBe(healthy.maxHp); // el desgaste no infla ni recorta HP
    // A wear 0, el daño no degrada: mismas stats que la sana.
    const none = mk(0);
    expect(none.effectiveStats(none.unit('D')).accuracy)
      .toBe(none.effectiveStats(none.unit('H')).accuracy);
  });

  it('perder una pata cuesta puntería (onDestroyed de las patas)', () => {
    for (const id of ['liger-legs-front', 'liger-legs-rear', 'geno-leg-l', 'geno-leg-r']) {
      const onDestroyed = MODULES[id]!.onDestroyed;
      expect(onDestroyed.some((m) => m.stat === 'accuracy' && (m.add ?? 0) < 0)).toBe(true);
    }
  });
});
