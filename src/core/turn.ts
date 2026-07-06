import { CT_THRESHOLD, type UnitState } from './types.js';

export type SpeedLookup = (unit: UnitState) => number;

/**
 * Sistema de turnos por Charge Time (estilo FFT/FFTA): en cada tick global
 * cada unidad viva suma su velocidad al CT; la primera que alcanza el
 * umbral actúa. Empates se resuelven por CT, luego velocidad y luego id
 * para mantener el determinismo.
 *
 * La velocidad vive en la definición de la unidad, así que se recibe como
 * función de consulta para no acoplar este módulo al catálogo de datos.
 */
export function advanceToNextTurn(units: UnitState[], speedOf: SpeedLookup): UnitState | undefined {
  const alive = units.filter((u) => u.hp > 0 && !u.retreated);
  if (alive.length === 0 || alive.every((u) => speedOf(u) <= 0)) return undefined;

  for (;;) {
    const ready = alive
      .filter((u) => u.ct >= CT_THRESHOLD)
      .sort((a, b) => b.ct - a.ct || speedOf(b) - speedOf(a) || a.id.localeCompare(b.id));
    if (ready.length > 0) return ready[0];
    for (const u of alive) {
      u.ct += speedOf(u);
    }
  }
}

/**
 * Predicción del orden de los próximos turnos (para una UI de timeline),
 * sin mutar el estado real.
 */
export function forecastTurnOrder(units: UnitState[], speedOf: SpeedLookup, count: number): string[] {
  const sim = units
    .filter((u) => u.hp > 0 && !u.retreated && speedOf(u) > 0)
    .map((u) => ({ id: u.id, ct: u.ct, speed: speedOf(u) }));
  if (sim.length === 0) return [];

  const order: string[] = [];
  while (order.length < count) {
    const ready = sim
      .filter((u) => u.ct >= CT_THRESHOLD)
      .sort((a, b) => b.ct - a.ct || b.speed - a.speed || a.id.localeCompare(b.id));
    if (ready.length > 0) {
      const next = ready[0]!;
      order.push(next.id);
      next.ct -= CT_THRESHOLD;
      continue;
    }
    for (const u of sim) u.ct += u.speed;
  }
  return order;
}
