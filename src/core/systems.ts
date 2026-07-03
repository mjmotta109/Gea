import { overheatDamage, hasStatus } from './status.js';
import type { BattleAction, BattleEvent, Stats, UnitState } from './types.js';

/**
 * Bus de sistemas del motor (docs/DESIGN.md §3.1).
 *
 * Un sistema es un módulo de lógica pura suscrito a los hooks del ciclo de
 * vida de la batalla. El estado vive en las unidades (y, desde la fase 1,
 * en sus componentes); los sistemas lo leen y mutan a través del contexto.
 *
 * Battle invoca los sistemas registrados EN ORDEN DE REGISTRO, siempre el
 * mismo: el determinismo del motor depende de ello. Los sistemas no se
 * conocen entre sí; se comunican mediante componentes, modificadores del
 * pipeline de stats y eventos.
 */
export interface SystemContext {
  /** Stats efectivas vía pipeline; nunca leer la definición directamente. */
  effectiveStats(unit: UnitState): Stats;
  /** Unidades de la batalla (vivas y destruidas). */
  units: UnitState[];
}

/** Rechazo de una acción por parte de un sistema (energía, munición...). */
export interface ActionVeto {
  systemId: string;
  reason: string;
}

export interface BattleSystem {
  id: string;
  /** Al abrirse el turno de una unidad, tras el evento turn-started. */
  onTurnStart?(unit: UnitState, ctx: SystemContext): BattleEvent[];
  /** Antes de ejecutar una acción; devolver un veto la convierte en ilegal. */
  onValidateAction?(action: BattleAction, unit: UnitState, ctx: SystemContext): ActionVeto | null;
  /** Tras resolverse una acción con éxito. */
  onActionResolved?(action: BattleAction, unit: UnitState, ctx: SystemContext): BattleEvent[];
  /** Al cerrar el turno de la unidad (wait), antes de expirar estados. */
  onTurnEnd?(unit: UnitState, ctx: SystemContext): BattleEvent[];
}

/**
 * Primer sistema extraído de Battle como prueba del bus: el
 * sobrecalentamiento. En la fase 2 será absorbido por el HeatSystem
 * como caso particular de exceso térmico.
 */
export const overheatSystem: BattleSystem = {
  id: 'overheat',
  onTurnEnd(unit, ctx) {
    if (!hasStatus(unit, 'overheat')) return [];

    const damage = overheatDamage(ctx.effectiveStats(unit).maxHp);
    unit.hp = Math.max(0, unit.hp - damage);
    const events: BattleEvent[] = [{
      type: 'status-ticked',
      targetUnitId: unit.id,
      status: 'overheat',
      damage,
      targetHp: unit.hp,
    }];
    if (unit.hp === 0) {
      events.push({ type: 'unit-destroyed', unitId: unit.id });
    }
    return events;
  },
};

/** Sistemas activos por defecto en toda batalla. */
export function defaultSystems(): BattleSystem[] {
  return [overheatSystem];
}
