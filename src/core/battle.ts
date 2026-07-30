import {
  attackArc,
  computeDamage,
  maxHitCap,
  damageRange,
  facingTowards,
  hitChance,
  proximityBonus,
  WATER_ATTACK_PENALTY,
  type AttackArc,
} from './combat.js';
import { footprintDistance, footprintTiles, GameMap, manhattan, posKey, samePos, TERRAIN_COVER } from './grid.js';
import { hasLineOfSight } from './los.js';
import { KNOCKBACK_MASS_THRESHOLD, knockbackDestination } from './physics.js';
import { aoeTiles, reachableTiles, targetableTiles, type ReachableTile } from './pathfinding.js';
import { applyModifiers } from './derived.js';
import { wearModifiers } from './wear.js';
import {
  applyDamageToModule,
  applyInitialDamage,
  buildFrameState,
  deriveUnitHp,
  frameMaxHp,
  frameModifiers,
  repairFrame,
  rollHitLocation,
  type ModuleCatalog,
} from './frame.js';
import { Rng } from './rng.js';
import { pilotModifiers, type PerkTable, type PilotState, type SpecializationId } from './progression.js';
import { applyStatus, hasStatus, statusModifiers, tickStatuses } from './status.js';
import {
  defaultSystems,
  energyModifiers,
  hasReactor,
  heatModifiers,
  overclockModifiers,
  type ActionVeto,
  type BattleSystem,
  type SystemContext,
  type WeaponEntry,
} from './systems.js';
import { advanceToNextTurn, forecastTurnOrder } from './turn.js';
import {
  CT_THRESHOLD,
  CT_TURN_BASE,
  CT_MOVE,
  CT_ACT_LIGHT,
  CT_ACT_HEAVY,
  CT_OVERDRIVE,
  type AbilityDefinition,
  type BattleAction,
  type BattleEvent,
  type BattleObjective,
  type Facing,
  type Position,
  type StatModifier,
  type Stats,
  type Team,
  type UnitState,
  type UnitDefinition,
  type SlotId,
  type WeaponDefinition,
  type WeatherId,
  StanceId,
} from './types.js';

/**
 * Acota un valor de INICIALIZACIÓN opcional (continuidad de campaña) a
 * [0, max]. Si es undefined o no finito (guardado corrupto/NaN), usa el
 * valor de fábrica: nunca propaga basura a los componentes.
 */
function initClamp(value: number | undefined, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(max, Math.round(value)));
}

export interface UnitSpawn {
  id: string;
  /** Nombre del piloto/unidad concreta; el chasis pone el resto. */
  name: string;
  unitTypeId: string;
  team: Team;
  position: Position;
  facing?: Facing;
  /** Comandante del equipo: su caída degrada a todos sus aliados (fase 5). */
  commander?: boolean;
  /**
   * HP inicial, para desplegar la unidad ya dañada (campañas con daño
   * persistente). Se acota a [1, maxHp real]; si se omite, sale a tope.
   */
  hp?: number;
  /** Blindaje de refuerzo (búnker que absorbe antes que el casco). 0 = sin refuerzo. */
  armor?: number;
  /**
   * CONTINUIDAD expedición↔combate (opt-in): estado residual con el que la
   * máquina ENTRA a la batalla, para que la campaña conecte una pelea con la
   * siguiente sin que el motor conozca la campaña. Ausentes = de fábrica
   * (calor 0, energía llena, cargadores llenos) → golden idéntico.
   */
  initialHeat?: number;
  initialEnergy?: number;
  /** Munición en el cargador por arma (weaponId → balas). Ausente = lleno. */
  ammo?: Record<string, number>;
  /** Modificadores adjuntos a la unidad durante toda la batalla. */
  modifiers?: StatModifier[];
  /**
   * Garaje: personalización del chasis al desplegar. `slots` sustituye
   * módulos del frame por otros del catálogo (mismo slot); `weapons`
   * reemplaza el arsenal completo. El maxHp real deriva de los módulos
   * montados. Sin loadout, la unidad sale de fábrica.
   */
  loadout?: {
    slots?: Record<SlotId, string>;
    weapons?: string[];
  };
  /**
   * Habilidades EXTRA que esta unidad conoce solo en esta batalla (las
   * escuelas del piloto, en la capa de campaña). El motor no sabe de
   * dónde vienen: solo las sirve.
   */
  extraAbilityIds?: string[];
}

/** Oleada de refuerzos: entra al arrancar la ronda indicada. */
export interface ReinforcementWave {
  round: number;
  spawns: UnitSpawn[];
}

/** Radio de sensores por defecto en combate nocturno (casillas). */
export const NIGHT_VISION_BASE = 6;

export interface BattleConfig {
  map: GameMap;
  spawns: UnitSpawn[];
  unitCatalog: Record<string, UnitDefinition>;
  abilityCatalog: Record<string, AbilityDefinition>;
  /** Catálogo de módulos; solo necesario si alguna unidad define frame. */
  moduleCatalog?: ModuleCatalog;
  /** Catálogo de armas; solo necesario si alguna unidad define weapons. */
  weaponCatalog?: Record<string, WeaponDefinition>;
  /** Clima de la batalla; por defecto despejado. */
  weather?: WeatherId;
  /**
   * Severidad del DESGASTE de combate (0 = sin desgaste, por defecto). No es
   * más HP: escala cuánto degrada a una máquina el daño acumulado (puntería,
   * evasión, movimiento) por tramos de HP. La dificultad de campaña lo fija;
   * el motor solo lo aplica. Con 0, comportamiento y golden master idénticos.
   */
  wear?: number;
  /**
   * COMPETENCIA de la IA (0..1, por defecto 1 = plena). Es la curva de
   * dificultad de la IA: por debajo de ciertos umbrales, la IA NO coordina el
   * fuego (0.35) ni embosca (0.65) — juega como grunts torpes. La campaña la
   * sube con el progreso y la dificultad. Con 1 (por defecto y escaramuza), la
   * IA rinde a tope y el golden master queda idéntico.
   */
  aiSkill?: number;
  /** Pilotos por unidad (progresión, opt-in) y su tabla de perks. */
  pilots?: Record<string, PilotState>;
  perkTable?: PerkTable;
  /** Objetivo de la batalla; por defecto, aniquilación clásica. */
  objective?: BattleObjective;
  /**
   * Oleadas de refuerzos. Mientras quede una oleada por llegar, su equipo
   * no puede perder por aniquilación: barrer la vanguardia no termina un
   * asalto cuyo grueso está en camino.
   */
  reinforcements?: ReinforcementWave[];
  /**
   * Combate NOCTURNO: la niebla existe SOLO de noche. Cada máquina emite
   * una burbuja de sensores (vision o NIGHT_VISION_BASE) compartida por su
   * equipo (enlace táctico); lo que queda fuera no se ve ni se puede
   * apuntar. De día (por defecto) el motor es idéntico: golden a salvo.
   */
  night?: boolean;
  seed: number;
  /**
   * Sistemas activos, invocados en el orden del array (determinista).
   * Si se omite, se usan los de defaultSystems().
   */
  systems?: BattleSystem[];
}

/**
 * Orquestador de la batalla: mantiene el estado, valida y resuelve
 * acciones, avanza los turnos y emite eventos. Es la única fachada que
 * un cliente (UI, IA, tests) necesita.
 *
 * Flujo de un turno, como en FFTA: la unidad activa puede moverse una vez
 * y actuar una vez (en cualquier orden) y termina con `wait`, opcionalmente
 * eligiendo hacia dónde mira.
 */
export class Battle {
  readonly map: GameMap;
  readonly units: UnitState[];
  readonly weather: WeatherId;
  /** Severidad del desgaste de combate (0 = apagado). Lo fija la campaña. */
  readonly wear: number;
  /** Competencia de la IA (0..1; 1 = plena). Curva de dificultad de la IA. */
  readonly aiSkill: number;
  /** Combate nocturno: niebla de sensores activa. */
  readonly night: boolean;
  private definitions: Record<string, UnitDefinition>;
  private abilities: Record<string, AbilityDefinition>;
  private modules: ModuleCatalog;
  private weapons: Record<string, WeaponDefinition>;
  private rng: Rng;
  private activeUnitId: string | undefined;
  private winnerTeam: Team | undefined;
  private systems: BattleSystem[];
  private systemContext: SystemContext;
  /** Equipos que ya perdieron a su comandante (evento emitido una vez). */
  private linkLostTeams = new Set<Team>();
  private pilots: Record<string, PilotState>;
  private perkTable: PerkTable | undefined;
  private objectiveSpec: BattleObjective;
  private pendingReinforcements: ReinforcementWave[];
  /** Rondas: cada unidad actúa aproximadamente una vez por ronda. */
  private roundNumber = 1;
  private activationsThisRound = 0;
  private roundQuota: number;
  /** Candado anti-cadenas: una reacción nunca dispara otra reacción. */
  private inReaction = false;

  constructor(config: BattleConfig) {
    // Clon propio: el terreno es destructible desde la fase 4 y los mapas
    // del catálogo no deben mutar entre batallas.
    this.map = config.map.clone();
    this.definitions = config.unitCatalog;
    this.abilities = config.abilityCatalog;
    this.modules = config.moduleCatalog ?? {};
    this.rng = new Rng(config.seed);
    this.weather = config.weather ?? 'clear';
    this.wear = config.wear ?? 0;
    this.aiSkill = config.aiSkill ?? 1;
    this.night = config.night ?? false;
    this.weapons = config.weaponCatalog ?? {};
    this.pilots = config.pilots ?? {};
    this.perkTable = config.perkTable;
    this.systems = config.systems ?? defaultSystems();
    this.systemContext = {
      map: this.map,
      weather: this.weather,
      modules: this.modules,
      effectiveStats: (u) => this.effectiveStats(u),
      definitionOf: (u) => this.definitionOf(u.unitTypeId),
      weaponEntry: (u, abilityId) => this.weaponEntry(u, abilityId),
      units: [],
    };

    this.objectiveSpec = config.objective ?? { kind: 'eliminate' };
    this.pendingReinforcements = (config.reinforcements ?? []).map((w) => ({
      round: w.round,
      spawns: [...w.spawns],
    }));

    this.units = config.spawns.map((spawn) => this.buildUnit(spawn));
    this.roundQuota = this.units.length;

    const seen = new Set<string>();
    for (const u of this.units) {
      for (const tile of footprintTiles(u.position, u.size)) {
        const key = posKey(tile);
        if (seen.has(key)) throw new Error(`Dos unidades en ${key}`);
        seen.add(key);
      }
    }
    this.systemContext.units = this.units;
  }

  /** Construye el estado inicial de una unidad (spawns y refuerzos). */
  private buildUnit(spawn: UnitSpawn): UnitState {
    {
      const def = this.definitionOf(spawn.unitTypeId);
      const size = def.size ?? 1;
      if (footprintTiles(spawn.position, size).some((t) => !this.map.inBounds(t))) {
        throw new Error(`Spawn de ${spawn.id} fuera del mapa`);
      }
      // Garaje: aplicar el loadout sobre el frame de fábrica.
      let frameConfig = def.frame;
      if (spawn.loadout?.slots) {
        if (!frameConfig) throw new Error(`${spawn.id}: loadout de slots sin frame`);
        frameConfig = frameConfig.map((entry) => {
          const replacement = spawn.loadout!.slots![entry.slot];
          return replacement ? { slot: entry.slot, moduleId: replacement } : entry;
        });
        const unknown = Object.keys(spawn.loadout.slots)
          .find((slot) => !def.frame!.some((e) => e.slot === slot));
        if (unknown) throw new Error(`${spawn.id}: el chasis no tiene el slot ${unknown}`);
      }

      let maxHp = def.stats.maxHp;
      if (frameConfig) {
        const sum = frameMaxHp(frameConfig, this.modules);
        if (!spawn.loadout?.slots && sum !== def.stats.maxHp) {
          throw new Error(
            `maxHp de ${def.id} (${def.stats.maxHp}) no coincide con la suma de módulos (${sum})`,
          );
        }
        // Con módulos personalizados, el HP real es el de lo montado.
        maxHp = sum;
      }

      const weaponIds = spawn.loadout?.weapons ?? def.weapons;
      // Frame: se construye UNA vez; si el chasis se despliega ya dañado
      // (continuidad de campaña), se reparte ese daño sobre los módulos para
      // que el HP global no se "cure" al rederivarse en el primer golpe.
      const frameState = frameConfig ? buildFrameState(frameConfig, this.modules) : undefined;
      if (frameState && spawn.hp !== undefined && spawn.hp < maxHp) {
        applyInitialDamage(frameState, this.modules, Math.round(spawn.hp));
      }
      const initialHp = frameState
        ? deriveUnitHp(frameState, this.modules)
        : spawn.hp !== undefined ? Math.max(1, Math.min(maxHp, Math.round(spawn.hp))) : maxHp;
      return {
        id: spawn.id,
        name: spawn.name,
        unitTypeId: spawn.unitTypeId,
        isCommander: spawn.commander ?? false,
        team: spawn.team,
        position: { ...spawn.position },
        size,
        ...(def.weightClass ? { weightClass: def.weightClass } : {}),
        reactionReady: true,
        ...(spawn.extraAbilityIds && spawn.extraAbilityIds.length > 0
          ? { extraAbilityIds: [...spawn.extraAbilityIds] } : {}),
        facing: spawn.facing ?? (spawn.team === 'player' ? 'east' : 'west'),
        hp: initialHp,
        armor: Math.max(0, Math.round(spawn.armor ?? 0)),
        maxHpOverride: spawn.loadout?.slots ? maxHp : undefined,
        ...(spawn.modifiers && spawn.modifiers.length > 0
          ? { spawnModifiers: spawn.modifiers.map((m) => ({ ...m })) } : {}),
        ct: 0,
        statuses: [],
        hasMoved: false,
        hasActed: false,
        components: {
          ...(frameState ? { frame: frameState } : {}),
          ...(def.energy ? {
            energy: {
              // Continuidad: energía inicial residual (acotada; ausente = llena).
              current: initClamp(spawn.initialEnergy, def.energy.capacity, def.energy.capacity),
              capacity: def.energy.capacity,
              outputPerTurn: def.energy.outputPerTurn,
              boostedThisTurn: false,
            },
          } : {}),
          ...(def.heat ? {
            heat: {
              // Continuidad: calor residual (acotado a [0,max]; ausente = 0).
              // Acotar a max (no >) evita el apagado en el turno 1 al entrar a tope.
              current: initClamp(spawn.initialHeat, def.heat.max, 0),
              max: def.heat.max,
              dissipationPerTurn: def.heat.dissipationPerTurn,
            },
          } : {}),
          ...(weaponIds ? {
            arsenal: {
              weapons: weaponIds.map((weaponId) => {
                const weapon = this.weapons[weaponId];
                if (!weapon) {
                  throw new Error(
                    `El chasis '${def.id}' monta el arma '${weaponId}', ausente del catálogo. ` +
                    `Las armas 'lib-*' viven en la biblioteca anexa: arma el catálogo con ` +
                    `withWeaponLibrary(ABILITIES, WEAPONS) (como hacen el cliente y la campaña).`,
                  );
                }
                // Continuidad: munición residual en el cargador (ausente = lleno).
                const ammo = initClamp(spawn.ammo?.[weaponId], weapon.magazine, weapon.magazine);
                return { weaponId, ammo, reserves: weapon.reserves, cooldown: 0 };
              }),
            },
          } : {}),
        },
      };
    }
  }

  /** Invoca un hook en todos los sistemas, en orden de registro. */
  private runSystems(
    hook: (system: BattleSystem) => BattleEvent[] | undefined,
  ): BattleEvent[] {
    const events: BattleEvent[] = [];
    for (const system of this.systems) {
      events.push(...(hook(system) ?? []));
    }
    return events;
  }

  // ── Consultas ──────────────────────────────────────────────────────────

  definitionOf(unitTypeId: string): UnitDefinition {
    const def = this.definitions[unitTypeId];
    if (!def) throw new Error(`Tipo de unidad desconocido: ${unitTypeId}`);
    return def;
  }

  abilityOf(abilityId: string): AbilityDefinition {
    const ability = this.abilities[abilityId];
    if (!ability) throw new Error(`Habilidad desconocida: ${abilityId}`);
    return ability;
  }

  weaponOf(weaponId: string): WeaponDefinition {
    const weapon = this.weapons[weaponId];
    if (!weapon) throw new Error(`Arma desconocida: ${weaponId}`);
    return weapon;
  }

  /** Arma del arsenal de la unidad que dispara esta habilidad, si existe. */
  weaponEntry(unit: UnitState, abilityId: string): WeaponEntry | undefined {
    const arsenal = unit.components.arsenal;
    if (!arsenal) return undefined;
    for (const state of arsenal.weapons) {
      const def = this.weaponOf(state.weaponId);
      if (def.abilityId === abilityId) return { def, state };
    }
    return undefined;
  }

  /** Habilidades utilizables: innatas + otorgadas + armas del arsenal. */
  knownAbilityIds(unit: UnitState): string[] {
    const def = this.definitionOf(unit.unitTypeId);
    const fromWeapons = unit.components.arsenal?.weapons.map(
      (w) => this.weaponOf(w.weaponId).abilityId,
    ) ?? [];
    return [...def.abilityIds, ...(unit.extraAbilityIds ?? []), ...fromWeapons];
  }

  /** Usos restantes de una habilidad con límite (undefined = sin límite). */
  usesLeft(unit: UnitState, abilityId: string): number | undefined {
    const cap = this.abilityOf(abilityId).usesPerBattle;
    if (cap === undefined) return undefined;
    return Math.max(0, cap - (unit.abilityUses?.[abilityId] ?? 0));
  }

  /**
   * Consulta si algún sistema vetaría esta acción, sin ejecutarla. La IA
   * y la UI la usan para ofrecer solo acciones pagables (sin energía, sin
   * munición, montaje destruido...).
   */
  checkVetoes(action: BattleAction): ActionVeto | null {
    const actor = this.unit(action.unitId);
    for (const system of this.systems) {
      const veto = system.onValidateAction?.(action, actor, this.systemContext);
      if (veto) return veto;
    }
    return null;
  }

  unit(unitId: string): UnitState {
    const unit = this.units.find((u) => u.id === unitId);
    if (!unit) throw new Error(`Unidad desconocida: ${unitId}`);
    return unit;
  }

  unitAt(pos: Position): UnitState | undefined {
    return this.units.find((u) => u.hp > 0 && !u.retreated &&
      footprintTiles(u.position, u.size).some((t) => samePos(t, pos)));
  }

  /**
   * Stats efectivas de una unidad: base de la definición + pipeline de
   * modificadores (docs/DESIGN.md §3.2). ÚNICA vía legítima de lectura de
   * stats en el motor, la IA y la UI — leer `definitionOf(...).stats`
   * directamente se salta los estados (y, en fases futuras, los módulos
   * dañados, el calor y la energía).
   */
  /**
   * Posturas de energía (§pilar 2): tres repartos legibles con sus dos
   * caras a la vista. Cazador afina la puntería a costa de reflejos;
   * Galope compra zancada vendiendo blindaje; Tortuga se cierra y pesa.
   */
  private static readonly STANCES: Record<StanceId, StatModifier[]> = {
    cazador: [
      { source: 'stance:cazador', stat: 'accuracy', add: 10 },
      { source: 'stance:cazador', stat: 'evade', add: -5 },
    ],
    galope: [
      { source: 'stance:galope', stat: 'move', add: 2 },
      { source: 'stance:galope', stat: 'def', add: -10 },
    ],
    tortuga: [
      { source: 'stance:tortuga', stat: 'def', add: 10 },
      { source: 'stance:tortuga', stat: 'energyDef', add: 10 },
      { source: 'stance:tortuga', stat: 'move', add: -2 },
    ],
  };

  effectiveStats(unit: UnitState): Stats {
    const def = this.definitionOf(unit.unitTypeId);
    const base = unit.maxHpOverride !== undefined
      ? { ...def.stats, maxHp: unit.maxHpOverride }
      : def.stats;
    const frame = unit.components.frame;
    // Orden del pipeline (DESIGN §3.2): módulos → estados → energía →
    // calor → red de mando.
    const mods = [
      ...(frame ? frameModifiers(frame, this.modules) : []),
      ...statusModifiers(unit),
      ...energyModifiers(unit),
      ...heatModifiers(unit),
      // Sobrecarga del reactor: potencia, iniciativa y daño mientras esté
      // puesta (el precio, el calor, lo cobra strainSystem).
      ...overclockModifiers(unit),
      // Desgaste de combate: el daño acumulado degrada la máquina (nunca
      // infla HP). Severidad 0 = sin efecto (motor y golden intactos).
      ...wearModifiers(unit.hp, base.maxHp, this.wear),
    ];
    if (this.linkLostTeams.has(unit.team) && unit.hp > 0) {
      // Sin comandante, la coordinación del equipo se resiente (fase 5).
      mods.push({ source: 'comms:link-lost', stat: 'accuracy', add: -5 });
      mods.push({ source: 'comms:link-lost', stat: 'evade', add: -5 });
    }
    // Modificadores adjuntos al spawn (campañas: marcas, auras...).
    if (unit.spawnModifiers) mods.push(...unit.spawnModifiers);
    // Postura de energía: reparto elegido por el piloto, siempre visible.
    if (unit.stance) mods.push(...Battle.STANCES[unit.stance]);
    // Progresión: el piloto aporta sus perks y la sinergia con el equipo
    // etiquetado con su especialización dominante.
    const pilot = this.pilots[unit.id];
    if (pilot && this.perkTable) {
      mods.push(...pilotModifiers(pilot, this.equippedSpecs(unit), this.perkTable));
    }
    return applyModifiers(base, mods);
  }

  /** Especializaciones del equipo montado (armas + módulos operativos). */
  private equippedSpecs(unit: UnitState): SpecializationId[] {
    const specs: SpecializationId[] = [];
    for (const weapon of unit.components.arsenal?.weapons ?? []) {
      const spec = this.weaponOf(weapon.weaponId).spec;
      if (spec) specs.push(spec);
    }
    for (const module of unit.components.frame?.modules ?? []) {
      if (module.destroyed) continue;
      const spec = this.modules[module.moduleId]?.spec;
      if (spec) specs.push(spec);
    }
    return specs;
  }

  get winner(): Team | undefined {
    return this.winnerTeam;
  }

  get isOver(): boolean {
    return this.winnerTeam !== undefined;
  }

  get objective(): BattleObjective {
    return this.objectiveSpec;
  }

  /** Ronda en curso (arranca en 1; cada unidad actúa ~una vez por ronda). */
  get round(): number {
    return this.roundNumber;
  }

  getActiveUnit(): UnitState | undefined {
    return this.activeUnitId ? this.unit(this.activeUnitId) : undefined;
  }

  /**
   * Timeline de próximos turnos para la UI. La unidad activa se proyecta con
   * su CT tras cerrar AHORA (base + tempo ya comprometido), así el orden se
   * reordena en vivo según lo que lleva hecho — el jugador VE el precio en
   * iniciativa antes de confirmar.
   */
  forecast(count = 8): string[] {
    let ctOverride: Record<string, number> | undefined;
    if (this.activeUnitId) {
      const active = this.unit(this.activeUnitId);
      ctOverride = { [active.id]: active.ct - (CT_TURN_BASE + (active.tempoSpent ?? 0)) };
    }
    return forecastTurnOrder(this.units, (u) => this.effectiveStats(u).speed, count, ctOverride);
  }

  /** Tempo que la unidad activa ha comprometido y el CT con que volvería. */
  projectedTempo(unitId: string): { spent: number; resultingCt: number } {
    const unit = this.unit(unitId);
    const spent = CT_TURN_BASE + (unit.tempoSpent ?? 0);
    return { spent, resultingCt: unit.ct - spent };
  }

  // ── Avance de turnos ───────────────────────────────────────────────────

  /**
   * Avanza el reloj hasta que una unidad esté lista y abre su turno.
   * Devuelve los eventos generados (inicio de turno y, si estaba aturdida,
   * la resolución automática del turno perdido).
   */
  nextTurn(): BattleEvent[] {
    if (this.isOver) return [];
    if (this.activeUnitId) throw new Error('Ya hay un turno activo; llama a wait antes');

    const events: BattleEvent[] = [];
    for (;;) {
      const next = advanceToNextTurn(this.units, (u) => this.effectiveStats(u).speed);
      if (!next) return events;

      // Cambio de ronda: cuando ya actuaron tantas unidades como había en
      // pie al abrirla. Aquí entran los refuerzos y se comprueba 'survive'.
      if (this.activationsThisRound >= this.roundQuota) {
        this.roundNumber += 1;
        this.activationsThisRound = 0;
        events.push({ type: 'round-started', round: this.roundNumber });
        // El fuego del campo consume un turno por ronda (determinista).
        for (const pos of this.map.decayFires()) {
          events.push({ type: 'tile-extinguished', pos });
        }
        events.push(...this.arriveReinforcements());
        this.roundQuota = Math.max(1, this.units.filter((u) => u.hp > 0 && !u.retreated).length);
        if (this.checkBattleEnd(events)) return events;
      }
      this.activationsThisRound += 1;

      next.hasMoved = false;
      next.hasActed = false;
      next.reactionReady = true;
      next.overwatch = false; // la vigilancia dura hasta tu próximo turno
      next.tempoSpent = 0;    // el recargo de tempo se cuenta desde cero
      this.activeUnitId = next.id;
      events.push({ type: 'turn-started', unitId: next.id });
      events.push(...this.runSystems((s) => s.onTurnStart?.(next, this.systemContext)));
      this.linkCommandDeaths(events); // apagado del reactor pudo tumbar a un comandante
      if (this.checkBattleEnd(events)) return events;

      // Un sistema pudo destruir a la unidad al abrir su turno (daño
      // interno por apagado de emergencia): se cierra sin acciones.
      if (next.hp <= 0) {
        this.activeUnitId = undefined;
        events.push({ type: 'turn-ended', unitId: next.id });
        continue;
      }

      if (hasStatus(next, 'stunned')) {
        // El turno se consume sin poder hacer nada. Aturdirse NO regala tempo:
        // cuesta el umbral completo (base + este relleno), no solo la base.
        next.tempoSpent = CT_THRESHOLD - CT_TURN_BASE;
        events.push(...this.execute({ type: 'wait', unitId: next.id }));
        if (this.isOver) return events;
        continue;
      }
      return events;
    }
  }

  // ── Consultas de acciones legales ──────────────────────────────────────

  legalMoves(unitId: string): ReachableTile[] {
    const unit = this.requireActive(unitId);
    if (unit.hasMoved) return [];
    const stats = this.effectiveStats(unit);
    return reachableTiles(this.map, unit.position, {
      move: stats.move,
      jump: stats.jump,
      moveType: this.definitionOf(unit.unitTypeId).moveType,
      team: unit.team,
      size: unit.size,
    }, this.units).filter((t) => !samePos(t.pos, unit.position));
  }

  legalTargets(unitId: string, abilityId: string): Position[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) return [];
    const ability = this.abilityOf(abilityId);
    this.assertKnowsAbility(unit, abilityId);
    return targetableTiles(this.map, unit.position, ability.range, ability.minRange, ability.shape)
      .filter((pos) => hasLineOfSight(this.map, unit.position, pos))
      // De noche solo se apunta dentro de la burbuja de sensores del equipo.
      .filter((pos) => this.tileVisibleFrom(unit, unit.position, pos));
  }

  /** Radio de sensores de una unidad en combate nocturno. */
  visionOf(unit: UnitState): number {
    return this.definitionOf(unit.unitTypeId).vision ?? NIGHT_VISION_BASE;
  }

  /**
   * ¿La casilla cae dentro de la burbuja de sensores del equipo de `unit`,
   * con la PROPIA unidad situada en `from` (posición hipotética al planear)?
   * De día, siempre: la niebla solo existe de noche. El enlace táctico
   * comparte sensores: cualquier aliado vivo ilumina para todos.
   */
  tileVisibleFrom(unit: UnitState, from: Position, target: Position): boolean {
    if (!this.night) return true;
    if (footprintTiles(from, unit.size).some((t) => manhattan(t, target) <= this.visionOf(unit))) {
      return true;
    }
    return this.units.some((u) =>
      u.team === unit.team && u.id !== unit.id && u.hp > 0 && !u.retreated &&
      footprintTiles(u.position, u.size).some((t) => manhattan(t, target) <= this.visionOf(u)));
  }

  /** ¿La casilla está dentro de los sensores del EQUIPO? (render, análisis) */
  tileVisibleTo(team: Team, pos: Position): boolean {
    if (!this.night) return true;
    return this.units.some((u) =>
      u.team === team && u.hp > 0 && !u.retreated &&
      footprintTiles(u.position, u.size).some((t) => manhattan(t, pos) <= this.visionOf(u)));
  }

  /** ¿La unidad rival se ve? (cualquiera de sus casillas en la burbuja) */
  unitVisibleTo(team: Team, target: UnitState): boolean {
    if (!this.night || target.team === team) return true;
    return footprintTiles(target.position, target.size)
      .some((t) => this.tileVisibleTo(team, t));
  }

  /**
   * ¿Podría esta unidad apuntar con la habilidad a `target` DESDE `from`?
   * Respeta alcance mín/máx, alineación de las armas en línea y línea de
   * visión. Es la consulta compartida por la IA y el indicador ⌖ de la UI
   * al planear movimiento (posiciones hipotéticas).
   */
  canTargetFrom(unit: UnitState, from: Position, abilityId: string, target: Position): boolean {
    const ability = this.abilityOf(abilityId);
    const dist = manhattan(from, target);
    if (dist < ability.minRange || dist > ability.range) return false;
    if (ability.shape === 'line' && from.x !== target.x && from.y !== target.y) return false;
    if (!this.map.inBounds(target) || this.map.tileAt(target).terrain === 'wall') return false;
    if (!this.tileVisibleFrom(unit, from, target)) return false; // niebla nocturna
    return hasLineOfSight(this.map, from, target);
  }

  /**
   * Contexto de impacto compartido por la resolución y el pronóstico:
   * arco, cobertura del terreno del defensor y penalización climática.
   * ÚNICO cálculo de probabilidad de impacto del motor — resolución y
   * preview no pueden divergir.
   */
  private hitContext(user: UnitState, victim: UnitState, ability: AbilityDefinition): {
    chance: number;
    arc: AttackArc;
    cover: number;
    weatherPenalty: number;
  } {
    const arc = attackArc(user.position, victim.position, victim.facing);
    const cover = TERRAIN_COVER[this.map.tileAt(victim.position).terrain];
    // Contra bestias multi-casilla cuenta la casilla ocupada más cercana.
    const dist = footprintDistance(user.position, user.size, victim.position, victim.size);
    // Tormenta de arena: la puntería se degrada más allá del combate cercano.
    const weatherPenalty = this.weather === 'sandstorm' && dist > 2 ? 10 : 0;
    // Dispersión balística: los proyectiles pierden precisión con la distancia.
    const projectile = this.weaponEntry(user, ability.id)?.def.projectile;
    const dispersionPenalty = projectile ? Math.round(projectile.dispersion * dist) : 0;
    // Vadear penaliza la puntería: un terrestre disparando desde el agua no
    // tiene suelo firme. Anfibios y voladores están exentos.
    const wading = this.map.tileAt(user.position).terrain === 'water'
      && this.definitionOf(user.unitTypeId).moveType === 'ground';
    const waterPenalty = wading ? WATER_ATTACK_PENALTY : 0;
    const chance = hitChance({
      accuracy: ability.accuracy - weatherPenalty - dispersionPenalty - waterPenalty,
      attackerAccuracy: this.effectiveStats(user).accuracy,
      arc,
      defenderEvade: this.effectiveStats(victim).evade + cover,
      proximityBonus: proximityBonus(dist),
    });
    return { chance, arc, cover, weatherPenalty };
  }

  /**
   * Pronóstico completo de un ataque para UI/IA: probabilidad (con arco,
   * cobertura, clima y puntería), rango de daño y contexto. undefined si
   * no hay efecto de daño o no hay unidad objetivo.
   */
  attackPreview(unitId: string, abilityId: string, target: Position): {
    chance: number;
    min: number;
    max: number;
    arc: AttackArc;
    heightAdvantage: number;
    cover: number;
    weatherPenalty: number;
  } | undefined {
    const unit = this.unit(unitId);
    const victim = this.unitAt(target);
    if (!victim) return undefined;
    const ability = this.abilityOf(abilityId);
    const damaging = ability.effects.find((e) => e.kind === 'damage');
    if (!damaging || damaging.kind !== 'damage') return undefined;

    const { chance, arc, cover, weatherPenalty } = this.hitContext(unit, victim, ability);
    const heightAdvantage =
      this.map.tileAt(unit.position).height - this.map.tileAt(victim.position).height;
    const victimStats = this.effectiveStats(victim);
    const range = damageRange({
      attackerStats: this.effectiveStats(unit),
      defenderStats: victimStats,
      power: damaging.power,
      damageType: damaging.damageType,
      arc,
      heightAdvantage,
    });
    // La ley del casco también manda en el pronóstico: sin sorpresas.
    const cap = maxHitCap(victimStats.maxHp);
    return {
      chance, min: Math.min(range.min, cap), max: Math.min(range.max, cap),
      arc, heightAdvantage, cover, weatherPenalty,
    };
  }

  // ── Ejecución de acciones ──────────────────────────────────────────────

  execute(action: BattleAction): BattleEvent[] {
    if (this.isOver) throw new Error('La batalla ya terminó');

    const actor = this.unit(action.unitId);
    for (const system of this.systems) {
      const veto = system.onValidateAction?.(action, actor, this.systemContext);
      if (veto) throw new Error(`Acción vetada por ${veto.systemId}: ${veto.reason}`);
    }

    const events = (() => {
      switch (action.type) {
        case 'move': return this.executeMove(action.unitId, action.to);
        case 'ability': return this.executeAbility(action.unitId, action.abilityId, action.target, action.overdrive ?? false);
        case 'boost': return this.executeBoost(action.unitId, action.to);
        case 'reload': return this.executeReload(action.unitId, action.weaponId);
        case 'wait': return this.executeWait(action.unitId, action.facing);
        case 'stance': return this.executeStance(action.unitId, action.stance);
        case 'overclock': return this.executeOverclock(action.unitId, action.on);
        case 'overwatch': return this.executeOverwatch(action.unitId);
        case 'retreat': return this.executeRetreat(action.unitId);
        case 'eject': return this.executeEject(action.unitId);
      }
    })();

    if (!this.isOver) {
      events.push(...this.runSystems((s) => s.onActionResolved?.(action, actor, this.systemContext)));
      this.checkBattleEnd(events);
    }
    // El actor pudo caer en su PROPIO turno (contraataque letal): el turno
    // se cierra solo, sin efectos de fin de turno — ya no hay quien los sufra.
    if (this.activeUnitId) {
      const active = this.unit(this.activeUnitId);
      if (active.hp <= 0) {
        this.activeUnitId = undefined;
        events.push({ type: 'turn-ended', unitId: active.id });
      }
    }
    return events;
  }

  private executeMove(unitId: string, to: Position): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasMoved) throw new Error(`${unitId} ya se movió este turno`);
    const option = this.legalMoves(unitId).find((t) => samePos(t.pos, to));
    if (!option) throw new Error(`Movimiento ilegal a ${to.x},${to.y}`);

    const watchers = this.opportunityWatchers(unit);
    unit.position = { ...to };
    unit.facing = option.path.length > 1
      ? facingTowards(option.path[option.path.length - 2]!, to)
      : unit.facing;
    unit.hasMoved = true;
    unit.tempoSpent = (unit.tempoSpent ?? 0) + CT_MOVE; // reposicionarse cuesta tempo
    const events: BattleEvent[] = [{ type: 'unit-moved', unitId, path: option.path }];
    events.push(...this.overwatchShots(unit));
    events.push(...this.resolveOpportunity(watchers, unit));
    return events;
  }

  /** Enemigos con reacción lista pegados a la unidad ANTES de moverse. */
  private opportunityWatchers(mover: UnitState): UnitState[] {
    return this.units.filter((u) =>
      u.team !== mover.team && u.hp > 0 && !u.retreated && u.reactionReady &&
      footprintDistance(u.position, u.size, mover.position, mover.size) === 1);
  }

  /**
   * Ataque de oportunidad: despegarse de un enemigo en contacto le regala
   * un tiro instintivo (uno por ronda). Quedarse a su alcance no lo provoca.
   */
  private resolveOpportunity(watchers: UnitState[], mover: UnitState): BattleEvent[] {
    const events: BattleEvent[] = [];
    for (const watcher of watchers) {
      if (this.isOver || mover.hp <= 0) break;
      if (footprintDistance(watcher.position, watcher.size, mover.position, mover.size) <= 1) continue;
      const strike = this.reactionStrike(watcher, mover, 'oportunidad');
      events.push(...strike);
      if (strike.length > 0) this.checkBattleEnd(events);
    }
    return events;
  }

  /**
   * Boost: impulso de movimiento extra (la mitad del move, mínimo 1),
   * independiente del movimiento normal, una vez por turno. El coste
   * energético y el calor los cobran los sistemas.
   */
  private executeBoost(unitId: string, to: Position): BattleEvent[] {
    const unit = this.requireActive(unitId);
    const energy = unit.components.energy;
    if (!energy) throw new Error(`${unitId} no tiene sistema de energía para boost`);
    if (energy.boostedThisTurn) throw new Error(`${unitId} ya hizo boost este turno`);

    const stats = this.effectiveStats(unit);
    const option = reachableTiles(this.map, unit.position, {
      move: Math.max(1, Math.ceil(stats.move / 2)),
      jump: stats.jump,
      moveType: this.definitionOf(unit.unitTypeId).moveType,
      team: unit.team,
      size: unit.size,
    }, this.units).find((t) => !samePos(t.pos, unit.position) && samePos(t.pos, to));
    if (!option) throw new Error(`Boost ilegal a ${to.x},${to.y}`);

    const watchers = this.opportunityWatchers(unit);
    unit.position = { ...to };
    unit.facing = option.path.length > 1
      ? facingTowards(option.path[option.path.length - 2]!, to)
      : unit.facing;
    energy.boostedThisTurn = true;
    unit.tempoSpent = (unit.tempoSpent ?? 0) + CT_ACT_HEAVY; // el impulso pesa en tempo
    const events: BattleEvent[] = [{ type: 'unit-boosted', unitId, path: option.path }];
    events.push(...this.overwatchShots(unit));
    events.push(...this.resolveOpportunity(watchers, unit));
    return events;
  }

  /** Recargar consume la acción del turno y repone el cargador completo. */
  private executeReload(unitId: string, weaponId: string): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) throw new Error(`${unitId} ya actuó este turno`);
    const arsenal = unit.components.arsenal;
    const state = arsenal?.weapons.find((w) => w.weaponId === weaponId);
    if (!state) throw new Error(`${unitId} no monta el arma ${weaponId}`);
    const def = this.weaponOf(weaponId);
    if (def.magazine === 0) throw new Error(`${def.name} no usa munición`);
    if (state.reserves <= 0) throw new Error(`${def.name} sin cargadores de repuesto`);
    if (state.ammo === def.magazine) throw new Error(`${def.name} ya está cargada`);

    unit.hasActed = true;
    unit.tempoSpent = (unit.tempoSpent ?? 0) + CT_ACT_LIGHT; // recargar cuesta la acción
    state.ammo = def.magazine;
    state.reserves -= 1;
    return [{ type: 'weapon-reloaded', unitId, weaponId, ammo: state.ammo }];
  }

  private executeAbility(unitId: string, abilityId: string, target: Position, overdrive = false): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) throw new Error(`${unitId} ya actuó este turno`);
    const ability = this.abilityOf(abilityId);
    this.assertKnowsAbility(unit, abilityId);
    // Habilidades con cupo: una vez agotadas, agotadas están.
    if (ability.usesPerBattle !== undefined) {
      const used = unit.abilityUses?.[abilityId] ?? 0;
      if (used >= ability.usesPerBattle) {
        throw new Error(`${ability.name}: agotada (${ability.usesPerBattle} por batalla)`);
      }
      unit.abilityUses = { ...(unit.abilityUses ?? {}), [abilityId]: used + 1 };
    }
    const legal = this.legalTargets(unitId, abilityId).some((p) => samePos(p, target));
    if (!legal) throw new Error(`Objetivo ilegal para ${abilityId}: ${target.x},${target.y}`);

    // Sobremarcha: solo tiene sentido en un golpe (necesita daño que amplificar).
    const offensive = ability.effects.some((e) => e.kind === 'damage');
    if (overdrive && !offensive) throw new Error(`${abilityId} no es un golpe: no admite sobremarcha`);

    unit.hasActed = true;
    unit.facing = samePos(unit.position, target) ? unit.facing : facingTowards(unit.position, target);
    // Tempo del disparo (peso del arma) + el recargo brutal de la sobremarcha.
    unit.tempoSpent = (unit.tempoSpent ?? 0) + (ability.ctCost ?? CT_ACT_LIGHT) + (overdrive ? CT_OVERDRIVE : 0);

    const events: BattleEvent[] = [{ type: 'ability-used', unitId, abilityId, target }];
    if (overdrive) events.push({ type: 'overdrive-used', unitId, abilityId });
    const powerMult = overdrive ? 1.5 : 1;

    // Balística (fase 4): el evento de trayectoria permite al renderer
    // animar el proyectil; la resolución sigue siendo instantánea.
    const entry = this.weaponEntry(unit, abilityId);
    if (entry?.def.projectile) {
      const flightTime = manhattan(unit.position, target) / entry.def.projectile.velocity;
      events.push({
        type: 'projectile-fired',
        unitId,
        weaponId: entry.def.id,
        from: { ...unit.position },
        to: { ...target },
        flightTime: Math.round(flightTime * 100) / 100,
      });
    }

    const blast = aoeTiles(this.map, target, ability.aoeRadius);
    // Una bestia 2×2 puede pisar varias casillas del área: cuenta UNA vez,
    // con la distancia al centro más favorable al atacante.
    const byVictim = new Map<string, { victim: UnitState; aoeDist: number }>();
    for (const pos of blast) {
      const victim = this.unitAt(pos);
      if (!victim) continue;
      const aoeDist = manhattan(pos, target);
      const prev = byVictim.get(victim.id);
      if (!prev || aoeDist < prev.aoeDist) byVictim.set(victim.id, { victim, aoeDist });
    }
    const affected = [...byVictim.values()];

    const struck: UnitState[] = [];
    for (const { victim, aoeDist } of affected) {
      const isAlly = victim.team === unit.team;
      if (offensive && isAlly && !ability.targetsAllies) continue;
      if (offensive && !isAlly) struck.push(victim);

      // La sobremarcha amplifica el golpe principal (no las reacciones).
      events.push(...this.applyEffects(unit, victim, ability, aoeDist, powerMult));
      if (this.checkBattleEnd(events)) return events;
    }

    // Contraataque: sobrevivir un golpe a bocajarro se responde en el acto
    // (una reacción por ronda; las reacciones no encadenan reacciones).
    if (offensive && !this.inReaction) {
      for (const victim of struck) {
        if (this.isOver || unit.hp <= 0) break;
        if (victim.hp <= 0 || victim.retreated) continue;
        if (footprintDistance(victim.position, victim.size, unit.position, unit.size) !== 1) continue;
        const counter = this.reactionStrike(victim, unit, 'contraataque');
        events.push(...counter);
        if (counter.length > 0 && this.checkBattleEnd(events)) return events;
      }
    }

    // Las explosiones derriban muros del área: escombros transitables
    // (y las líneas de visión que tapaban se abren — emergente). El bosque
    // queda arrasado: su cobertura desaparece para el resto de la batalla.
    if (ability.aoeRadius > 0) {
      for (const pos of aoeTiles(this.map, target, ability.aoeRadius, true)) {
        const terrain = this.map.tileAt(pos).terrain;
        if (terrain === 'wall') {
          this.map.demolish(pos);
          events.push({ type: 'terrain-destroyed', pos: { ...pos } });
        } else if (terrain === 'forest') {
          this.map.raze(pos);
          events.push({ type: 'terrain-razed', pos: { ...pos } });
        }
      }
    }

    // Arma incendiaria: PRENDE sus casillas de impacto (control del campo).
    // Las casillas arden aunque no golpeen a nadie; el agua y los muros no.
    if (ability.ignites && ability.ignites > 0) {
      for (const pos of aoeTiles(this.map, target, ability.aoeRadius, true)) {
        if (this.map.ignite(pos, ability.ignites)) {
          events.push({ type: 'tile-ignited', pos: { ...pos }, turns: ability.ignites });
        }
      }
    }
    return events;
  }

  /** Multiplicador de daño de los tiros instintivos fuera de turno. */
  private static readonly REACTION_POWER_MULT = 0.6;

  /**
   * Tiro instintivo fuera de turno: primera habilidad ofensiva pagable de
   * corto alcance (los sistemas vetan igual que en el turno: sin munición,
   * montaje destruido...). No gasta recursos — es un reflejo — pero solo
   * hay uno por ronda y pega al 60%. Nunca encadena otra reacción.
   */
  private reactionStrike(
    reactor: UnitState,
    victim: UnitState,
    reaction: 'oportunidad' | 'contraataque',
  ): BattleEvent[] {
    if (this.inReaction || !reactor.reactionReady) return [];
    if (reactor.hp <= 0 || reactor.retreated || victim.hp <= 0 || victim.retreated) return [];
    // Aturdido o SUPRIMIDO: la máquina no puede responder (fijada por fuego).
    if (hasStatus(reactor, 'stunned') || hasStatus(reactor, 'suprimido')) return [];
    const abilityId = this.knownAbilityIds(reactor).find((id) => {
      const ability = this.abilityOf(id);
      if (!ability.effects.some((e) => e.kind === 'damage')) return false;
      if (ability.minRange > 1) return false;
      return this.checkVetoes({
        type: 'ability', unitId: reactor.id, abilityId: id, target: victim.position,
      }) === null;
    });
    if (!abilityId) return [];

    reactor.reactionReady = false;
    reactor.facing = facingTowards(reactor.position, victim.position);
    const events: BattleEvent[] = [
      { type: 'reaction', unitId: reactor.id, targetUnitId: victim.id, reaction, abilityId },
    ];
    this.inReaction = true;
    try {
      events.push(...this.applyEffects(
        reactor, victim, this.abilityOf(abilityId), 0, Battle.REACTION_POWER_MULT,
      ));
    } finally {
      this.inReaction = false;
    }
    return events;
  }

  private applyEffects(
    user: UnitState,
    target: UnitState,
    ability: AbilityDefinition,
    aoeDist = 0,
    powerMult = 1,
  ): BattleEvent[] {
    const events: BattleEvent[] = [];
    const userStats = this.effectiveStats(user);
    const targetStats = this.effectiveStats(target);
    const arc = attackArc(user.position, target.position, target.facing);
    const friendly = target.team === user.team;

    for (const effect of ability.effects) {
      if (target.hp <= 0) break;

      switch (effect.kind) {
        case 'damage': {
          const chance = friendly ? 100 : this.hitContext(user, target, ability).chance;
          if (!this.rng.roll(chance)) {
            events.push({ type: 'ability-missed', unitId: user.id, targetUnitId: target.id });
            break;
          }
          const heightAdvantage =
            this.map.tileAt(user.position).height - this.map.tileAt(target.position).height;
          // Caída radial de las explosiones: cada casilla desde el centro
          // resta 25% del daño (mínimo 30%).
          const falloff = aoeDist > 0 ? Math.max(0.3, 1 - 0.25 * aoeDist) : 1;
          // La ley del casco: el impacto se tira ENTERO (mismo consumo de
          // azar) y luego se acota al tope del objetivo.
          const amount = Math.min(computeDamage({
            attackerStats: userStats,
            defenderStats: targetStats,
            power: Math.round(effect.power * falloff * powerMult),
            damageType: effect.damageType,
            arc,
            heightAdvantage,
          }, this.rng), maxHitCap(targetStats.maxHp));
          const projectile = this.weaponEntry(user, ability.id)?.def.projectile;

          // Blindaje de refuerzo (nivel máquina): el búnker de placas absorbe
          // antes que el casco o los módulos. La penetración del proyectil se
          // cuela sin gastarlo; el resto lo frena hasta agotarse.
          let dmg = amount;
          const armorNow = target.armor ?? 0;
          if (armorNow > 0 && dmg > 0) {
            const pierced = Math.min(Math.max(0, projectile?.penetration ?? 0), dmg);
            const absorbed = Math.min(armorNow, dmg - pierced);
            target.armor = armorNow - absorbed;
            dmg -= absorbed;
            events.push({ type: 'unit-armor-damaged', unitId: target.id, amount: absorbed, armor: target.armor });
            if (target.armor === 0) events.push({ type: 'unit-armor-broken', unitId: target.id });
          }

          const frame = target.components.frame;
          if (dmg <= 0) {
            // El blindaje de refuerzo se comió el golpe entero: el chasis
            // queda intacto (el impacto se registra, pero no hay daño real).
            events.push({
              type: 'damage-dealt', unitId: user.id, targetUnitId: target.id, amount, targetHp: target.hp,
            });
          } else if (frame) {
            // Daño localizado: se elige el módulo golpeado y su armadura
            // (menos la penetración del proyectil) absorbe antes de tocar
            // HP; el exceso desborda al núcleo.
            const location = rollHitLocation(frame, this.modules, arc, heightAdvantage, this.rng);
            events.push({ type: 'hit-location-rolled', targetUnitId: target.id, slot: location.slot });
            events.push({
              type: 'damage-dealt',
              unitId: user.id,
              targetUnitId: target.id,
              amount,
              targetHp: 0, // se corrige abajo, tras derivar el HP global
            });
            const damageEventIndex = events.length - 1;
            events.push(...applyDamageToModule(
              frame, this.modules, location, dmg, target.id, projectile?.penetration ?? 0,
            ));
            target.hp = deriveUnitHp(frame, this.modules);
            (events[damageEventIndex] as Extract<BattleEvent, { type: 'damage-dealt' }>).targetHp = target.hp;
          } else {
            target.hp = Math.max(0, target.hp - dmg);
            events.push({
              type: 'damage-dealt',
              unitId: user.id,
              targetUnitId: target.id,
              amount,
              targetHp: target.hp,
            });
          }
          if (target.hp === 0) {
            events.push({ type: 'unit-destroyed', unitId: target.id });
            events.push(...this.afterDestruction(target));
            break;
          }

          // Empuje por impacto masivo (fase 4): un proyectil pesado
          // desplaza al objetivo una casilla en la dirección del tiro.
          if (projectile && projectile.mass >= KNOCKBACK_MASS_THRESHOLD) {
            const dest = knockbackDestination(this.map, user.position, target, this.units);
            if (dest) {
              const from = { ...target.position };
              target.position = dest;
              events.push({ type: 'unit-pushed', unitId: target.id, from, to: { ...dest } });
            }
          }
          break;
        }
        case 'heal': {
          const frame = target.components.frame;
          if (frame) {
            // En unidades compuestas se repara el módulo más dañado; los
            // destruidos no se recuperan en combate.
            const repaired = repairFrame(frame, this.modules, effect.power);
            if (!repaired || repaired.amount <= 0) break;
            target.hp = deriveUnitHp(frame, this.modules);
            events.push({
              type: 'unit-healed',
              unitId: user.id,
              targetUnitId: target.id,
              amount: repaired.amount,
              targetHp: target.hp,
            });
            break;
          }
          const maxHp = this.effectiveStats(target).maxHp;
          const amount = Math.min(effect.power, maxHp - target.hp);
          if (amount <= 0) break;
          target.hp += amount;
          events.push({
            type: 'unit-healed',
            unitId: user.id,
            targetUnitId: target.id,
            amount,
            targetHp: target.hp,
          });
          break;
        }
        case 'status': {
          if (!this.rng.roll(effect.chance)) break;
          applyStatus(target, effect.status, effect.duration);
          events.push({
            type: 'status-applied',
            targetUnitId: target.id,
            status: effect.status,
            duration: effect.duration,
          });
          break;
        }
        case 'heat': {
          // Arma térmica: no rompe blindaje ni tira HP — COCE la máquina.
          // Vierte calor en el reactor del objetivo, empujándolo hacia el
          // atasco de armas y el apagado que ya existen (el otro lado del
          // calor↔arsenal). Sin reactor (monocasco), no hay nada que cocer:
          // no consume azar, así que el golden master queda intacto.
          const heat = target.components.heat;
          if (!heat) break;
          heat.current += effect.amount;
          events.push({
            type: 'heat-changed',
            unitId: target.id,
            current: heat.current,
            delta: effect.amount,
            reason: 'weapon',
          });
          break;
        }
      }
    }
    return events;
  }

  /**
   * Retirada: desde una casilla del borde, la unidad abandona el campo.
   * La máquina sobrevive con el daño que lleve; la batalla sigue sin ella
   * (perder así un contrato salva a la compañía, no al contrato).
   */
  private executeRetreat(unitId: string): BattleEvent[] {
    const unit = this.requireActive(unitId);
    const onEdge = footprintTiles(unit.position, unit.size).some((t) =>
      t.x === 0 || t.y === 0 || t.x === this.map.width - 1 || t.y === this.map.height - 1);
    if (!onEdge) throw new Error(`${unitId} no está en el borde del mapa`);

    unit.retreated = true;
    const events: BattleEvent[] = [
      { type: 'unit-retreated', unitId },
      ...this.afterDestruction(unit), // el comandante que se va deja al equipo sin red
      { type: 'turn-ended', unitId },
    ];
    this.activeUnitId = undefined;
    this.checkBattleEnd(events);
    return events;
  }

  /**
   * Eyección: el piloto salta y la máquina queda perdida donde está. Es la
   * decisión amarga — se pierde el metal para salvar a la persona (la capa
   * de campaña convierte esto en menos días de baja).
   */
  private executeEject(unitId: string): BattleEvent[] {
    const unit = this.requireActive(unitId);
    unit.ejected = true;
    unit.hp = 0;
    const events: BattleEvent[] = [
      { type: 'unit-ejected', unitId },
      { type: 'unit-destroyed', unitId },
      ...this.afterDestruction(unit),
      { type: 'turn-ended', unitId },
    ];
    this.activeUnitId = undefined;
    this.checkBattleEnd(events);
    return events;
  }

  /** Cambio de postura: acción libre — el turno sigue siendo tuyo. */
  private executeStance(unitId: string, stance: StanceId): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.stance === stance) return [];
    unit.stance = stance;
    return [{ type: 'stance-changed', unitId, stance }];
  }

  /**
   * Sobrecarga del reactor: acción LIBRE (el turno sigue siendo tuyo). Solo
   * las máquinas con reactor (energía + calor) pueden hacerlo; sin él, es un
   * no-op. El calor del enganche lo cobra strainSystem en onActionResolved.
   */
  private executeOverclock(unitId: string, on: boolean): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (!hasReactor(unit)) return [];
    if ((unit.overclocked ?? false) === on) return [];
    unit.overclocked = on;
    return [{ type: 'overclock-changed', unitId, on }];
  }

  /** Multiplicador de daño del disparo de vigilancia (apresurado). */
  private static readonly OVERWATCH_POWER_MULT = 0.75;

  /**
   * Vigilancia (XCOM): renuncia a actuar, termina el turno y queda al
   * acecho — disparará al PRIMER enemigo que se mueva a su alcance.
   */
  private executeOverwatch(unitId: string): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) throw new Error(`${unitId} ya actuó este turno`);
    unit.hasActed = true;
    unit.overwatch = true;
    // Vigilar es un disparo PLANEADO: cuesta tempo como una acción (si no,
    // saldría más barato que disparar y regalaría un tiro reactivo).
    unit.tempoSpent = (unit.tempoSpent ?? 0) + CT_ACT_LIGHT;
    const events: BattleEvent[] = [{ type: 'overwatch-set', unitId }];
    events.push(...this.executeWait(unitId));
    return events;
  }

  /**
   * Disparos de vigilancia contra una unidad que acaba de moverse. A
   * diferencia del tiro instintivo, es un disparo PLANEADO: exige alcance
   * y línea de visión reales, paga munición/energía/enfriamiento como
   * cualquier disparo, y pega al 75%. Un disparo por vigilancia; consume
   * también el reflejo del tirador (nada de doble castigo).
   */
  private overwatchShots(mover: UnitState): BattleEvent[] {
    const events: BattleEvent[] = [];
    const watchers = this.units.filter((u) =>
      u.team !== mover.team && u.hp > 0 && !u.retreated && u.overwatch &&
      !hasStatus(u, 'stunned') && !hasStatus(u, 'suprimido'));
    for (const watcher of watchers) {
      if (this.isOver || mover.hp <= 0 || mover.retreated) break;
      const abilityId = this.knownAbilityIds(watcher).find((id) => {
        const ability = this.abilityOf(id);
        if (!ability.effects.some((e) => e.kind === 'damage')) return false;
        if (!this.canTargetFrom(watcher, watcher.position, id, mover.position)) return false;
        return this.checkVetoes({
          type: 'ability', unitId: watcher.id, abilityId: id, target: mover.position,
        }) === null;
      });
      if (!abilityId) continue; // fuera de tiro: sigue al acecho

      watcher.overwatch = false;
      watcher.reactionReady = false;
      watcher.facing = facingTowards(watcher.position, mover.position);
      events.push({
        type: 'reaction', unitId: watcher.id, targetUnitId: mover.id,
        reaction: 'vigilancia', abilityId,
      });
      const entry = this.weaponEntry(watcher, abilityId);
      if (entry?.def.projectile) {
        const flightTime = manhattan(watcher.position, mover.position) / entry.def.projectile.velocity;
        events.push({
          type: 'projectile-fired', unitId: watcher.id, weaponId: entry.def.id,
          from: { ...watcher.position }, to: { ...mover.position },
          flightTime: Math.round(flightTime * 100) / 100,
        });
      }
      this.inReaction = true;
      try {
        events.push(...this.applyEffects(
          watcher, mover, this.abilityOf(abilityId), 0, Battle.OVERWATCH_POWER_MULT,
        ));
      } finally {
        this.inReaction = false;
      }
      events.push(...this.runSystems((s) => s.onActionResolved?.(
        { type: 'ability', unitId: watcher.id, abilityId, target: { ...mover.position } },
        watcher, this.systemContext)));
      if (this.checkBattleEnd(events)) break;
    }
    return events;
  }

  private executeWait(unitId: string, facing?: Facing): BattleEvent[] {
    const unit = this.requireActive(unitId);
    const events: BattleEvent[] = [];

    // Efectos de fin de turno de los sistemas (sobrecalentamiento hoy;
    // disipación de calor, regeneración de energía... en fases futuras),
    // seguidos de la expiración de estados.
    events.push(...this.runSystems((s) => s.onTurnEnd?.(unit, this.systemContext)));
    this.linkCommandDeaths(events); // fuego o DoT pudieron tumbar a un comandante
    for (const expired of tickStatuses(unit)) {
      events.push({ type: 'status-expired', targetUnitId: unit.id, status: expired.id });
    }

    if (facing) unit.facing = facing;

    // TEMPO como recurso: el turno cuesta la base más lo comprometido este
    // turno (mover, disparar, sobremarcha...). Esperar cuesta solo la base y
    // te adelanta; comprometer mucho te retrasa. Estilo FFT, ahora legible.
    const spent = CT_TURN_BASE + (unit.tempoSpent ?? 0);
    unit.ct -= spent;
    unit.tempoSpent = 0;
    events.push({ type: 'tempo-spent', unitId: unit.id, ct: unit.ct, delta: spent });

    events.push({ type: 'turn-ended', unitId: unit.id });
    this.activeUnitId = undefined;
    this.checkBattleEnd(events);
    return events;
  }

  // ── Internos ───────────────────────────────────────────────────────────

  /** Consecuencias de una destrucción: caída del comandante (fase 5). */
  private afterDestruction(unit: UnitState): BattleEvent[] {
    if (!unit.isCommander || this.linkLostTeams.has(unit.team)) return [];
    this.linkLostTeams.add(unit.team);
    return [{ type: 'command-link-lost', team: unit.team }];
  }

  /**
   * Cierra la consecuencia de mando para muertes conducidas por SISTEMAS
   * (fuego, apagado del reactor, DoT de sobrecalentamiento): esos sistemas
   * emiten unit-destroyed por su cuenta, saltándose afterDestruction. Aquí se
   * repara la asimetría con la ruta de daño de arma. afterDestruction es
   * idempotente (guarda linkLostTeams), así que reprocesar es inofensivo.
   */
  private linkCommandDeaths(events: BattleEvent[]): void {
    for (const e of events.filter((ev) => ev.type === 'unit-destroyed')) {
      if (e.type !== 'unit-destroyed') continue;
      events.push(...this.afterDestruction(this.unit(e.unitId)));
    }
  }

  private requireActive(unitId: string): UnitState {
    if (this.activeUnitId !== unitId) {
      throw new Error(`No es el turno de ${unitId}`);
    }
    const unit = this.unit(unitId);
    if (unit.hp <= 0) throw new Error(`${unitId} está destruida`);
    if (unit.retreated) throw new Error(`${unitId} ya se retiró del campo`);
    return unit;
  }

  /**
   * Despliega las oleadas cuya ronda haya llegado. Cada refuerzo entra en
   * su casilla pedida o, si está tomada, en la libre más cercana (búsqueda
   * determinista por anillos). Sin hueco en 6 anillos, ese refuerzo se
   * pierde — el campo está saturado.
   */
  private arriveReinforcements(): BattleEvent[] {
    const events: BattleEvent[] = [];
    const due = this.pendingReinforcements.filter((w) => w.round <= this.roundNumber);
    if (due.length === 0) return events;
    this.pendingReinforcements = this.pendingReinforcements.filter((w) => w.round > this.roundNumber);

    for (const wave of due) {
      const unitIds: string[] = [];
      for (const spawn of wave.spawns) {
        const def = this.definitionOf(spawn.unitTypeId);
        const anchor = this.findFreeAnchor(spawn.position, def.size ?? 1, def.moveType);
        if (!anchor) continue;
        const unit = this.buildUnit({ ...spawn, position: anchor });
        this.units.push(unit);
        unitIds.push(unit.id);
      }
      if (unitIds.length > 0) {
        events.push({ type: 'reinforcements-arrived', unitIds, round: this.roundNumber });
      }
    }
    return events;
  }

  /** Ancla libre más cercana a `want` donde quepa una huella de `size`. */
  private findFreeAnchor(want: Position, size: number, moveType: 'ground' | 'flying' | 'amphibious'): Position | null {
    for (let radius = 0; radius <= 6; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
          const anchor = { x: want.x + dx, y: want.y + dy };
          const stamp = footprintTiles(anchor, size);
          if (stamp.some((t) => !this.map.inBounds(t))) continue;
          if (stamp.some((t) => !isFinite(this.map.entryCost(t, moveType)))) continue;
          if (stamp.some((t) => this.unitAt(t) !== undefined)) continue;
          return anchor;
        }
      }
    }
    return null;
  }

  private assertKnowsAbility(unit: UnitState, abilityId: string): void {
    if (!this.knownAbilityIds(unit).includes(abilityId)) {
      throw new Error(`${unit.id} no conoce la habilidad ${abilityId}`);
    }
  }

  private checkBattleEnd(events: BattleEvent[]): boolean {
    if (this.isOver) return true;
    // Las oleadas pendientes cuentan como presentes: barrer la vanguardia
    // no termina una batalla cuyo grueso está en camino.
    const pending = (team: Team): boolean =>
      this.pendingReinforcements.some((w) => w.spawns.some((s) => s.team === team));
    const standing = (team: Team): boolean =>
      this.units.some((u) => u.team === team && u.hp > 0 && !u.retreated);
    const playerAlive = standing('player') || pending('player');
    const enemyAlive = standing('enemy') || pending('enemy');

    let winner: Team | undefined;
    if (!playerAlive) winner = 'enemy';
    else if (!enemyAlive) winner = 'player';
    else winner = this.objectiveOutcome();
    if (!winner) return false;

    this.winnerTeam = winner;
    this.activeUnitId = undefined;
    events.push({ type: 'battle-ended', winner: this.winnerTeam });
    return true;
  }

  /** Condiciones EXTRA del objetivo (la aniquilación ya se comprobó). */
  private objectiveOutcome(): Team | undefined {
    const objective = this.objectiveSpec;
    switch (objective.kind) {
      case 'eliminate':
        return undefined;
      case 'assassinate': {
        const target = this.units.find((u) => u.id === objective.targetUnitId);
        return target && target.hp <= 0 ? 'player' : undefined;
      }
      case 'protect': {
        const ward = this.units.find((u) => u.id === objective.wardUnitId);
        return !ward || ward.hp <= 0 ? 'enemy' : undefined;
      }
      case 'reach': {
        const arrived = this.units.some((u) =>
          u.team === 'player' && u.hp > 0 && !u.retreated &&
          (objective.unitId === undefined || u.id === objective.unitId) &&
          footprintTiles(u.position, u.size).some((t) => objective.zone.some((z) => samePos(z, t))));
        return arrived ? 'player' : undefined;
      }
      case 'survive':
        return this.roundNumber > objective.rounds ? 'player' : undefined;
    }
  }
}
