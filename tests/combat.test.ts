import { describe, expect, it } from 'vitest';
import { attackArc, computeDamage, facingTowards, hitChance, proximityBonus } from '../src/core/combat.js';
import { Rng } from '../src/core/rng.js';
import type { Stats } from '../src/core/types.js';

const STATS: Stats = {
  maxHp: 100, atk: 40, energyAtk: 30, def: 30, energyDef: 20,
  speed: 10, move: 4, jump: 1, evade: 10, accuracy: 0,
};

describe('facingTowards', () => {
  it('elige el eje dominante', () => {
    expect(facingTowards({ x: 0, y: 0 }, { x: 3, y: 1 })).toBe('east');
    expect(facingTowards({ x: 0, y: 0 }, { x: 1, y: 3 })).toBe('south');
    expect(facingTowards({ x: 5, y: 5 }, { x: 1, y: 5 })).toBe('west');
    expect(facingTowards({ x: 5, y: 5 }, { x: 5, y: 0 })).toBe('north');
  });
});

describe('attackArc', () => {
  it('detecta frente, flanco y espalda', () => {
    const defender = { x: 5, y: 5 };
    // Defensor mirando al este: ataque desde el este = frente.
    expect(attackArc({ x: 7, y: 5 }, defender, 'east')).toBe('front');
    expect(attackArc({ x: 3, y: 5 }, defender, 'east')).toBe('back');
    expect(attackArc({ x: 5, y: 3 }, defender, 'east')).toBe('side');
    expect(attackArc({ x: 5, y: 7 }, defender, 'east')).toBe('side');
  });
});

describe('hitChance', () => {
  it('bonifica flanco y espalda y se acota a [5, 99]', () => {
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'front', defenderEvade: 10 })).toBe(70);
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'side', defenderEvade: 10 })).toBe(80);
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'back', defenderEvade: 10 })).toBe(95);
    expect(hitChance({ accuracy: 10, attackerAccuracy: 0, arc: 'front', defenderEvade: 90 })).toBe(5);
  });

  it('la certeza no existe: el techo es 99 aunque los números den más', () => {
    expect(hitChance({ accuracy: 100, attackerAccuracy: 0, arc: 'back', defenderEvade: 0 })).toBe(99);
    expect(hitChance({ accuracy: 200, attackerAccuracy: 50, arc: 'back', defenderEvade: 0, proximityBonus: 16 })).toBe(99);
  });

  it('acercarse paga: +4% por casilla por debajo de 5, tope a bocajarro', () => {
    expect(proximityBonus(1)).toBe(16);
    expect(proximityBonus(2)).toBe(12);
    expect(proximityBonus(4)).toBe(4);
    expect(proximityBonus(5)).toBe(0);
    expect(proximityBonus(9)).toBe(0);
    const far = hitChance({ accuracy: 70, attackerAccuracy: 0, arc: 'front', defenderEvade: 10, proximityBonus: proximityBonus(6) });
    const near = hitChance({ accuracy: 70, attackerAccuracy: 0, arc: 'front', defenderEvade: 10, proximityBonus: proximityBonus(1) });
    expect(near).toBe(far + 16);
  });
});

describe('computeDamage', () => {
  const base = {
    attackerStats: STATS,
    defenderStats: STATS,
    power: 40,
    damageType: 'physical' as const,
    arc: 'front' as const,
    heightAdvantage: 0,
  };

  it('es determinista con la misma semilla', () => {
    expect(computeDamage(base, new Rng(42))).toBe(computeDamage(base, new Rng(42)));
  });

  it('la espalda duele más que el frente', () => {
    const front = computeDamage(base, new Rng(1));
    const back = computeDamage({ ...base, arc: 'back' }, new Rng(1));
    expect(back).toBeGreaterThan(front);
  });

  it('atacar desde arriba bonifica y desde abajo penaliza', () => {
    const even = computeDamage(base, new Rng(1));
    const above = computeDamage({ ...base, heightAdvantage: 2 }, new Rng(1));
    const below = computeDamage({ ...base, heightAdvantage: -2 }, new Rng(1));
    expect(above).toBeGreaterThan(even);
    expect(below).toBeLessThan(even);
  });

  it('el daño energético usa las stats energéticas', () => {
    const tanky = { ...STATS, def: 200, energyDef: 0 };
    const physical = computeDamage({ ...base, defenderStats: tanky }, new Rng(1));
    const energy = computeDamage({ ...base, defenderStats: tanky, damageType: 'energy' }, new Rng(1));
    expect(energy).toBeGreaterThan(physical);
  });

  it('nunca baja de 1', () => {
    const wall = { ...STATS, def: 100_000 };
    expect(computeDamage({ ...base, defenderStats: wall }, new Rng(1))).toBe(1);
  });
});

describe('damageRange', () => {
  const base = {
    attackerStats: STATS,
    defenderStats: STATS,
    power: 40,
    damageType: 'physical' as const,
    arc: 'front' as const,
    heightAdvantage: 0,
  };

  it('acota siempre a computeDamage', async () => {
    const { damageRange } = await import('../src/core/combat.js');
    const range = damageRange(base);
    expect(range.min).toBeLessThanOrEqual(range.max);
    for (let seed = 0; seed < 50; seed++) {
      const dmg = computeDamage(base, new Rng(seed));
      expect(dmg).toBeGreaterThanOrEqual(range.min);
      expect(dmg).toBeLessThanOrEqual(range.max);
    }
  });
});
