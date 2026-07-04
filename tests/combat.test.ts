import { describe, expect, it } from 'vitest';
import { attackArc, computeDamage, facingTowards, hitChance } from '../src/core/combat.js';
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
  it('bonifica flanco y espalda y se acota a [5, 100]', () => {
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'front', defenderEvade: 10 })).toBe(70);
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'side', defenderEvade: 10 })).toBe(80);
    expect(hitChance({ accuracy: 80, attackerAccuracy: 0, arc: 'back', defenderEvade: 10 })).toBe(95);
    expect(hitChance({ accuracy: 10, attackerAccuracy: 0, arc: 'front', defenderEvade: 90 })).toBe(5);
    expect(hitChance({ accuracy: 100, attackerAccuracy: 0, arc: 'back', defenderEvade: 0 })).toBe(100);
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
