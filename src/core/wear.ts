import type { Stats, StatModifier } from './types.js';

/**
 * Desgaste de combate: cada impacto DEJA MARCA. No es más HP (nada de
 * esponjas de balas): a medida que cae el HP, la máquina apunta peor,
 * esquiva peor y se mueve menos — escalonado, legible y con opciones (el
 * piloto decide si aguanta, se repliega o cambia de postura). La dificultad
 * escala la SEVERIDAD, no los números base. Función pura del HP: sin azar,
 * determinismo intacto. Con severidad 0 no hace nada (golden master a salvo).
 */

/** Fracción de HP por debajo de la cual la máquina está CASTIGADA. */
export const WEAR_BRUISED_FRACTION = 0.66;
/** Fracción por debajo de la cual está MALHERIDA (desgaste severo). */
export const WEAR_CRIPPLED_FRACTION = 0.33;

export type WearTier = 'entera' | 'castigada' | 'malherida';

/** En qué tramo de desgaste está la máquina según su HP. */
export function wearTier(hp: number, maxHp: number): WearTier {
  if (maxHp <= 0) return 'entera';
  const frac = hp / maxHp;
  if (frac <= WEAR_CRIPPLED_FRACTION) return 'malherida';
  if (frac <= WEAR_BRUISED_FRACTION) return 'castigada';
  return 'entera';
}

/** Castigo base (a severidad 1) por tramo: puntería, evasión, movimiento. */
const WEAR_PENALTY: Record<Exclude<WearTier, 'entera'>, Partial<Record<keyof Stats, number>>> = {
  castigada: { accuracy: -6, evade: -4, move: -1 },
  malherida: { accuracy: -14, evade: -8, move: -2 },
};

/**
 * Modificadores de desgaste para el pipeline de stats. `severity` (0 = sin
 * desgaste) la fija la dificultad de campaña vía BattleConfig.wear; el motor
 * genérico no sabe de dificultad. El movimiento nunca baja de 0 (lo acota el
 * pipeline) y la puntería puede quedar negativa (stat con signo).
 */
export function wearModifiers(hp: number, maxHp: number, severity: number): StatModifier[] {
  if (severity <= 0 || hp <= 0) return [];
  const tier = wearTier(hp, maxHp);
  if (tier === 'entera') return [];
  const penalty = WEAR_PENALTY[tier];
  const mods: StatModifier[] = [];
  for (const [stat, base] of Object.entries(penalty)) {
    const add = Math.round(base * severity);
    if (add !== 0) mods.push({ source: `wear:${tier}`, stat: stat as keyof Stats, add });
  }
  return mods;
}
