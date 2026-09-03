import type { WeaponDefinition } from '../core/types.js';

/**
 * Catálogo de armas montadas: envuelven habilidades del catálogo y les
 * añaden costes de energía/calor, munición y punto de montaje. Las
 * habilidades que no aparecen aquí siguen siendo innatas y gratuitas
 * (mordiscos, garras sin sistema, equipo de apoyo).
 */
export const WEAPONS: Record<string, WeaponDefinition> = {
  'w-strike-laser-claw': {
    id: 'w-strike-laser-claw',
    name: 'Zarpazo de plasma',
    abilityId: 'strike-laser-claw',
    costs: { energy: 15, heat: 10 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-claws',
    spec: 'assault',
  },
  'w-charged-particle-gun': {
    id: 'w-charged-particle-gun',
    name: 'Cañón de fisura',
    abilityId: 'charged-particle-gun',
    // El arma definitoria del Geno: devastadora, pero recalienta el
    // chasis y exige un turno de enfriamiento entre disparos.
    costs: { energy: 30, heat: 45, cooldownTurns: 1 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-cannon',
    spec: 'assault',
    // Haz de partículas: rapidísimo, sin dispersión, perfora blindaje.
    projectile: { velocity: 30, dispersion: 0, penetration: 4, caliber: 0, mass: 0, ricochet: false },
  },
  'w-sniper-rifle': {
    id: 'w-sniper-rifle',
    name: 'Rifle de largo alcance',
    abilityId: 'sniper-rifle',
    costs: { heat: 5 },
    // Cargador corto a propósito: recargar forma parte del ritmo del
    // francotirador (dispara-dispara-recarga).
    magazine: 2,
    reserves: 3,
    spec: 'sniper',
    projectile: { velocity: 16, dispersion: 0, penetration: 3, caliber: 14, mass: 1, ricochet: false },
  },
  'w-impact-cannon': {
    id: 'w-impact-cannon',
    name: 'Cañón de impacto pesado',
    abilityId: 'shock-cannon',
    costs: { heat: 10 },
    magazine: 3,
    reserves: 2,
    spec: 'defense',
    // Obús masivo: pierde puntería con la distancia pero EMPUJA al
    // objetivo una casilla (masa ≥ umbral de física, fase 4).
    projectile: { velocity: 8, dispersion: 2, penetration: 1, caliber: 120, mass: 4, ricochet: false },
  },
};
