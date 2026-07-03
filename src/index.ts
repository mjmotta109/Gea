/**
 * API pública del motor. Un cliente (renderer, servidor, herramientas)
 * debería poder trabajar solo con lo exportado aquí.
 */
export { Battle, type BattleConfig, type UnitSpawn } from './core/battle.js';
export { GameMap, manhattan, posKey, samePos } from './core/grid.js';
export { reachableTiles, targetableTiles, aoeTiles, type ReachableTile } from './core/pathfinding.js';
export { attackArc, computeDamage, facingTowards, hitChance, type AttackArc } from './core/combat.js';
export { advanceToNextTurn, forecastTurnOrder } from './core/turn.js';
export { applyStatus, hasStatus, tickStatuses, STATUS_INFO } from './core/status.js';
export { Rng } from './core/rng.js';
export * from './core/types.js';

export { ZOIDS } from './data/zoids.js';
export { ABILITIES } from './data/abilities.js';
export { VALLEY_CROSSING, FLAT_ARENA } from './data/maps.js';

export { planTurn } from './ai/simpleAi.js';
