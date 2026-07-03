/**
 * Tipos compartidos del motor táctico.
 *
 * El motor es determinista y agnóstico del renderizado: toda la simulación
 * ocurre sobre estos datos y se comunica hacia afuera mediante BattleEvent.
 */

export type Team = 'player' | 'enemy';

export type Facing = 'north' | 'east' | 'south' | 'west';

export interface Position {
  x: number;
  y: number;
}

export type TerrainType = 'plain' | 'rough' | 'water' | 'wall';

export interface Tile {
  terrain: TerrainType;
  /** Altura del tile en "medios niveles", como FFTA (0 = suelo raso). */
  height: number;
}

/** Clase de movimiento de una unidad, determina cómo atraviesa el terreno. */
export type MoveType = 'ground' | 'flying' | 'amphibious';

/** Estadísticas base de una unidad. */
export interface Stats {
  maxHp: number;
  /** Poder de ataque físico (armas de contacto y balísticas). */
  atk: number;
  /** Poder de ataque energético (láseres, partículas). */
  energyAtk: number;
  /** Blindaje: reduce daño físico. */
  def: number;
  /** Escudo/resistencia energética: reduce daño energético. */
  energyDef: number;
  /** Velocidad: ritmo de carga de CT (turnos más frecuentes). */
  speed: number;
  /** Casillas de movimiento por turno. */
  move: number;
  /** Diferencia máxima de altura que puede salvar al moverse. */
  jump: number;
  /** Evasión base (0-100). */
  evade: number;
}

export type DamageType = 'physical' | 'energy';

/** Forma del área objetivo de una habilidad. */
export type TargetShape = 'single' | 'cross' | 'line';

export type AbilityEffect =
  | { kind: 'damage'; power: number; damageType: DamageType }
  | { kind: 'heal'; power: number }
  | { kind: 'status'; status: StatusId; duration: number; chance: number };

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  /** Alcance en casillas desde el usuario (1 = melee). */
  range: number;
  /** Alcance mínimo (los francotiradores no disparan a bocajarro). */
  minRange: number;
  shape: TargetShape;
  /** Radio del área secundaria alrededor del objetivo (0 = solo el tile). */
  aoeRadius: number;
  /** Precisión base (0-100). Los efectos de curación/estado propios no fallan. */
  accuracy: number;
  /** ¿Puede apuntar a aliados? (curaciones, buffs) */
  targetsAllies: boolean;
  effects: AbilityEffect[];
}

export type StatusId =
  | 'overheat'      // daño por turno (los sistemas internos se sobrecalientan)
  | 'armor-up'      // +DEF temporal
  | 'evasion-up'    // +evasión temporal
  | 'stunned';      // pierde su próximo turno

export interface StatusInstance {
  id: StatusId;
  /** Turnos de la unidad afectada que quedan antes de expirar. */
  remainingTurns: number;
}

/**
 * Definición de un tipo de unidad: hace el papel de los "jobs" de FFTA.
 * El motor es genérico — mechas, tanques, infantería o naves — y todo es
 * data-driven: el contenido concreto vive en src/data/.
 */
export interface UnitDefinition {
  id: string;
  name: string;
  /** Rol orientativo para IA y UI. */
  role: 'assault' | 'skirmisher' | 'tank' | 'sniper' | 'support' | 'flyer';
  moveType: MoveType;
  stats: Stats;
  /** IDs de habilidades del catálogo que este tipo de unidad conoce. */
  abilityIds: string[];
}

export interface UnitState {
  id: string;
  name: string;
  unitTypeId: string;
  team: Team;
  position: Position;
  facing: Facing;
  hp: number;
  /** Charge Time: al llegar a CT_THRESHOLD la unidad actúa. */
  ct: number;
  statuses: StatusInstance[];
  /** Flags del turno activo. */
  hasMoved: boolean;
  hasActed: boolean;
}

/** Acciones que un controlador (jugador o IA) puede pedir al motor. */
export type BattleAction =
  | { type: 'move'; unitId: string; to: Position }
  | { type: 'ability'; unitId: string; abilityId: string; target: Position }
  | { type: 'wait'; unitId: string; facing?: Facing };

/**
 * Eventos emitidos por el motor al resolver acciones. Un renderer los
 * consume para animar; los tests los usan para verificar la simulación.
 */
export type BattleEvent =
  | { type: 'turn-started'; unitId: string }
  | { type: 'unit-moved'; unitId: string; path: Position[] }
  | { type: 'ability-used'; unitId: string; abilityId: string; target: Position }
  | { type: 'ability-missed'; unitId: string; targetUnitId: string }
  | { type: 'damage-dealt'; unitId: string; targetUnitId: string; amount: number; targetHp: number }
  | { type: 'unit-healed'; unitId: string; targetUnitId: string; amount: number; targetHp: number }
  | { type: 'status-applied'; targetUnitId: string; status: StatusId; duration: number }
  | { type: 'status-expired'; targetUnitId: string; status: StatusId }
  | { type: 'status-ticked'; targetUnitId: string; status: StatusId; damage: number; targetHp: number }
  | { type: 'unit-destroyed'; unitId: string }
  | { type: 'turn-ended'; unitId: string }
  | { type: 'battle-ended'; winner: Team };

export const CT_THRESHOLD = 100;
