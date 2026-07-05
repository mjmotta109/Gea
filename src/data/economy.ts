import type { EconomyTable } from '../game/mercenary.js';

/** Parámetros de servicio por nivel de ciudad (1 = aldea, 3 = capital). */
export interface CityTier {
  /** Coste de reparación por HP (el taller propio cobra 2). */
  repairCostPerHp: number;
  /** Hasta qué fracción del maxHp sabe reparar este taller. */
  repairCapRatio: number;
  /** Estrés que alivia un día de descanso, y su precio (equipo entero). */
  restRelief: number;
  restCost: number;
  /** Precio del suministro y tasa de venta de la bodega. */
  supplyPrice: number;
  cargoRate: number;
  /** Descuento de fábrica sobre el precio de catálogo (0.25 = −25%). */
  factoryDiscount: number;
}

export const CITY_TIERS: Record<1 | 2 | 3, CityTier> = {
  // Aldea: barata y voluntariosa, pero el taller no hace milagros y el
  // catre es duro.
  1: { repairCostPerHp: 1.5, repairCapRatio: 0.7, restRelief: 15, restCost: 40, supplyPrice: 50, cargoRate: 0.8, factoryDiscount: 0.15 },
  // Ciudad: servicio completo a precio justo.
  2: { repairCostPerHp: 2.5, repairCapRatio: 1, restRelief: 30, restCost: 110, supplyPrice: 40, cargoRate: 1, factoryDiscount: 0.25 },
  // Capital: lo mejor de lo mejor, y lo cobra.
  3: { repairCostPerHp: 3.5, repairCapRatio: 1, restRelief: 50, restCost: 240, supplyPrice: 35, cargoRate: 1.15, factoryDiscount: 0.3 },
};

/**
 * Desahogos disponibles en las ciudades (además de la pensión por nivel).
 * Cada uno alivia estrés a TODO el equipo, cuesta un día, y tiene su
 * carácter: la vela es gratis y humilde; la cantina es barata pero
 * cuenta parrandas (4 → manía Juerguista) y a veces la ronda se alarga;
 * la casa de placer es cara, discreta y muy eficaz.
 */
export interface LeisureOption {
  id: string;
  name: string;
  minLevel: 1 | 2 | 3;
  cost: number;
  relief: number;
  flavor: string;
  /** La cantina: cuenta parrandas y puede alargarse la ronda (+50%). */
  rowdy?: boolean;
}

export const LEISURE_OPTIONS: LeisureOption[] = [
  {
    id: 'vela', name: 'Vela junto al núcleo', minLevel: 1, cost: 0, relief: 8,
    flavor: 'Una noche en silencio junto a la máquina. Gratis, y a veces basta.',
  },
  {
    id: 'cantina', name: 'Cantina: alcohol y parranda', minLevel: 1, cost: 60, relief: 25,
    flavor: 'Barato y ruidoso. La cuenta a veces crece sola, y las costumbres también.',
    rowdy: true,
  },
  {
    id: 'farol', name: 'Casa Farol Rojo', minLevel: 2, cost: 180, relief: 40,
    flavor: 'Discreción, sábanas limpias y nadie pregunta por la guerra.',
  },
];

/** El consultorio: terapia que REENCUADRA una manía (no la borra). */
export const THERAPY = {
  minLevel: 2 as 1 | 2 | 3,
  cost: 350,
  days: 2,
  stressRelief: 20,
};

/** Planos de módulos aftermarket (se compran una vez, en fábricas de piezas). */
export const BLUEPRINT_PRICES: Record<string, number> = {
  'am-sniper-sensor': 380,
  'am-armored-head': 350,
  'am-assault-boosters': 400,
  'am-shield-pack': 320,
  'am-recoil-dampers': 300,
  'am-heavy-claws': 450,
};

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
  supplyPrice: 40,
  startingSupplies: 8,
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
