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
}

/** Probabilidad final de impacto (0-100), sin tirar el dado. */
export function hitChance(input: HitCheckInput): number {
  const raw = input.accuracy + input.attackerAccuracy
    + ARC_ACCURACY_BONUS[input.arc] - input.defenderEvade;
  return Math.max(5, Math.min(100, raw));
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
 * Fórmula de daño base del motor:
 *   base = (atk del tipo + power) * mitigación por defensa del tipo
 *   luego multiplicadores por arco y ventaja de altura, y varianza ±10%.
 */
export function computeDamage(input: DamageInput, rng: Rng): number {
  const attackStat = input.damageType === 'physical'
    ? input.attackerStats.atk
    : input.attackerStats.energyAtk;
  const defenseStat = input.damageType === 'physical'
    ? input.defenderStats.def
    : input.defenderStats.energyDef;

  const base = (attackStat + input.power) * (100 / (100 + defenseStat));
  const heightMult = 1 + Math.max(-0.2, Math.min(0.2, input.heightAdvantage * 0.1));
  const variance = 0.9 + rng.next() * 0.2;
  const total = base * ARC_DAMAGE_MULT[input.arc] * heightMult * variance;
  return Math.max(1, Math.round(total));
}
