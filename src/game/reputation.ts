/*
 * Reputación entre la compañía y las facciones de la región.
 *
 * Sistema DEFINITIVO con contenido provisional (src/data/factions.ts).
 * Puro y determinista: la reputación vive en CampaignState.reputation
 * (facción → valor −100..+100, ausente = 0) y solo cambia por
 * decisiones visibles del jugador — nunca por dados escondidos.
 */

export type ReputationMap = Record<string, number>;

export const REPUTATION_MIN = -100;
export const REPUTATION_MAX = 100;

/** Cambio de reputación con una facción (clava el resultado al rango). */
export function adjustReputation(reputation: ReputationMap, factionId: string, delta: number): ReputationMap {
  const current = reputation[factionId] ?? 0;
  const value = Math.max(REPUTATION_MIN, Math.min(REPUTATION_MAX, current + delta));
  return { ...reputation, [factionId]: value };
}

export interface ReputationTier {
  id: 'odiado' | 'hostil' | 'neutral' | 'apreciado' | 'aliado';
  label: string;
  min: number;
}

/** Tramos de trato. El orden importa: se toma el primero que alcance. */
export const REPUTATION_TIERS: ReputationTier[] = [
  { id: 'aliado', label: 'Aliado', min: 40 },
  { id: 'apreciado', label: 'Apreciado', min: 10 },
  { id: 'neutral', label: 'Neutral', min: -9 },
  { id: 'hostil', label: 'Hostil', min: -39 },
  { id: 'odiado', label: 'Odiado', min: REPUTATION_MIN },
];

export function reputationTier(value: number): ReputationTier {
  return REPUTATION_TIERS.find((tier) => value >= tier.min) ?? REPUTATION_TIERS[REPUTATION_TIERS.length - 1]!;
}
