import type { StatModifier } from './derived.js';
import type { StatusId, StatusInstance, UnitState } from './types.js';

/**
 * Definición data-driven de cada estado: nombre para UI y modificadores
 * que aporta al pipeline de stats derivadas mientras está activo. Los
 * estados con lógica propia (daño por turno, pérdida de turno) declaran
 * aquí sus datos y un sistema los interpreta (OverheatSystem, stun en
 * Battle.nextTurn).
 */
export interface StatusDefinition {
  name: string;
  modifiers: StatModifier[];
}

export const STATUS_DEFINITIONS: Record<StatusId, StatusDefinition> = {
  'overheat': {
    name: 'Sobrecalentamiento',
    modifiers: [],
  },
  'armor-up': {
    name: 'Blindaje reforzado',
    modifiers: [
      { source: 'status:armor-up', stat: 'def', add: 15 },
      { source: 'status:armor-up', stat: 'energyDef', add: 15 },
    ],
  },
  'evasion-up': {
    name: 'Evasión mejorada',
    modifiers: [
      { source: 'status:evasion-up', stat: 'evade', add: 20 },
    ],
  },
  'stunned': {
    name: 'Sistemas aturdidos',
    modifiers: [],
  },
};

/** @deprecated Alias de compatibilidad; usa STATUS_DEFINITIONS. */
export const STATUS_INFO = STATUS_DEFINITIONS;

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

/** Modificadores de stats aportados por los estados activos de la unidad. */
export function statusModifiers(unit: UnitState): StatModifier[] {
  return unit.statuses.flatMap((s) => STATUS_DEFINITIONS[s.id].modifiers);
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
