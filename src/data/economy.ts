import type { EconomyTable } from '../game/mercenary.js';

/**
 * Tabla económica del modo mercenario. Los precios NO son arbitrarios:
 * derivan del ciclo de balance del hangar (npm run balance:hangar,
 * 1500 batallas, 2026-07-05) — tasa de victoria y daño medio mandan.
 * El König Wolf paga su 59.6% de victorias; la Molga es carne de cañón
 * barata a propósito.
 */
export const ECONOMY: EconomyTable = {
  startingCredits: 2500,
  starterRoster: ['liger-zero', 'command-wolf', 'gun-sniper', 'gustav'],
  repairCostPerHp: 2,
  rebuildFactor: 0.6,
  sellFactor: 0.5,

  zoidPrices: {
    'molga': 400,
    'gustav': 500,
    'guysak': 700,
    'rev-raptor': 700,
    'gordos': 900,
    'brachios': 900,
    'storm-sworder': 950,
    'redler': 1000,
    'zaber-fang': 1100,
    'shield-liger': 1200,
    'pteras': 1200,
    'command-wolf': 1250,
    'gun-sniper': 1300,
    'gun-sniper-naomi': 1400,
    'liger-zero': 1400,
    'blade-liger': 1500,
    'dibison': 1500,
    'iron-kong': 1600,
    'liger-zero-cas': 1500,
    'geno-saurer': 1800,
    'geno-saurer-cp': 1800,
    'gojulas': 1900,
    'konig-wolf': 2100,
  },

  weaponPrices: {
    // Base
    'w-strike-laser-claw': 400,
    'w-charged-particle-gun': 500,
    'w-sniper-rifle': 500,
    'w-impact-cannon': 300,
    // Anexo (uso y daño/uso medidos en el sweep)
    'lib-w-vibro-fang': 300,
    'lib-w-thermal-saber': 420,
    'lib-w-monomolecular-claw': 320,
    'lib-w-plasma-axe': 400,
    'lib-w-pile-bunker': 350,
    'lib-w-twin-autocannon': 360,
    'lib-w-plasma-carbine': 380,
    'lib-w-rail-lance': 450,
    'lib-w-heat-needle': 550,
    'lib-w-gauss-hammer': 450,
    'lib-w-micro-missile-swarm': 300,
    'lib-w-cluster-mortar': 250,
    'lib-w-thermobaric-rocket': 420,
    'lib-w-flak-burst': 320,
    'lib-w-field-repair-beam': 420,
    'lib-w-smoke-mortar': 220,
    'lib-w-barrier-projector': 350,
    'lib-w-ion-lance': 450,
    'lib-w-arc-emitter': 260,
    'lib-w-seismic-driver': 420,
  },
};

/** Pool de escuadras enemigas por contrato (todo el hangar menos apoyo puro). */
export const CONTRACT_ENEMY_POOL = [
  'molga', 'guysak', 'rev-raptor', 'gordos', 'redler', 'zaber-fang',
  'storm-sworder', 'shield-liger', 'pteras', 'command-wolf', 'gun-sniper',
  'dibison', 'blade-liger', 'iron-kong', 'geno-saurer', 'gojulas',
  'konig-wolf', 'brachios',
];
