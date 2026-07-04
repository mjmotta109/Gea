import { attackArc, computeDamage, facingTowards, hitChance } from './combat.js';
import { GameMap, manhattan, posKey, samePos } from './grid.js';
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
import { applyStatus, hasStatus, statusModifiers, tickStatuses } from './status.js';
import { defaultSystems, type BattleSystem, type SystemContext } from './systems.js';
import { advanceToNextTurn, forecastTurnOrder } from './turn.js';
import {
  CT_THRESHOLD,
  type AbilityDefinition,
  type BattleAction,
  type BattleEvent,
  type Facing,
  type Position,
  type Stats,
  type Team,
  type UnitState,
  type UnitDefinition,
} from './types.js';

export interface UnitSpawn {
  id: string;
  /** Nombre del piloto/unidad concreta; el chasis pone el resto. */
  name: string;
  unitTypeId: string;
  team: Team;
  position: Position;
  facing?: Facing;
}

export interface BattleConfig {
  map: GameMap;
  spawns: UnitSpawn[];
  unitCatalog: Record<string, UnitDefinition>;
  abilityCatalog: Record<string, AbilityDefinition>;
  /** Catálogo de módulos; solo necesario si alguna unidad define frame. */
  moduleCatalog?: ModuleCatalog;
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
  private definitions: Record<string, UnitDefinition>;
  private abilities: Record<string, AbilityDefinition>;
  private modules: ModuleCatalog;
  private rng: Rng;
  private activeUnitId: string | undefined;
  private winnerTeam: Team | undefined;
  private systems: BattleSystem[];
  private systemContext: SystemContext;

  constructor(config: BattleConfig) {
    this.map = config.map;
    this.definitions = config.unitCatalog;
    this.abilities = config.abilityCatalog;
    this.modules = config.moduleCatalog ?? {};
    this.rng = new Rng(config.seed);
    this.systems = config.systems ?? defaultSystems();
    this.systemContext = {
      effectiveStats: (u) => this.effectiveStats(u),
      units: [],
    };

    this.units = config.spawns.map((spawn) => {
      const def = this.definitionOf(spawn.unitTypeId);
      if (!this.map.inBounds(spawn.position)) {
        throw new Error(`Spawn de ${spawn.id} fuera del mapa`);
      }
      if (def.frame) {
        const sum = frameMaxHp(def.frame, this.modules);
        if (sum !== def.stats.maxHp) {
          throw new Error(
            `maxHp de ${def.id} (${def.stats.maxHp}) no coincide con la suma de módulos (${sum})`,
          );
        }
      }
      return {
        id: spawn.id,
        name: spawn.name,
        unitTypeId: spawn.unitTypeId,
        team: spawn.team,
        position: { ...spawn.position },
        facing: spawn.facing ?? (spawn.team === 'player' ? 'east' : 'west'),
        hp: def.stats.maxHp,
        ct: 0,
        statuses: [],
        hasMoved: false,
        hasActed: false,
        components: def.frame ? { frame: buildFrameState(def.frame, this.modules) } : {},
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
    const base = this.definitionOf(unit.unitTypeId).stats;
    const frame = unit.components.frame;
    const mods = frame
      ? [...frameModifiers(frame, this.modules), ...statusModifiers(unit)]
      : statusModifiers(unit);
    return applyModifiers(base, mods);
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
    return targetableTiles(this.map, unit.position, ability.range, ability.minRange, ability.shape);
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
    const affected = aoeTiles(this.map, target, ability.aoeRadius)
      .map((pos) => this.unitAt(pos))
      .filter((u): u is UnitState => u !== undefined);

    for (const victim of affected) {
      const isAlly = victim.team === unit.team;
      const offensive = ability.effects.some((e) => e.kind === 'damage');
      if (offensive && isAlly && !ability.targetsAllies) continue;

      events.push(...this.applyEffects(unit, victim, ability));
      if (this.checkBattleEnd(events)) return events;
    }
    return events;
  }

  private applyEffects(user: UnitState, target: UnitState, ability: AbilityDefinition): BattleEvent[] {
    const events: BattleEvent[] = [];
    const userStats = this.effectiveStats(user);
    const targetStats = this.effectiveStats(target);
    const arc = attackArc(user.position, target.position, target.facing);
    const friendly = target.team === user.team;

    for (const effect of ability.effects) {
      if (target.hp <= 0) break;

      switch (effect.kind) {
        case 'damage': {
          const chance = friendly
            ? 100
            : hitChance({
                accuracy: ability.accuracy,
                attackerAccuracy: userStats.accuracy,
                arc,
                defenderEvade: targetStats.evade,
              });
          if (!this.rng.roll(chance)) {
            events.push({ type: 'ability-missed', unitId: user.id, targetUnitId: target.id });
            break;
          }
          const heightAdvantage =
            this.map.tileAt(user.position).height - this.map.tileAt(target.position).height;
          const amount = computeDamage({
            attackerStats: userStats,
            defenderStats: targetStats,
            power: effect.power,
            damageType: effect.damageType,
            arc,
            heightAdvantage,
          }, this.rng);

          const frame = target.components.frame;
          if (frame) {
            // Daño localizado: se elige el módulo golpeado y su armadura
            // absorbe antes de tocar HP; el exceso desborda al núcleo.
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
            events.push(...applyDamageToModule(frame, this.modules, location, amount, target.id));
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

  private requireActive(unitId: string): UnitState {
    if (this.activeUnitId !== unitId) {
      throw new Error(`No es el turno de ${unitId}`);
    }
    const unit = this.unit(unitId);
    if (unit.hp <= 0) throw new Error(`${unitId} está destruida`);
    return unit;
  }

  private assertKnowsAbility(unit: UnitState, abilityId: string): void {
    if (!this.definitionOf(unit.unitTypeId).abilityIds.includes(abilityId)) {
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
