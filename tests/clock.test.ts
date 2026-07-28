import { describe, expect, it } from 'vitest';
import {
  advanceHours, ARRIVAL_HOUR, DAWN_HOUR, hourOf, hoursUntilDawn,
  startExpedition, type ExpeditionState,
} from '../src/game/expedition.js';
import { SALT_PASS_REGION } from '../src/data/world.js';

// El reloj de expedición: el tiempo se mueve, siempre hacia delante, y
// cruzar la medianoche cumple días (que la campaña convierte en curación,
// refit y destacamentos).

const REGION = SALT_PASS_REGION;

function exp(hour?: number, day = 3): ExpeditionState {
  const base = startExpedition(REGION, 'c0-caza', 'caza');
  return { ...base, day, ...(hour !== undefined ? { hour } : {}) };
}

describe('el reloj de expedición', () => {
  it('los guardados viejos amanecen: sin hora = amanecer', () => {
    expect(hourOf(exp())).toBe(DAWN_HOUR);
    expect(hourOf(exp(-3))).toBe(DAWN_HOUR); // basura acotada
    expect(hourOf(exp(42))).toBe(DAWN_HOUR);
  });

  it('avanzar horas dentro del día no cumple jornada', () => {
    const { expedition, daysPassed } = advanceHours(exp(7), 3);
    expect(expedition.hour).toBe(10);
    expect(expedition.day).toBe(3);
    expect(daysPassed).toBe(0);
  });

  it('cruzar la medianoche cumple días (también varios de golpe)', () => {
    const one = advanceHours(exp(20), 10);
    expect(one.expedition.hour).toBe(6);
    expect(one.expedition.day).toBe(4);
    expect(one.daysPassed).toBe(1);
    const three = advanceHours(exp(7), 24 * 3);
    expect(three.expedition.hour).toBe(7);
    expect(three.daysPassed).toBe(3);
  });

  it('el tiempo no retrocede: horas negativas no hacen nada', () => {
    const { expedition, daysPassed } = advanceHours(exp(12), -5);
    expect(expedition.hour).toBe(12);
    expect(daysPassed).toBe(0);
  });

  it('acampar siempre lleva al alba del día SIGUIENTE', () => {
    for (const h of [0, 6, 7, 12, 23]) {
      const { expedition, daysPassed } = advanceHours(exp(h), hoursUntilDawn(exp(h)));
      expect(expedition.hour, `desde las ${h}`).toBe(DAWN_HOUR);
      expect(daysPassed, `desde las ${h}`).toBeGreaterThanOrEqual(1);
    }
  });

  it('la marcha llega por la tarde: la constante existe y es de tarde', () => {
    expect(ARRIVAL_HOUR).toBeGreaterThan(12);
    expect(ARRIVAL_HOUR).toBeLessThan(21);
  });
});
