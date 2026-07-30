import { GameMap } from './grid.js';
import type { DamageType, Facing, Position, Stats, UnitState } from './types.js';
import type { Rng } from './rng.js';

/** Dirección cardinal desde `from` hacia `to` (aproximada por el eje dominante). */
export function facingTowards(from: Position, to: Position): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'east' : 'west';
  }
  return dy >= 0 ? 'south' : 'north';
}

export type AttackArc = 'front' | 'side' | 'back';

const FACING_ORDER: Facing[] = ['north', 'east', 'south', 'west'];

/**
 * Arco desde el que el atacante golpea al defensor, según el facing del
 * defensor. Como en FFTA: atacar por la espalda es más certero y duele más.
 */
export function attackArc(attackerPos: Position, defenderPos: Position, defenderFacing: Facing): AttackArc {
  const incoming = facingTowards(defenderPos, attackerPos);
  const diff = Math.abs(FACING_ORDER.indexOf(incoming) - FACING_ORDER.indexOf(defenderFacing));
  const steps = Math.min(diff, 4 - diff);
  if (steps === 0) return 'front';
  if (steps === 2) return 'back';
  return 'side';
}

const ARC_ACCURACY_BONUS: Record<AttackArc, number> = { front: 0, side: 10, back: 25 };
const ARC_DAMAGE_MULT: Record<AttackArc, number> = { front: 1, side: 1.1, back: 1.25 };

/**
 * Penalización de puntería del atacante terrestre que dispara/golpea
 * mientras VADEA el agua: sin suelo firme, apuntar cuesta. Anfibios y
 * voladores están exentos (pelean bien en/sobre el agua).
 */
export const WATER_ATTACK_PENALTY = 20;

export interface CombatContext {
  map: GameMap;
  rng: Rng;
}

export interface HitCheckInput {
  /** Precisión base de la habilidad/arma. */
  accuracy: number;
  /** Corrección de puntería del atacante (stat `accuracy`, 0 = nominal). */
  attackerAccuracy: number;
  arc: AttackArc;
  defenderEvade: number;
  /** Bonus por cercanía (0 = nominal); lo calcula quien conoce el mapa. */
  proximityBonus?: number;
}

/**
 * Bonus de puntería por cercanía: +4% por cada casilla por debajo de 5,
 * hasta +16 a bocajarro. Acercarse siempre paga, alejarse nunca castiga
 * por sí solo (la dispersión balística ya lo hace por arma).
 */
export function proximityBonus(distance: number): number {
  return Math.max(0, (5 - distance) * 4);
}

/** Probabilidad final de impacto (5-99): la certeza no existe. */
export function hitChance(input: HitCheckInput): number {
  const raw = input.accuracy + input.attackerAccuracy
    + ARC_ACCURACY_BONUS[input.arc] - input.defenderEvade
    + (input.proximityBonus ?? 0);
  return Math.max(5, Math.min(99, raw));
}

export interface DamageInput {
  attackerStats: Stats;
  defenderStats: Stats;
  power: number;
  damageType: DamageType;
  arc: AttackArc;
  /** Altura del atacante menos la del defensor: pegar desde arriba bonifica. */
  heightAdvantage: number;
}

/**
 * Daño antes de la varianza: (atk del tipo + power) mitigado por la
 * defensa del tipo, con multiplicadores por arco y ventaja de altura.
 * El orden de multiplicación es parte del contrato (golden master).
 */
function baseDamage(input: DamageInput): number {
  const attackStat = input.damageType === 'physical'
    ? input.attackerStats.atk
    : input.attackerStats.energyAtk;
  const defenseStat = input.damageType === 'physical'
    ? input.defenderStats.def
    : input.defenderStats.energyDef;

  const base = (attackStat + input.power) * (100 / (100 + defenseStat));
  const heightMult = 1 + Math.max(-0.2, Math.min(0.2, input.heightAdvantage * 0.1));
  return base * ARC_DAMAGE_MULT[input.arc] * heightMult;
}

/**
 * LA LEY DEL CASCO: ningún impacto limpio mata a una máquina entera.
 * Un golpe directo inflige como MUCHO esta fracción del casco máximo
 * del objetivo — por sano que estés, el primer golpe te deja ventana
 * para reaccionar (retirarte, curarte, eyectar); el segundo sí mata.
 * Es simétrica (tus armas tampoco borran de un tiro) y se refleja en
 * el pronóstico: consecuencia anunciada. El daño acumulado, el fuego y
 * la caída de módulos quedan fuera: la ley es del IMPACTO.
 */
export const MAX_HIT_FRACTION = 0.7;

/** Tope de daño de un golpe directo contra un casco de `maxHp`. */
export function maxHitCap(maxHp: number): number {
  return Math.max(1, Math.floor(maxHp * MAX_HIT_FRACTION));
}

/**
 * Fórmula de daño del motor: baseDamage con varianza ±10%.
 */
export function computeDamage(input: DamageInput, rng: Rng): number {
  const variance = 0.9 + rng.next() * 0.2;
  return Math.max(1, Math.round(baseDamage(input) * variance));
}

/**
 * Pronóstico de daño para UI/IA: los extremos de la varianza, sin tirar
 * el dado. computeDamage siempre cae dentro de [min, max].
 */
export function damageRange(input: DamageInput): { min: number; max: number } {
  const base = baseDamage(input);
  return {
    min: Math.max(1, Math.round(base * 0.9)),
    max: Math.max(1, Math.round(base * 1.1)),
  };
}
