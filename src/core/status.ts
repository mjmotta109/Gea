import type { StatusId, StatusInstance, UnitState } from './types.js';

/** Metadatos de cada estado; los efectos numéricos se aplican donde tocan. */
export const STATUS_INFO: Record<StatusId, { name: string }> = {
  'overheat': { name: 'Sobrecalentamiento' },
  'armor-up': { name: 'Blindaje reforzado' },
  'evasion-up': { name: 'Evasión mejorada' },
  'stunned': { name: 'Sistemas aturdidos' },
};

export function hasStatus(unit: UnitState, id: StatusId): boolean {
  return unit.statuses.some((s) => s.id === id);
}

/** Aplica un estado; si ya existe, refresca la duración al mayor valor. */
export function applyStatus(unit: UnitState, id: StatusId, duration: number): void {
  const existing = unit.statuses.find((s) => s.id === id);
  if (existing) {
    existing.remainingTurns = Math.max(existing.remainingTurns, duration);
  } else {
    unit.statuses.push({ id, remainingTurns: duration });
  }
}

/** Bonus de evasión otorgado por estados activos. */
export function statusEvadeBonus(unit: UnitState): number {
  return hasStatus(unit, 'evasion-up') ? 20 : 0;
}

/** Bonus de defensa (ambos tipos) otorgado por estados activos. */
export function statusDefenseBonus(unit: UnitState): number {
  return hasStatus(unit, 'armor-up') ? 15 : 0;
}

/** Daño de sobrecalentamiento por turno, proporcional al HP máximo. */
export function overheatDamage(maxHp: number): number {
  return Math.max(1, Math.round(maxHp * 0.08));
}

/**
 * Reduce la duración de todos los estados en 1 turno y devuelve los que
 * expiran. Se llama al final del turno de la unidad afectada.
 */
export function tickStatuses(unit: UnitState): StatusInstance[] {
  const expired: StatusInstance[] = [];
  unit.statuses = unit.statuses.filter((s) => {
    s.remainingTurns -= 1;
    if (s.remainingTurns <= 0) {
      expired.push(s);
      return false;
    }
    return true;
  });
  return expired;
}
