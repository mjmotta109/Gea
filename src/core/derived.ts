import type { StatModifier, Stats } from './types.js';

/**
 * Pipeline de stats derivadas: la clave de bóveda de la evolución del motor
 * (docs/DESIGN.md §3.2).
 *
 * Toda stat efectiva se calcula aplicando una lista de modificadores sobre
 * las stats base de la definición de la unidad. Los sistemas (estados hoy;
 * módulos y frames desde la fase 1; calor y energía en fases futuras) no
 * tocan stats directamente: aportan StatModifier y este módulo los combina
 * con orden determinista. El tipo StatModifier vive en types.ts.
 */
export type { StatModifier } from './types.js';

/**
 * Stats que son correcciones con signo y pueden ser legítimamente
 * negativas (p. ej. puntería con los sensores destruidos). El resto se
 * recorta a ≥0.
 */
const SIGNED_STATS: ReadonlySet<keyof Stats> = new Set(['accuracy']);

/**
 * Aplica modificadores sobre unas stats base.
 *
 * Orden fijo e independiente del orden de llegada dentro de cada categoría:
 * primero se suman todos los aditivos, después se multiplican todos los
 * multiplicativos. Así `a+10` y `a*1.5` conmutan igual que en los sistemas
 * de FFT/BattleTech y el determinismo no depende de quién registró antes.
 * El resultado se redondea al entero más cercano y, salvo las stats con
 * signo (SIGNED_STATS), nunca baja de 0.
 */
export function applyModifiers(base: Stats, modifiers: StatModifier[]): Stats {
  if (modifiers.length === 0) return base;

  const result: Stats = { ...base };
  for (const mod of modifiers) {
    if (mod.add !== undefined) {
      result[mod.stat] += mod.add;
    }
  }
  for (const mod of modifiers) {
    if (mod.mult !== undefined) {
      result[mod.stat] *= mod.mult;
    }
  }
  for (const key of Object.keys(result) as Array<keyof Stats>) {
    const rounded = Math.round(result[key]);
    result[key] = SIGNED_STATS.has(key) ? rounded : Math.max(0, rounded);
  }
  return result;
}
