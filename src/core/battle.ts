import {
  attackArc,
  computeDamage,
  damageRange,
  facingTowards,
  hitChance,
  proximityBonus,
  type AttackArc,
} from './combat.js';
import { GameMap, manhattan, posKey, samePos, TERRAIN_COVER } from './grid.js';
import { hasLineOfSight } from './los.js';
import { KNOCKBACK_MASS_THRESHOLD, knockbackDestination } from './physics.js';
import { aoeTiles, reachableTiles, targetableTiles, type ReachableTile } from './pathfinding.js';
import { applyModifiers } from './derived.js';
import {
  applyDamageToModule,
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
  heatModifiers,
  type ActionVeto,
  type BattleSystem,
  type SystemContext,
  type WeaponEntry,
} from './systems.js';
import { advanceToNextTurn, forecastTurnOrder } from './turn.js';
import {
  CT_THRESHOLD,
  type AbilityDefinition,
  type BattleAction,
  type BattleEvent,
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
} from './types.js';

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
}

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
  /** Pilotos por unidad (progresión, opt-in) y su tabla de perks. */
  pilots?: Record<string, PilotState>;
  perkTable?: PerkTable;
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

  constructor(config: BattleConfig) {
    // Clon propio: el terreno es destructible desde la fase 4 y los mapas
    // del catálogo no deben mutar entre batallas.
    this.map = config.map.clone();
    this.definitions = config.unitCatalog;
    this.abilities = config.abilityCatalog;
    this.modules = config.moduleCatalog ?? {};
    this.rng = new Rng(config.seed);
    this.weather = config.weather ?? 'clear';
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

    this.units = config.spawns.map((spawn) => {
      const def = this.definitionOf(spawn.unitTypeId);
      if (!this.map.inBounds(spawn.position)) {
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
      return {
        id: spawn.id,
        name: spawn.name,
        unitTypeId: spawn.unitTypeId,
        isCommander: spawn.commander ?? false,
        team: spawn.team,
        position: { ...spawn.position },
        facing: spawn.facing ?? (spawn.team === 'player' ? 'east' : 'west'),
        hp: spawn.hp !== undefined ? Math.max(1, Math.min(maxHp, Math.round(spawn.hp))) : maxHp,
        maxHpOverride: spawn.loadout?.slots ? maxHp : undefined,
        ...(spawn.modifiers && spawn.modifiers.length > 0
          ? { spawnModifiers: spawn.modifiers.map((m) => ({ ...m })) } : {}),
        ct: 0,
        statuses: [],
        hasMoved: false,
        hasActed: false,
        components: {
          ...(frameConfig ? { frame: buildFrameState(frameConfig, this.modules) } : {}),
          ...(def.energy ? {
            energy: {
              current: def.energy.capacity,
              capacity: def.energy.capacity,
              outputPerTurn: def.energy.outputPerTurn,
              boostedThisTurn: false,
            },
          } : {}),
          ...(def.heat ? {
            heat: { current: 0, max: def.heat.max, dissipationPerTurn: def.heat.dissipationPerTurn },
          } : {}),
          ...(weaponIds ? {
            arsenal: {
              weapons: weaponIds.map((weaponId) => {
                const weapon = this.weaponOf(weaponId);
                return { weaponId, ammo: weapon.magazine, reserves: weapon.reserves, cooldown: 0 };
              }),
            },
          } : {}),
        },
      };
    });

    const seen = new Set<string>();
    for (const u of this.units) {
      const key = posKey(u.position);
      if (seen.has(key)) throw new Error(`Dos unidades en ${key}`);
      seen.add(key);
    }
    this.systemContext.units = this.units;
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

  /** Habilidades utilizables: innatas de la definición + armas del arsenal. */
  knownAbilityIds(unit: UnitState): string[] {
    const def = this.definitionOf(unit.unitTypeId);
    const fromWeapons = unit.components.arsenal?.weapons.map(
      (w) => this.weaponOf(w.weaponId).abilityId,
    ) ?? [];
    return [...def.abilityIds, ...fromWeapons];
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
    return this.units.find((u) => u.hp > 0 && samePos(u.position, pos));
  }

  /**
   * Stats efectivas de una unidad: base de la definición + pipeline de
   * modificadores (docs/DESIGN.md §3.2). ÚNICA vía legítima de lectura de
   * stats en el motor, la IA y la UI — leer `definitionOf(...).stats`
   * directamente se salta los estados (y, en fases futuras, los módulos
   * dañados, el calor y la energía).
   */
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
    ];
    if (this.linkLostTeams.has(unit.team) && unit.hp > 0) {
      // Sin comandante, la coordinación del equipo se resiente (fase 5).
      mods.push({ source: 'comms:link-lost', stat: 'accuracy', add: -5 });
      mods.push({ source: 'comms:link-lost', stat: 'evade', add: -5 });
    }
    // Modificadores adjuntos al spawn (campañas: marcas, auras...).
    if (unit.spawnModifiers) mods.push(...unit.spawnModifiers);
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

  getActiveUnit(): UnitState | undefined {
    return this.activeUnitId ? this.unit(this.activeUnitId) : undefined;
  }

  /** Timeline de próximos turnos para la UI. */
  forecast(count = 8): string[] {
    return forecastTurnOrder(this.units, (u) => this.effectiveStats(u).speed, count);
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

      next.hasMoved = false;
      next.hasActed = false;
      this.activeUnitId = next.id;
      events.push({ type: 'turn-started', unitId: next.id });
      events.push(...this.runSystems((s) => s.onTurnStart?.(next, this.systemContext)));
      if (this.checkBattleEnd(events)) return events;

      // Un sistema pudo destruir a la unidad al abrir su turno (daño
      // interno por apagado de emergencia): se cierra sin acciones.
      if (next.hp <= 0) {
        this.activeUnitId = undefined;
        events.push({ type: 'turn-ended', unitId: next.id });
        continue;
      }

      if (hasStatus(next, 'stunned')) {
        // El turno se consume sin poder hacer nada.
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
    }, this.units).filter((t) => !samePos(t.pos, unit.position));
  }

  legalTargets(unitId: string, abilityId: string): Position[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) return [];
    const ability = this.abilityOf(abilityId);
    this.assertKnowsAbility(unit, abilityId);
    return targetableTiles(this.map, unit.position, ability.range, ability.minRange, ability.shape)
      .filter((pos) => hasLineOfSight(this.map, unit.position, pos));
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
    const dist = manhattan(user.position, victim.position);
    // Tormenta de arena: la puntería se degrada más allá del combate cercano.
    const weatherPenalty = this.weather === 'sandstorm' && dist > 2 ? 10 : 0;
    // Dispersión balística: los proyectiles pierden precisión con la distancia.
    const projectile = this.weaponEntry(user, ability.id)?.def.projectile;
    const dispersionPenalty = projectile ? Math.round(projectile.dispersion * dist) : 0;
    const chance = hitChance({
      accuracy: ability.accuracy - weatherPenalty - dispersionPenalty,
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
    const range = damageRange({
      attackerStats: this.effectiveStats(unit),
      defenderStats: this.effectiveStats(victim),
      power: damaging.power,
      damageType: damaging.damageType,
      arc,
      heightAdvantage,
    });
    return { chance, min: range.min, max: range.max, arc, heightAdvantage, cover, weatherPenalty };
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
        case 'ability': return this.executeAbility(action.unitId, action.abilityId, action.target);
        case 'boost': return this.executeBoost(action.unitId, action.to);
        case 'reload': return this.executeReload(action.unitId, action.weaponId);
        case 'wait': return this.executeWait(action.unitId, action.facing);
      }
    })();

    if (!this.isOver) {
      events.push(...this.runSystems((s) => s.onActionResolved?.(action, actor, this.systemContext)));
      this.checkBattleEnd(events);
    }
    return events;
  }

  private executeMove(unitId: string, to: Position): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasMoved) throw new Error(`${unitId} ya se movió este turno`);
    const option = this.legalMoves(unitId).find((t) => samePos(t.pos, to));
    if (!option) throw new Error(`Movimiento ilegal a ${to.x},${to.y}`);

    unit.position = { ...to };
    unit.facing = option.path.length > 1
      ? facingTowards(option.path[option.path.length - 2]!, to)
      : unit.facing;
    unit.hasMoved = true;
    return [{ type: 'unit-moved', unitId, path: option.path }];
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
    }, this.units).find((t) => !samePos(t.pos, unit.position) && samePos(t.pos, to));
    if (!option) throw new Error(`Boost ilegal a ${to.x},${to.y}`);

    unit.position = { ...to };
    unit.facing = option.path.length > 1
      ? facingTowards(option.path[option.path.length - 2]!, to)
      : unit.facing;
    energy.boostedThisTurn = true;
    return [{ type: 'unit-boosted', unitId, path: option.path }];
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
    state.ammo = def.magazine;
    state.reserves -= 1;
    return [{ type: 'weapon-reloaded', unitId, weaponId, ammo: state.ammo }];
  }

  private executeAbility(unitId: string, abilityId: string, target: Position): BattleEvent[] {
    const unit = this.requireActive(unitId);
    if (unit.hasActed) throw new Error(`${unitId} ya actuó este turno`);
    const ability = this.abilityOf(abilityId);
    this.assertKnowsAbility(unit, abilityId);
    const legal = this.legalTargets(unitId, abilityId).some((p) => samePos(p, target));
    if (!legal) throw new Error(`Objetivo ilegal para ${abilityId}: ${target.x},${target.y}`);

    unit.hasActed = true;
    unit.facing = samePos(unit.position, target) ? unit.facing : facingTowards(unit.position, target);

    const events: BattleEvent[] = [{ type: 'ability-used', unitId, abilityId, target }];

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
    const affected = blast
      .map((pos) => ({ victim: this.unitAt(pos), aoeDist: manhattan(pos, target) }))
      .filter((entry): entry is { victim: UnitState; aoeDist: number } => entry.victim !== undefined);

    for (const { victim, aoeDist } of affected) {
      const isAlly = victim.team === unit.team;
      const offensive = ability.effects.some((e) => e.kind === 'damage');
      if (offensive && isAlly && !ability.targetsAllies) continue;

      events.push(...this.applyEffects(unit, victim, ability, aoeDist));
      if (this.checkBattleEnd(events)) return events;
    }

    // Las explosiones derriban muros del área: escombros transitables
    // (y las líneas de visión que tapaban se abren — emergente).
    if (ability.aoeRadius > 0) {
      for (const pos of aoeTiles(this.map, target, ability.aoeRadius, true)) {
        if (this.map.tileAt(pos).terrain === 'wall') {
          this.map.demolish(pos);
          events.push({ type: 'terrain-destroyed', pos: { ...pos } });
        }
      }
    }
    return events;
  }

  private applyEffects(
    user: UnitState,
    target: UnitState,
    ability: AbilityDefinition,
    aoeDist = 0,
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
          const amount = computeDamage({
            attackerStats: userStats,
            defenderStats: targetStats,
            power: Math.round(effect.power * falloff),
            damageType: effect.damageType,
            arc,
            heightAdvantage,
          }, this.rng);
          const projectile = this.weaponEntry(user, ability.id)?.def.projectile;

          const frame = target.components.frame;
          if (frame) {
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
              frame, this.modules, location, amount, target.id, projectile?.penetration ?? 0,
            ));
            target.hp = deriveUnitHp(frame, this.modules);
            (events[damageEventIndex] as Extract<BattleEvent, { type: 'damage-dealt' }>).targetHp = target.hp;
          } else {
            target.hp = Math.max(0, target.hp - amount);
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
      }
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
    for (const expired of tickStatuses(unit)) {
      events.push({ type: 'status-expired', targetUnitId: unit.id, status: expired.id });
    }

    if (facing) unit.facing = facing;

    // Terminar el turno sin gastar todo devuelve algo de CT (estilo FFT):
    // la unidad vuelve antes si se limitó a esperar.
    let refund = 0;
    if (!unit.hasMoved && !unit.hasActed) refund = 20;
    else if (!unit.hasMoved || !unit.hasActed) refund = 10;
    unit.ct = unit.ct - CT_THRESHOLD + refund;

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

  private requireActive(unitId: string): UnitState {
    if (this.activeUnitId !== unitId) {
      throw new Error(`No es el turno de ${unitId}`);
    }
    const unit = this.unit(unitId);
    if (unit.hp <= 0) throw new Error(`${unitId} está destruida`);
    return unit;
  }

  private assertKnowsAbility(unit: UnitState, abilityId: string): void {
    if (!this.knownAbilityIds(unit).includes(abilityId)) {
      throw new Error(`${unit.id} no conoce la habilidad ${abilityId}`);
    }
  }

  private checkBattleEnd(events: BattleEvent[]): boolean {
    if (this.isOver) return true;
    const playerAlive = this.units.some((u) => u.team === 'player' && u.hp > 0);
    const enemyAlive = this.units.some((u) => u.team === 'enemy' && u.hp > 0);
    if (playerAlive && enemyAlive) return false;

    this.winnerTeam = playerAlive ? 'player' : 'enemy';
    this.activeUnitId = undefined;
    events.push({ type: 'battle-ended', winner: this.winnerTeam });
    return true;
  }
}
