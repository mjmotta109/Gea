import { moduleDef, type ModuleCatalog } from './frame.js';
import type { GameMap } from './grid.js';
import { applyStatus, hasStatus, overheatDamage } from './status.js';
import type {
  BattleAction,
  BattleEvent,
  StatModifier,
  Stats,
  UnitDefinition,
  UnitState,
  WeaponDefinition,
  WeaponState,
  WeatherId,
} from './types.js';

/**
 * Bus de sistemas del motor (docs/DESIGN.md §3.1).
 *
 * Un sistema es un módulo de lógica pura suscrito a los hooks del ciclo de
 * vida de la batalla. El estado vive en las unidades (y sus componentes);
 * los sistemas lo leen y mutan a través del contexto.
 *
 * Battle invoca los sistemas registrados EN ORDEN DE REGISTRO, siempre el
 * mismo: el determinismo del motor depende de ello. Los sistemas no se
 * conocen entre sí; se comunican mediante componentes, modificadores del
 * pipeline de stats y eventos.
 */
export interface WeaponEntry {
  def: WeaponDefinition;
  state: WeaponState;
}

export interface SystemContext {
  map: GameMap;
  weather: WeatherId;
  /** Catálogo de módulos (para daño interno en frames). */
  modules: ModuleCatalog;
  /** Stats efectivas vía pipeline; nunca leer la definición directamente. */
  effectiveStats(unit: UnitState): Stats;
  definitionOf(unit: UnitState): UnitDefinition;
  /** Arma del arsenal de la unidad que dispara esta habilidad, si existe. */
  weaponEntry(unit: UnitState, abilityId: string): WeaponEntry | undefined;
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

// ── Constantes de recursos ───────────────────────────────────────────────

/** Energía que cuesta la acción de movimiento (plana, no por casilla). */
export const MOVE_ENERGY_COST = 5;
export const BOOST_ENERGY_COST = 20;
export const BOOST_HEAT = 15;
/** Fracción de calor a partir de la cual la puntería se resiente. */
export const HEAT_HIGH_THRESHOLD = 0.7;
/** Fracción a partir de la cual también caen movilidad y evasión. */
export const HEAT_CRITICAL_THRESHOLD = 0.85;

// ── Modificadores de recursos para el pipeline de stats ─────────────────

/** Sin energía: los sistemas defensivos pierden potencia. */
export function energyModifiers(unit: UnitState): StatModifier[] {
  const energy = unit.components.energy;
  if (!energy || energy.current > 0) return [];
  return [
    { source: 'energy:depleted', stat: 'evade', add: -10 },
    { source: 'energy:depleted', stat: 'energyDef', add: -10 },
  ];
}

/** Calor alto: puntería; calor crítico: además movilidad y evasión. */
export function heatModifiers(unit: UnitState): StatModifier[] {
  const heat = unit.components.heat;
  if (!heat || heat.max <= 0) return [];
  const ratio = heat.current / heat.max;
  const mods: StatModifier[] = [];
  if (ratio >= HEAT_HIGH_THRESHOLD) {
    mods.push({ source: 'heat:high', stat: 'accuracy', add: -15 });
  }
  if (ratio >= HEAT_CRITICAL_THRESHOLD) {
    mods.push({ source: 'heat:critical', stat: 'move', add: -2 });
    mods.push({ source: 'heat:critical', stat: 'evade', add: -10 });
  }
  return mods;
}

// ── EnergySystem ─────────────────────────────────────────────────────────

/** ¿El generador está en línea? (frame con módulo 'generator' destruido ⇒ no) */
function generatorOnline(unit: UnitState, ctx: SystemContext): boolean {
  const frame = unit.components.frame;
  if (!frame) return true;
  const generator = frame.modules.find((m) =>
    moduleDef(ctx.modules, m.moduleId).tags.includes('generator'));
  return generator ? !generator.destroyed : true;
}

export const energySystem: BattleSystem = {
  id: 'energy',

  onTurnStart(unit, ctx) {
    const energy = unit.components.energy;
    if (!energy) return [];
    energy.boostedThisTurn = false;
    const output = generatorOnline(unit, ctx) ? energy.outputPerTurn : 0;
    const delta = Math.min(energy.capacity - energy.current, output);
    if (delta <= 0) return [];
    energy.current += delta;
    return [{ type: 'energy-changed', unitId: unit.id, current: energy.current, delta, reason: 'reactor' }];
  },

  onValidateAction(action, unit, ctx) {
    const energy = unit.components.energy;
    switch (action.type) {
      case 'move':
        if (energy && energy.current < MOVE_ENERGY_COST) {
          return { systemId: 'energy', reason: 'energía insuficiente para mover los actuadores' };
        }
        return null;
      case 'boost':
        if (!energy) return { systemId: 'energy', reason: 'sin sistema de energía para boost' };
        if (energy.current < BOOST_ENERGY_COST) {
          return { systemId: 'energy', reason: 'energía insuficiente para el boost' };
        }
        return null;
      case 'ability': {
        const cost = ctx.weaponEntry(unit, action.abilityId)?.def.costs.energy ?? 0;
        if (energy && cost > energy.current) {
          return { systemId: 'energy', reason: `energía insuficiente para el arma (${cost})` };
        }
        return null;
      }
      default:
        return null;
    }
  },

  onActionResolved(action, unit, ctx) {
    const energy = unit.components.energy;
    if (!energy) return [];
    let cost = 0;
    if (action.type === 'move') cost = MOVE_ENERGY_COST;
    if (action.type === 'boost') cost = BOOST_ENERGY_COST;
    if (action.type === 'ability') cost = ctx.weaponEntry(unit, action.abilityId)?.def.costs.energy ?? 0;
    if (cost <= 0) return [];
    energy.current = Math.max(0, energy.current - cost);
    return [{ type: 'energy-changed', unitId: unit.id, current: energy.current, delta: -cost, reason: action.type }];
  },
};

/**
 * Daño interno (calor, sobrecarga): ignora armadura y localización. En
 * unidades con frame golpea directamente el módulo crítico — el HP global
 * es derivado, así que decrementarlo sin tocar módulos lo desharía el
 * siguiente recálculo. Devuelve el HP resultante de la unidad.
 */
function applyInternalDamage(unit: UnitState, damage: number, ctx: SystemContext): number {
  const frame = unit.components.frame;
  if (!frame) {
    unit.hp = Math.max(0, unit.hp - damage);
    return unit.hp;
  }
  const core = frame.modules.find(
    (m) => !m.destroyed && moduleDef(ctx.modules, m.moduleId).critical,
  );
  if (core) {
    core.hp = Math.max(0, core.hp - damage);
    if (core.hp === 0) core.destroyed = true;
  }
  const coreDestroyed = frame.modules.some(
    (m) => m.destroyed && moduleDef(ctx.modules, m.moduleId).critical,
  );
  unit.hp = coreDestroyed ? 0 : frame.modules.reduce((sum, m) => sum + m.hp, 0);
  return unit.hp;
}

// ── HeatSystem ───────────────────────────────────────────────────────────

export const heatSystem: BattleSystem = {
  id: 'heat',

  onTurnStart(unit, ctx) {
    const heat = unit.components.heat;
    if (!heat || heat.current <= heat.max) return [];

    // Apagado de emergencia: el turno se pierde (stun de 1 turno que el
    // flujo de nextTurn resuelve solo) y el núcleo sufre daño interno.
    const events: BattleEvent[] = [];
    const damage = overheatDamage(ctx.effectiveStats(unit).maxHp);
    const hp = applyInternalDamage(unit, damage, ctx);
    events.push({ type: 'unit-shutdown', unitId: unit.id, damage, targetHp: hp });
    if (hp === 0) {
      events.push({ type: 'unit-destroyed', unitId: unit.id });
      return events;
    }
    applyStatus(unit, 'stunned', 1);
    return events;
  },

  onActionResolved(action, unit, ctx) {
    const heat = unit.components.heat;
    if (!heat) return [];
    let generated = 0;
    if (action.type === 'boost') generated = BOOST_HEAT;
    if (action.type === 'ability') generated = ctx.weaponEntry(unit, action.abilityId)?.def.costs.heat ?? 0;
    if (generated <= 0) return [];
    heat.current += generated;
    return [{ type: 'heat-changed', unitId: unit.id, current: heat.current, delta: generated, reason: action.type }];
  },

  onTurnEnd(unit, ctx) {
    const heat = unit.components.heat;
    if (!heat || heat.current <= 0) return [];
    // Con los sistemas parados (apagado de emergencia), el reactor al
    // ralentí ventila el doble. El agua bajo el chasis y la lluvia
    // también ayudan a refrigerar.
    let dissipation = heat.dissipationPerTurn;
    if (hasStatus(unit, 'stunned')) dissipation *= 2;
    if (ctx.map.tileAt(unit.position).terrain === 'water') dissipation *= 2;
    if (ctx.weather === 'rain') dissipation *= 1.5;
    const delta = Math.min(heat.current, Math.round(dissipation));
    if (delta <= 0) return [];
    heat.current -= delta;
    return [{ type: 'heat-changed', unitId: unit.id, current: heat.current, delta: -delta, reason: 'dissipation' }];
  },
};

// ── ArsenalSystem ────────────────────────────────────────────────────────

export const arsenalSystem: BattleSystem = {
  id: 'arsenal',

  onTurnStart(unit) {
    const arsenal = unit.components.arsenal;
    if (!arsenal) return [];
    for (const weapon of arsenal.weapons) {
      if (weapon.cooldown > 0) weapon.cooldown -= 1;
    }
    return [];
  },

  onValidateAction(action, unit, ctx) {
    if (action.type !== 'ability') return null;
    const entry = ctx.weaponEntry(unit, action.abilityId);
    if (!entry) return null;

    if (entry.state.cooldown > 0) {
      return { systemId: 'arsenal', reason: `${entry.def.name} en enfriamiento (${entry.state.cooldown}t)` };
    }
    if (entry.def.magazine > 0 && entry.state.ammo <= 0) {
      return { systemId: 'arsenal', reason: `${entry.def.name} sin munición` };
    }
    const frame = unit.components.frame;
    if (entry.def.mountSlot && frame) {
      const mount = frame.modules.find((m) => m.slot === entry.def.mountSlot);
      if (mount?.destroyed) {
        return { systemId: 'arsenal', reason: `el montaje de ${entry.def.name} está destruido` };
      }
    }
    return null;
  },

  onActionResolved(action, unit, ctx) {
    if (action.type !== 'ability') return [];
    const entry = ctx.weaponEntry(unit, action.abilityId);
    if (!entry) return [];
    if (entry.def.magazine > 0) entry.state.ammo -= 1;
    // +1 porque el decremento de inicio de turno consume primero el turno
    // del propio disparo: cooldownTurns=1 debe bloquear el turno SIGUIENTE.
    const cooldownTurns = entry.def.costs.cooldownTurns ?? 0;
    entry.state.cooldown = cooldownTurns > 0 ? cooldownTurns + 1 : 0;
    return [];
  },
};

// ── OverheatSystem (estado DoT clásico, independiente del recurso calor) ─

export const overheatSystem: BattleSystem = {
  id: 'overheat',
  onTurnEnd(unit, ctx) {
    if (!hasStatus(unit, 'overheat')) return [];

    const damage = overheatDamage(ctx.effectiveStats(unit).maxHp);
    const hp = applyInternalDamage(unit, damage, ctx);
    const events: BattleEvent[] = [{
      type: 'status-ticked',
      targetUnitId: unit.id,
      status: 'overheat',
      damage,
      targetHp: hp,
    }];
    if (hp === 0) {
      events.push({ type: 'unit-destroyed', unitId: unit.id });
    }
    return events;
  },
};

/** Sistemas activos por defecto en toda batalla, en orden de invocación. */
export function defaultSystems(): BattleSystem[] {
  return [energySystem, heatSystem, arsenalSystem, overheatSystem];
}
