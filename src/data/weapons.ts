import type { WeaponDefinition } from '../core/types.js';

/**
 * Catálogo de armas montadas: envuelven habilidades del catálogo y les
 * añaden costes de energía/calor, munición y punto de montaje. Las
 * habilidades que no aparecen aquí siguen siendo innatas y gratuitas
 * (mandíbulas, garras sin sistema, equipo de apoyo).
 */
export const WEAPONS: Record<string, WeaponDefinition> = {
  'w-induction-claws': {
    id: 'w-induction-claws',
    name: 'Garras de inducción',
    abilityId: 'induction-claws',
    costs: { energy: 15, heat: 10 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-claws',
    spec: 'assault',
  },
  'w-fel-laser': {
    id: 'w-fel-laser',
    name: 'Láser de electrones libres',
    abilityId: 'fel-laser',
    // El arma definitoria del Prisma: devastadora, pero recalienta el
    // chasis y exige un turno de enfriamiento entre disparos.
    costs: { energy: 30, heat: 45, cooldownTurns: 1 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-cannon',
    spec: 'assault',
    // Haz de partículas: rapidísimo, sin dispersión, perfora blindaje.
    projectile: { velocity: 30, dispersion: 0, penetration: 4, caliber: 0, mass: 0, ricochet: false },
  },
  'w-antimateriel-rifle': {
    id: 'w-antimateriel-rifle',
    name: 'Fusil antimaterial',
    abilityId: 'antimateriel-rifle',
    costs: { heat: 5 },
    // Cargador corto a propósito: recargar forma parte del ritmo del
    // francotirador (dispara-dispara-recarga).
    magazine: 2,
    reserves: 3,
    spec: 'sniper',
    projectile: { velocity: 16, dispersion: 0, penetration: 3, caliber: 14, mass: 1, ricochet: false },
  },
  'w-heavy-recoilless': {
    id: 'w-heavy-recoilless',
    name: 'Cañón sin retroceso pesado',
    abilityId: 'recoilless-gun',
    costs: { heat: 10 },
    magazine: 3,
    reserves: 2,
    spec: 'defense',
    // Obús masivo: pierde puntería con la distancia pero EMPUJA al
    // objetivo una casilla (masa ≥ umbral de física, fase 4).
    projectile: { velocity: 8, dispersion: 2, penetration: 1, caliber: 120, mass: 4, ricochet: false },
  },
};
