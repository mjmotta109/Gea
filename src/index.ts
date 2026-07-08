/**
 * API pública del motor. Un cliente (renderer, servidor, herramientas)
 * debería poder trabajar solo con lo exportado aquí.
 */
export { Battle, type BattleConfig, type UnitSpawn } from './core/battle.js';
export { GameMap, manhattan, posKey, samePos, terrainLabel, TERRAIN_COVER } from './core/grid.js';
export { hasLineOfSight } from './core/los.js';
export { reachableTiles, targetableTiles, aoeTiles, type ReachableTile } from './core/pathfinding.js';
export { attackArc, computeDamage, damageRange, facingTowards, hitChance, type AttackArc } from './core/combat.js';
export { advanceToNextTurn, forecastTurnOrder } from './core/turn.js';
export { applyStatus, hasStatus, tickStatuses, STATUS_DEFINITIONS, STATUS_INFO } from './core/status.js';
export { applyModifiers, type StatModifier } from './core/derived.js';
export { wearModifiers, wearTier, WEAR_BRUISED_FRACTION, WEAR_CRIPPLED_FRACTION, type WearTier } from './core/wear.js';
export {
  applyDamageToModule,
  buildFrameState,
  deriveUnitHp,
  frameMaxHp,
  frameModifiers,
  repairFrame,
  rollHitLocation,
  type ModuleCatalog,
} from './core/frame.js';
export {
  arsenalSystem,
  defaultSystems,
  energyModifiers,
  energySystem,
  hasReactor,
  heatModifiers,
  heatSystem,
  overclockModifiers,
  overheatSystem,
  strainSystem,
  OVERCLOCK_ENGAGE_HEAT,
  OVERCLOCK_HEAT_PER_TURN,
  SURROUNDED_ENEMIES,
  SURROUNDED_HEAT,
  BOOST_ENERGY_COST,
  BOOST_HEAT,
  HEAT_CRITICAL_THRESHOLD,
  HEAT_HIGH_THRESHOLD,
  MOVE_ENERGY_COST,
  type ActionVeto,
  type BattleSystem,
  type SystemContext,
  type WeaponEntry,
} from './core/systems.js';
export { Rng } from './core/rng.js';
export * from './core/types.js';

export { ZOIDS } from './data/zoids.js';
export { MODULES } from './data/modules.js';
export { ABILITIES } from './data/abilities.js';
export { VALLEY_CROSSING, FLAT_ARENA } from './data/maps.js';

export { planTurn } from './ai/simpleAi.js';

/**
 * @deprecated Alias de compatibilidad de la fase 0 (des-Zoidificación del
 * core). Usa `UnitDefinition`; se retirará tras la fase 1.
 */
export type { UnitDefinition as ZoidDefinition } from './core/types.js';
