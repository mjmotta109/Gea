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

/**
 * Dificultades de campaña. NO son esponjas de balas: nunca inflan el HP ni
 * cambian la matemática de combate. Cambian los recursos iniciales y, sobre
 * todo, el DESGASTE (`wear`): cuánto castiga el daño acumulado a una máquina
 * (puntería, evasión, movimiento por tramos de HP). Más difícil = cada
 * impacto pesa más, no que el enemigo aguante más. El determinismo es ley.
 */
export interface DifficultySpec {
  id: string;
  name: string;
  description: string;
  credits: number;
  supplies: number;
  /** Severidad del desgaste de combate (BattleConfig.wear). */
  wear: number;
  /**
   * Desplazamiento de la CURVA de competencia de la IA (se suma al progreso).
   * Negativo = la IA tarda más en espabilar (más fácil); positivo = arranca ya
   * coordinada (más difícil). Ausente = 0.
   */
  aiCurve?: number;
}

export const DIFFICULTIES: DifficultySpec[] = [
  {
    id: 'cadete', name: 'Cadete',
    description: 'Arcas llenas y despensa generosa. El daño apenas pasa factura, y el enemigo tarda en aprender tus mañas: para aprender el oficio.',
    credits: 3400, supplies: 12, wear: 0.5, aiCurve: -0.2,
  },
  {
    id: 'mercenario', name: 'Mercenario',
    description: 'Lo justo para empezar. Cada golpe deja marca y el enemigo va afinando su táctica contrato a contrato.',
    credits: 2500, supplies: 8, wear: 1, aiCurve: 0,
  },
  {
    id: 'leyenda', name: 'Leyenda',
    description: 'Deudas, hambre y máquinas que se desmoronan bajo el fuego. Y un enemigo que coordina y te contrarresta desde el primer día. Duele.',
    credits: 1600, supplies: 5, wear: 1.6, aiCurve: 0.35,
  },
];

/**
 * Chasis elegibles como COMPAÑERA al fundar la compañía (curados: sin
 * los pesos pesados — esos se ganan). El resto del equipo inicial es
 * fijo: Batidor, Aguja y Acémila.
 */
export const STARTER_COMPANIONS: Array<{ id: string; blurb: string }> = [
  { id: 'liger-zero', blurb: 'La equilibrada: rápida, fiable, honesta.' },
  { id: 'shield-liger', blurb: 'La escudera: aguanta lo que otras no.' },
  { id: 'zaber-fang', blurb: 'La cazadora: presiona de cerca con el autocañón.' },
  { id: 'rev-raptor', blurb: 'La navaja: frágil, veloz, letal si tú lo eres.' },
];

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
 * El Montero paga su 59.6% de victorias; la Oruga es carne de cañón
 * barata a propósito.
 */
export const ECONOMY: EconomyTable = {
  startingCredits: 2500,
  // Refuerzo de blindaje: 30 de búnker por ⌾400, reparar a ⌾3/punto; el
  // precio es ir 1 casilla más lento y cargar CT más despacio.
  reinforcement: { armor: 30, fitCost: 400, repairPerPoint: 3, movePenalty: 1, speedPenalty: 3 },
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
