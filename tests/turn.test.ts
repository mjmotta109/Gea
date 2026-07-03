import { describe, expect, it } from 'vitest';
import { advanceToNextTurn, forecastTurnOrder } from '../src/core/turn.js';
import { CT_THRESHOLD, type UnitState } from '../src/core/types.js';

function unit(id: string, speed: number, hp = 10, ct = 0): UnitState & { speed: number } {
  return {
    id, name: id, unitTypeId: 'test', team: 'player',
    position: { x: 0, y: 0 }, facing: 'east', hp, ct,
    statuses: [], hasMoved: false, hasActed: false, speed,
  };
}

const speedOf = (u: UnitState) => (u as UnitState & { speed: number }).speed;

describe('advanceToNextTurn', () => {
  it('la unidad más rápida actúa primero', () => {
    const units = [unit('slow', 8), unit('fast', 16)];
    expect(advanceToNextTurn(units, speedOf)?.id).toBe('fast');
  });

  it('una unidad al doble de velocidad actúa el doble de veces', () => {
    const units = [unit('slow', 8), unit('fast', 16)];
    const turns: string[] = [];
    for (let i = 0; i < 9; i++) {
      const next = advanceToNextTurn(units, speedOf)!;
      turns.push(next.id);
      next.ct -= CT_THRESHOLD;
    }
    const fastTurns = turns.filter((t) => t === 'fast').length;
    expect(fastTurns).toBe(6);
  });

  it('ignora unidades destruidas', () => {
    const units = [unit('dead', 50, 0), unit('alive', 5)];
    expect(advanceToNextTurn(units, speedOf)?.id).toBe('alive');
  });

  it('devuelve undefined si nadie puede actuar', () => {
    expect(advanceToNextTurn([], speedOf)).toBeUndefined();
    expect(advanceToNextTurn([unit('zero', 0)], speedOf)).toBeUndefined();
  });
});

describe('forecastTurnOrder', () => {
  it('predice sin mutar el estado real', () => {
    const units = [unit('a', 10, 10, 50), unit('b', 12)];
    const before = units.map((u) => u.ct);
    const order = forecastTurnOrder(units, speedOf, 4);
    expect(order).toHaveLength(4);
    expect(units.map((u) => u.ct)).toEqual(before);
  });

  it('coincide con lo que haría advanceToNextTurn', () => {
    const real = [unit('a', 9), unit('b', 14), unit('c', 11)];
    const forecast = forecastTurnOrder(real, speedOf, 5);
    const actual: string[] = [];
    for (let i = 0; i < 5; i++) {
      const next = advanceToNextTurn(real, speedOf)!;
      actual.push(next.id);
      next.ct -= CT_THRESHOLD;
    }
    expect(forecast).toEqual(actual);
  });
});
