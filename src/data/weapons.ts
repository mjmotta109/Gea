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
    name: 'Strike Laser Claw',
    abilityId: 'strike-laser-claw',
    costs: { energy: 15, heat: 10 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-claws',
  },
  'w-charged-particle-gun': {
    id: 'w-charged-particle-gun',
    name: 'Cañón de partículas cargadas',
    abilityId: 'charged-particle-gun',
    // El arma definitoria del Geno: devastadora, pero recalienta el
    // chasis y exige un turno de enfriamiento entre disparos.
    costs: { energy: 30, heat: 45, cooldownTurns: 1 },
    magazine: 0,
    reserves: 0,
    mountSlot: 'weapon-cannon',
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
  },
};
