import { describe, expect, it } from 'vitest';
import { applyModifiers, type StatModifier } from '../src/core/derived.js';
import type { Stats } from '../src/core/types.js';

const BASE: Stats = {
  maxHp: 100, atk: 40, energyAtk: 30, def: 30, energyDef: 20,
  speed: 10, move: 4, jump: 1, evade: 10,
};

describe('applyModifiers', () => {
  it('sin modificadores devuelve las stats base', () => {
    expect(applyModifiers(BASE, [])).toEqual(BASE);
  });

  it('aplica aditivos', () => {
    const mods: StatModifier[] = [
      { source: 'test', stat: 'def', add: 15 },
      { source: 'test', stat: 'def', add: 5 },
    ];
    expect(applyModifiers(BASE, mods).def).toBe(50);
  });

  it('los multiplicativos se aplican después de TODOS los aditivos', () => {
    // (40 + 10) * 1.5 = 75, no 40*1.5 + 10 = 70
    const mods: StatModifier[] = [
      { source: 'a', stat: 'atk', mult: 1.5 },
      { source: 'b', stat: 'atk', add: 10 },
    ];
    expect(applyModifiers(BASE, mods).atk).toBe(75);
  });

  it('el orden de llegada no altera el resultado (aditivos vs mult)', () => {
    const a: StatModifier[] = [
      { source: 'x', stat: 'move', add: 2 },
      { source: 'y', stat: 'move', mult: 0.5 },
    ];
    const b = [...a].reverse();
    expect(applyModifiers(BASE, a)).toEqual(applyModifiers(BASE, b));
  });

  it('redondea y nunca baja de 0', () => {
    const mods: StatModifier[] = [
      { source: 'x', stat: 'evade', add: -999 },
      { source: 'y', stat: 'speed', mult: 0.33 }, // 10 * 0.33 = 3.3 → 3
    ];
    const result = applyModifiers(BASE, mods);
    expect(result.evade).toBe(0);
    expect(result.speed).toBe(3);
  });

  it('no muta las stats base', () => {
    const copy = { ...BASE };
    applyModifiers(BASE, [{ source: 'x', stat: 'atk', add: 100 }]);
    expect(BASE).toEqual(copy);
  });
});
