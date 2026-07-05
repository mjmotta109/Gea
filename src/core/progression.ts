import type { BattleEvent, Position, StatModifier, Team } from './types.js';

/**
 * Progresión piloto/Zoid (decisiones de diseño en GAME-DESIGN.md):
 *
 *  - EL ZOID NO GANA EXPERIENCIA. Solo el piloto.
 *  - El piloto gana XP por PISTAS DE ESPECIALIZACIÓN según lo que hace en
 *    batalla: daño a corta distancia → asalto; a larga → tirador;
 *    reparar aliados → soporte; encajar daño y sobrevivir → defensa.
 *  - Cada pista sube por umbrales y otorga bonificaciones vía el pipeline
 *    de StatModifier (datos en src/data/progression.ts).
 *  - El Zoid "se especializa hacia el mismo lado" por la vía material:
 *    armas y módulos etiquetados con una especialización (`spec`) dan un
 *    BONUS DE SINERGIA cuando los lleva un piloto con nivel en esa pista.
 *
 * Todo es puro y determinista: la XP se calcula desde el log de eventos
 * de una batalla terminada, sin RNG. La persistencia es del cliente.
 */

export type SpecializationId = 'assault' | 'sniper' | 'support' | 'defense';

export const SPECIALIZATIONS: readonly SpecializationId[] = ['assault', 'sniper', 'support', 'defense'];

/** Estado persistente de un piloto (el cliente decide dónde guardarlo). */
export interface PilotState {
  id: string;
  name: string;
  /** XP acumulada por pista de especialización. */
  tracks: Record<SpecializationId, number>;
}

export function newPilot(id: string, name: string): PilotState {
  return { id, name, tracks: { assault: 0, sniper: 0, support: 0, defense: 0 } };
}

/** Umbrales de XP acumulada para cada nivel de pista (nivel = índice+1). */
export const TRACK_LEVEL_THRESHOLDS = [100, 260, 500, 820, 1220] as const;

export function trackLevel(xp: number): number {
  let level = 0;
  for (const threshold of TRACK_LEVEL_THRESHOLDS) {
    if (xp >= threshold) level++;
    else break;
  }
  return level;
}

/** Pista dominante del piloto (empates: orden fijo de SPECIALIZATIONS). */
export function dominantTrack(pilot: PilotState): SpecializationId {
  let best: SpecializationId = SPECIALIZATIONS[0]!;
  for (const spec of SPECIALIZATIONS) {
    if (pilot.tracks[spec] > pilot.tracks[best]) best = spec;
  }
  return best;
}

// ── Otorgamiento de XP desde los eventos de batalla ─────────────────────

/** XP por unidad de acción; números de partida, calibrables con datos. */
const XP_PER_DAMAGE = 0.5;          // por punto de daño infligido
const XP_PER_HEAL = 0.8;            // por punto reparado a un aliado
const XP_PER_ALLY_BUFF = 12;        // por estado aplicado a OTRO aliado
const XP_PER_KILL = 30;
const XP_PER_DAMAGE_TAKEN = 0.3;    // encajar castigo forja defensas
const XP_SURVIVE_VICTORY = 40;      // sobrevivir a una batalla ganada
/** Distancia Manhattan desde la que el daño cuenta como "tirador". */
const SNIPER_RANGE = 3;

export interface XpGain {
  pilotId: string;
  track: SpecializationId;
  amount: number;
}

/**
 * Reparte la XP de una batalla terminada entre los pilotos.
 */
export function awardXp(
  events: BattleEvent[],
  roster: Record<string, string>,
  unitTeams: Record<string, Team>,
  startPositions: Record<string, Position>,
  winner: Team | undefined,
  survivors: Set<string>,
): XpGain[] {
  const gains = new Map<string, XpGain>();
  const add = (unitId: string | undefined, track: SpecializationId, amount: number): void => {
    if (!unitId || amount <= 0) return;
    const pilotId = roster[unitId];
    if (!pilotId) return;
    const key = `${pilotId}:${track}`;
    const existing = gains.get(key);
    if (existing) existing.amount += amount;
    else gains.set(key, { pilotId, track, amount });
  };

  // Posición corriente de cada unidad, siguiendo el log.
  const positions = new Map<string, Position>(Object.entries(startPositions));
  const distance = (a?: Position, b?: Position): number =>
    a && b ? Math.abs(a.x - b.x) + Math.abs(a.y - b.y) : 1;

  let lastAttacker: string | undefined;
  /** Quien usó la última habilidad del turno: atribuye sus estados. Se
   *  limpia al abrir turno para no colarle el stun de un apagado. */
  let lastAbilityUser: string | undefined;
  for (const event of events) {
    switch (event.type) {
      case 'turn-started':
        lastAbilityUser = undefined;
        break;
      case 'ability-used':
        lastAbilityUser = event.unitId;
        break;
      case 'status-applied':
        // Buff a OTRO aliado = trabajo de soporte (cubrirse a uno mismo
        // es autoconservación y no puntúa).
        if (lastAbilityUser !== undefined &&
            lastAbilityUser !== event.targetUnitId &&
            unitTeams[lastAbilityUser] === unitTeams[event.targetUnitId]) {
          add(lastAbilityUser, 'support', XP_PER_ALLY_BUFF);
        }
        break;
      case 'unit-moved':
      case 'unit-boosted':
        positions.set(event.unitId, event.path[event.path.length - 1]!);
        break;
      case 'unit-pushed':
        positions.set(event.unitId, event.to);
        break;
      case 'damage-dealt': {
        lastAttacker = event.unitId;
        const dist = distance(positions.get(event.unitId), positions.get(event.targetUnitId));
        add(event.unitId, dist >= SNIPER_RANGE ? 'sniper' : 'assault', event.amount * XP_PER_DAMAGE);
        add(event.targetUnitId, 'defense', event.amount * XP_PER_DAMAGE_TAKEN);
        break;
      }
      case 'unit-healed':
        if (event.unitId !== event.targetUnitId) {
          add(event.unitId, 'support', event.amount * XP_PER_HEAL);
        }
        break;
      case 'unit-destroyed':
        if (lastAttacker && lastAttacker !== event.unitId) {
          const dist = distance(positions.get(lastAttacker), positions.get(event.unitId));
          add(lastAttacker, dist >= SNIPER_RANGE ? 'sniper' : 'assault', XP_PER_KILL);
        }
        break;
      default:
        break;
    }
  }

  if (winner) {
    for (const unitId of survivors) {
      if (unitTeams[unitId] === winner) add(unitId, 'defense', XP_SURVIVE_VICTORY);
    }
  }

  return [...gains.values()]
    .map((g) => ({ ...g, amount: Math.round(g.amount) }))
    .filter((g) => g.amount > 0)
    .sort((a, b) => a.pilotId.localeCompare(b.pilotId) || a.track.localeCompare(b.track));
}

/** Aplica ganancias sobre pilotos sin mutar los originales. */
export function applyXp(pilots: Record<string, PilotState>, gains: XpGain[]): Record<string, PilotState> {
  const result: Record<string, PilotState> = {};
  for (const [id, pilot] of Object.entries(pilots)) {
    result[id] = { ...pilot, tracks: { ...pilot.tracks } };
  }
  for (const gain of gains) {
    const pilot = result[gain.pilotId];
    if (pilot) pilot.tracks[gain.track] += gain.amount;
  }
  return result;
}

// ── Bonificaciones del piloto en batalla ─────────────────────────────────

export interface PerkTable {
  /** Modificadores por nivel de pista; el nivel N aplica los índices 0..N-1. */
  perks: Record<SpecializationId, StatModifier[][]>;
  /** Bonus por pieza/arma montada cuya spec coincide con la pista dominante. */
  synergy: Record<SpecializationId, StatModifier>;
  /** Máximo de piezas que cuentan para la sinergia. */
  synergyCap: number;
}

/**
 * Modificadores que un piloto aporta a la unidad que tripula: los perks
 * acumulados de todas sus pistas + la sinergia del equipo etiquetado con
 * su especialización dominante.
 */
export function pilotModifiers(
  pilot: PilotState,
  equippedSpecs: SpecializationId[],
  table: PerkTable,
): StatModifier[] {
  const mods: StatModifier[] = [];
  for (const spec of SPECIALIZATIONS) {
    const level = trackLevel(pilot.tracks[spec]);
    for (let i = 0; i < level; i++) {
      mods.push(...(table.perks[spec][i] ?? []));
    }
  }
  const dominant = dominantTrack(pilot);
  if (trackLevel(pilot.tracks[dominant]) > 0) {
    const matching = Math.min(
      table.synergyCap,
      equippedSpecs.filter((s) => s === dominant).length,
    );
    const bonus = table.synergy[dominant];
    for (let i = 0; i < matching; i++) mods.push(bonus);
  }
  return mods;
}
