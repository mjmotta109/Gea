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

export type TerrainType = 'plain' | 'rough' | 'water' | 'forest' | 'wall';

export interface Tile {
  terrain: TerrainType;
  /** Altura del tile en "medios niveles", como FFTA (0 = suelo raso). */
  height: number;
}

/** Clase de movimiento de una unidad, determina cómo atraviesa el terreno. */
export type MoveType = 'ground' | 'flying' | 'amphibious';

/**
 * Objetivo de la batalla. La aniquilación del propio equipo siempre es
 * derrota y la del rival siempre es victoria (regla de gracia); el
 * objetivo añade condiciones EXTRA por encima de esas dos:
 * - assassinate: derribar a una unidad concreta gana aunque queden más.
 * - protect: si la unidad protegida cae, se pierde.
 * - reach: victoria al plantar una unidad propia (o una concreta) en la zona.
 * - survive: victoria al completar N rondas con alguien en pie.
 */
export type BattleObjective =
  | { kind: 'eliminate' }
  | { kind: 'assassinate'; targetUnitId: string }
  | { kind: 'protect'; wardUnitId: string }
  | { kind: 'reach'; zone: Position[]; unitId?: string }
  | { kind: 'survive'; rounds: number };

/**
 * Clima de la batalla (fase 3). La lluvia acelera la disipación de calor;
 * la tormenta de arena degrada la puntería a distancia. La niebla llegará
 * con los sensores (aplazada por decisión de diseño).
 */
export type WeatherId = 'clear' | 'rain' | 'sandstorm';

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
  /**
   * Corrección de puntería (aditiva sobre la precisión de la habilidad).
   * 0 = sensores nominales; se vuelve negativa con la cabeza/sensores
   * dañados y positiva con equipamiento de puntería.
   */
  accuracy: number;
}

/**
 * Modificador del pipeline de stats derivadas (docs/DESIGN.md §3.2).
 * Los sistemas nunca tocan stats directamente: aportan modificadores y
 * core/derived.ts los combina con orden determinista.
 */
/**
 * Postura de energía: cómo reparte la máquina su potencia este turno.
 * Cambiarla es una acción LIBRE (no gasta el turno) y persiste.
 */
export type StanceId = 'cazador' | 'galope' | 'tortuga';

export interface StatModifier {
  /** Origen legible para depuración/UI: 'status:armor-up', 'module:leg-l'... */
  source: string;
  stat: keyof Stats;
  /** Componente aditivo. */
  add?: number;
  /** Componente multiplicativo; se aplica después de TODOS los aditivos. */
  mult?: number;
}

// ── Unidad compuesta: frames y módulos (fase 1) ─────────────────────────

/**
 * Identificador de hueco del chasis: 'head', 'torso', 'leg-l', 'weapon-1',
 * 'backpack'... Es una string libre: cada frame define los suyos.
 */
export type SlotId = string;

export interface ModuleDefinition {
  id: string;
  name: string;
  hp: number;
  /** Reducción plana de daño antes de tocar el HP del módulo. */
  armor: number;
  /** Masa del módulo; la consumen estabilidad/energía en fases futuras. */
  weight: number;
  /** Peso relativo en la tabla de localización de impactos (mayor = más fácil de golpear). */
  hitWeight: number;
  /** Si se destruye, la unidad entera queda fuera de combate. */
  critical: boolean;
  /** Modificadores aportados al pipeline mientras el módulo está operativo. */
  contributions: StatModifier[];
  /** Penalizaciones EXTRA al destruirse (además de perder contributions). */
  onDestroyed: StatModifier[];
  /**
   * Etiquetas que sesgan la localización de impactos y clasifican el módulo:
   * 'rear-exposed' (×2 al atacar por la espalda), 'high-profile' (×1.5 desde
   * arriba), 'low-profile' (×1.5 desde abajo), 'weapon', 'locomotion',
   * 'sensor'...
   */
  tags: string[];
  /** Especialización a la que empuja este módulo (sinergia de progresión). */
  spec?: 'assault' | 'sniper' | 'support' | 'defense';
}

/** Asignación de un módulo a un hueco del frame (orden = orden determinista). */
export interface FrameSlotConfig {
  slot: SlotId;
  moduleId: string;
}

export interface ModuleState {
  slot: SlotId;
  moduleId: string;
  hp: number;
  destroyed: boolean;
}

export interface FrameState {
  /** En el mismo orden que la configuración del frame. */
  modules: ModuleState[];
}

/** Personalidad de IA (fase 5). Todos los ejes van de 0 a 1. */
export interface AIProfile {
  /** Presionar y avanzar (1) vs mantener posición (0). */
  aggression: number;
  /** Evitar exponerse y retirarse dañado (1) vs ignorar el riesgo (0). */
  selfPreservation: number;
  /** Aceptar tiros de baja probabilidad (1) vs solo tiros seguros (0). */
  riskTolerance: number;
}

// ── Recursos activos: energía, calor y munición (fase 2) ────────────────

/**
 * Costes declarativos de una acción/arma (docs/DESIGN.md §3.4). Los
 * sistemas los cobran: EnergySystem la energía, HeatSystem el calor,
 * ArsenalSystem la munición y el enfriamiento.
 */
export interface ActionCosts {
  energy?: number;
  heat?: number;
  /** Turnos propios que el arma queda en enfriamiento tras disparar. */
  cooldownTurns?: number;
}

/**
 * Especificación balística de un proyectil (fase 4). La resolución sigue
 * siendo instantánea, pero consume estos datos: la penetración perfora la
 * armadura de los módulos, la dispersión degrada la puntería con la
 * distancia, y la masa empuja al objetivo. El evento projectile-fired
 * lleva la trayectoria teórica para que un renderer la anime; un futuro
 * simulador de vuelo real usará este mismo spec.
 */
export interface ProjectileSpec {
  /** Velocidad teórica en casillas/segundo (solo para animación). */
  velocity: number;
  /** Pérdida de precisión por casilla de distancia. */
  dispersion: number;
  /** Puntos de armadura del módulo que ignora al impactar. */
  penetration: number;
  caliber: number;
  /** Masa del proyectil; ≥ el umbral de física empuja al objetivo. */
  mass: number;
  ricochet: boolean;
}

/**
 * Un arma montada: envuelve una habilidad del catálogo (targeting y
 * efectos) y añade costes, munición y punto de montaje. Las habilidades
 * innatas (mordiscos, garras sin sistema) siguen siendo abilityIds de la
 * unidad y no pasan por aquí.
 */
export interface WeaponDefinition {
  id: string;
  name: string;
  abilityId: string;
  costs: ActionCosts;
  /** Disparos por cargador; 0 = no consume munición (armas de energía). */
  magazine: number;
  /** Cargadores de repuesto al empezar la batalla. */
  reserves: number;
  /**
   * Slot del frame que monta el arma; si ese módulo se destruye, el arma
   * queda inoperativa. Omitir en unidades sin frame.
   */
  mountSlot?: SlotId;
  /** Balística (fase 4); omitir en armas de contacto/energía pura. */
  projectile?: ProjectileSpec;
  /**
   * Especialización a la que "empuja" esta arma (progresión): si el
   * piloto domina esa pista, el arma da bonus de sinergia.
   */
  spec?: 'assault' | 'sniper' | 'support' | 'defense';
}

export interface EnergyState {
  current: number;
  capacity: number;
  /** Producción del generador al inicio de cada turno propio. */
  outputPerTurn: number;
  boostedThisTurn: boolean;
}

export interface HeatState {
  current: number;
  max: number;
  dissipationPerTurn: number;
}

export interface WeaponState {
  weaponId: string;
  /** Disparos restantes en el cargador actual. */
  ammo: number;
  reserves: number;
  /** Turnos propios restantes de enfriamiento. */
  cooldown: number;
}

export interface ArsenalState {
  weapons: WeaponState[];
}

/**
 * Bolsa de componentes opcionales de una unidad (docs/DESIGN.md §3.1).
 * Una unidad sin un componente es ignorada por el sistema correspondiente;
 * así conviven unidades simples y unidades simuladas a fondo.
 */
export interface UnitComponents {
  frame?: FrameState;
  energy?: EnergyState;
  heat?: HeatState;
  arsenal?: ArsenalState;
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
  /**
   * Chasis modular opcional (fase 1). Si se define, la unidad usa daño
   * localizado y sus stats.maxHp deben coincidir con la suma de HP de los
   * módulos. Sin frame, la unidad es un "monocasco": HP global clásico.
   */
  frame?: FrameSlotConfig[];
  /**
   * Personalidad de IA (fase 5): pesos 0-1 que sesgan la puntuación de
   * utilidad de planTurn. Omitir = perfil neutro (0.5 en todo).
   */
  aiProfile?: Partial<AIProfile>;
  /** Sistema energético opcional (fase 2): generador y reservas. */
  energy?: { capacity: number; outputPerTurn: number };
  /** Sistema térmico opcional (fase 2): límite y disipación por turno. */
  heat?: { max: number; dissipationPerTurn: number };
  /** Armas montadas (fase 2): IDs del catálogo de armas. */
  weapons?: string[];
  /**
   * Casillas de lado que ocupa (1 por defecto). Un 2 crea una bestia 2×2
   * anclada en su `position` (esquina noroeste): ocupa cuatro casillas,
   * es inmune a los empujones y se le puede apuntar a cualquiera de ellas.
   */
  size?: number;
}

export interface UnitState {
  id: string;
  name: string;
  unitTypeId: string;
  /** Comandante de su equipo: si cae, la red de mando se degrada (fase 5). */
  isCommander: boolean;
  /** maxHp real cuando el garaje montó módulos distintos de fábrica. */
  maxHpOverride?: number;
  /** Modificadores adjuntos al desplegar (marcas de campaña, auras de
   *  escenario...): entran al pipeline como cualquier otra fuente. */
  spawnModifiers?: StatModifier[];
  components: UnitComponents;
  team: Team;
  position: Position;
  facing: Facing;
  hp: number;
  /** Casillas de lado (copiado de la definición al desplegar). */
  size: number;
  /** Charge Time: al llegar a CT_THRESHOLD la unidad actúa. */
  ct: number;
  statuses: StatusInstance[];
  /** Postura de energía activa (sin definir = reparto neutro). */
  stance?: StanceId;
  /** Flags del turno activo. */
  hasMoved: boolean;
  hasActed: boolean;
  /** Reacción disponible (una por ronda; se recupera al abrir turno propio). */
  reactionReady: boolean;
  /** En vigilancia: disparará al primer enemigo que se mueva a tiro. */
  overwatch?: boolean;
  /** Salió del campo por el borde: la máquina sobrevive, la batalla sigue sin ella. */
  retreated?: boolean;
  /** El piloto saltó: la máquina se pierde (hp 0) pero él vuelve casi entero. */
  ejected?: boolean;
}

/** Acciones que un controlador (jugador o IA) puede pedir al motor. */
export type BattleAction =
  | { type: 'move'; unitId: string; to: Position }
  | { type: 'ability'; unitId: string; abilityId: string; target: Position }
  /** Impulso extra de movimiento (una vez por turno, coste energético alto). */
  | { type: 'boost'; unitId: string; to: Position }
  /** Recargar un arma consume la acción del turno. */
  | { type: 'reload'; unitId: string; weaponId: string }
  | { type: 'wait'; unitId: string; facing?: Facing }
  /** Cambio de postura de energía: acción libre, no consume el turno. */
  | { type: 'stance'; unitId: string; stance: StanceId }
  /** Vigilancia (XCOM): renuncia a actuar y dispara al primero que se mueva. */
  | { type: 'overwatch'; unitId: string }
  /** Retirada por el borde: la unidad abandona el campo intacta. */
  | { type: 'retreat'; unitId: string }
  /** Eyección: el piloto salta y la máquina queda perdida en el sitio. */
  | { type: 'eject'; unitId: string };

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
  | { type: 'hit-location-rolled'; targetUnitId: string; slot: SlotId }
  | { type: 'module-damaged'; targetUnitId: string; slot: SlotId; amount: number; moduleHp: number }
  | { type: 'module-destroyed'; targetUnitId: string; slot: SlotId }
  | { type: 'unit-healed'; unitId: string; targetUnitId: string; amount: number; targetHp: number }
  | { type: 'status-applied'; targetUnitId: string; status: StatusId; duration: number }
  | { type: 'status-expired'; targetUnitId: string; status: StatusId }
  | { type: 'status-ticked'; targetUnitId: string; status: StatusId; damage: number; targetHp: number }
  | { type: 'unit-destroyed'; unitId: string }
  | { type: 'unit-boosted'; unitId: string; path: Position[] }
  /** Trayectoria teórica de un proyectil, para animación del renderer. */
  | { type: 'projectile-fired'; unitId: string; weaponId: string; from: Position; to: Position; flightTime: number }
  /** Empuje físico: un impacto masivo desplaza al objetivo una casilla. */
  | { type: 'unit-pushed'; unitId: string; from: Position; to: Position }
  /** Un muro reventado por una explosión pasa a ser escombros. */
  | { type: 'terrain-destroyed'; pos: Position }
  /** Un bosque arrasado por una explosión pierde su cobertura. */
  | { type: 'terrain-razed'; pos: Position }
  /** Arranca una ronda nueva (cada unidad actúa ~una vez por ronda). */
  | { type: 'round-started'; round: number }
  /** Tiro fuera de turno: oportunidad (fuga), contraataque o vigilancia. */
  | { type: 'reaction'; unitId: string; targetUnitId: string; reaction: 'oportunidad' | 'contraataque' | 'vigilancia'; abilityId: string }
  /** La unidad entra en vigilancia y cede el resto de su turno. */
  | { type: 'overwatch-set'; unitId: string }
  | { type: 'unit-retreated'; unitId: string }
  | { type: 'unit-ejected'; unitId: string }
  /** Oleada de refuerzos desplegada al arrancar la ronda. */
  | { type: 'reinforcements-arrived'; unitIds: string[]; round: number }
  /** El comandante del equipo cayó: la red de mando se degrada. */
  | { type: 'command-link-lost'; team: Team }
  | { type: 'energy-changed'; unitId: string; current: number; delta: number; reason: string }
  | { type: 'heat-changed'; unitId: string; current: number; delta: number; reason: string }
  | { type: 'weapon-reloaded'; unitId: string; weaponId: string; ammo: number }
  /** Apagado de emergencia por exceso térmico: pierde el turno y sufre daño interno. */
  | { type: 'unit-shutdown'; unitId: string; damage: number; targetHp: number }
  | { type: 'stance-changed'; unitId: string; stance: StanceId }
  | { type: 'turn-ended'; unitId: string }
  | { type: 'battle-ended'; winner: Team };

export const CT_THRESHOLD = 100;
