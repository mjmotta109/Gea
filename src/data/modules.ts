import type { ModuleDefinition, Stats } from '../core/types.js';

/**
 * Catálogo de módulos para los frames de los Yantras.
 *
 * DOS convenciones conviven:
 *  1. Frames "núcleo desnudo" (Centella-M, Prisma-M): las stats base
 *     del chasis son el núcleo y los módulos aportan el resto vía contributions;
 *     base + módulos intactos = versión monocasco (hay test de equivalencia).
 *  2. Frames de combate A MEDIDA (`struct`, 2026-07-09): el chasis conserva sus
 *     stats base COMPLETAS y el módulo es CARCASA pura (contributions: [], armor
 *     0 para no mitigar doble). Da daño localizado con identidad —HP repartido,
 *     placas que se arrancan, secuela al perder una pieza— sin recalibrar stats.
 */

/** Módulo estructural (convención 2): carcasa con HP, placa y una secuela. */
function struct(
  id: string,
  name: string,
  hp: number,
  o: { plate: number; hit: number; tags: string[]; crit?: boolean; pen?: Array<[keyof Stats, number]> },
): ModuleDefinition {
  return {
    id, name, hp, armor: 0, plating: o.plate, weight: hp, hitWeight: o.hit,
    critical: o.crit ?? false, contributions: [],
    onDestroyed: (o.pen ?? []).map(([stat, add]) => ({ source: `module:${id}`, stat, add })),
    tags: o.tags,
  };
}

/**
 * Frames de combate A MEDIDA: 7 chasis comunes ganan daño localizado con
 * identidad. El HP de las piezas SUMA exactamente el maxHp del chasis (lo
 * exige el motor). Las secuelas (onDestroyed) cuentan la avería: sin patas
 * frenas y desapuntas, sin ala no esquivas, sin cañón pierdes tu pegada.
 */
const COMBAT_FRAME_MODULES: Record<string, ModuleDefinition> = {
  // ── Centella (120): felino de asalto, garras devastadoras ──────────
  'ce-casco': struct('ce-casco', 'Cabeza sensora', 12, { plate: 4, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'ce-nucleo': struct('ce-nucleo', 'Torso y núcleo', 44, { plate: 14, hit: 40, tags: ['high-profile'], crit: true }),
  'ce-tren-del': struct('ce-tren-del', 'Tren delantero', 16, { plate: 5, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'ce-tren-tras': struct('ce-tren-tras', 'Tren trasero', 16, { plate: 5, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'ce-garras': struct('ce-garras', 'Garras de inducción', 16, { plate: 4, hit: 12, tags: ['weapon'], pen: [['atk', -18], ['energyAtk', -20]] }),
  'ce-lomo': struct('ce-lomo', 'Propulsores de lomo', 16, { plate: 4, hit: 10, tags: ['rear-exposed'], pen: [['evade', -8]] }),

  // ── Rastreador (100): escaramuza, cañón dorsal expuesto ────────────
  'ra-casco': struct('ra-casco', 'Cabeza sensora', 10, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -18]] }),
  'ra-nucleo': struct('ra-nucleo', 'Torso y núcleo', 40, { plate: 12, hit: 40, tags: ['high-profile'], crit: true }),
  'ra-patas-del': struct('ra-patas-del', 'Patas delanteras', 15, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'ra-patas-tras': struct('ra-patas-tras', 'Patas traseras', 15, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'ra-canon': struct('ra-canon', 'Cañón dorsal', 20, { plate: 5, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -12], ['energyAtk', -15]] }),

  // ── Visor (80): cristal; la cola-sensor da la puntería ──────────
  'vi-sensor': struct('vi-sensor', 'Cabeza de puntería', 8, { plate: 2, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'vi-nucleo': struct('vi-nucleo', 'Torso y núcleo', 30, { plate: 8, hit: 40, tags: ['high-profile'], crit: true }),
  'vi-patas': struct('vi-patas', 'Patas de salto', 16, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['evade', -4]] }),
  'vi-cola': struct('vi-cola', 'Cola estabilizadora', 12, { plate: 3, hit: 14, tags: ['rear-exposed', 'sensor'], pen: [['accuracy', -15]] }),
  'vi-rifle': struct('vi-rifle', 'Fusil antimaterial', 14, { plate: 3, hit: 10, tags: ['weapon'], pen: [['atk', -20]] }),

  // ── Baluarte (200): muralla; el HP vive en el núcleo ──────────────────
  'ba-casco': struct('ba-casco', 'Cabeza acorazada', 16, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'ba-nucleo': struct('ba-nucleo', 'Torso y reactor', 96, { plate: 10, hit: 45, tags: ['high-profile'], crit: true }),
  'ba-patas': struct('ba-patas', 'Patas de asedio', 34, { plate: 5, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'ba-misiles': struct('ba-misiles', 'Cohetes guiados', 30, { plate: 4, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -14]] }),
  'ba-coraza': struct('ba-coraza', 'Coraza lateral', 24, { plate: 5, hit: 12, tags: ['high-profile'], pen: [['def', -8]] }),

  // ── Martinete (190): gorila; mochila de misiles a la espalda ─────────
  'ma-casco': struct('ma-casco', 'Cabeza sensora', 14, { plate: 4, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'ma-nucleo': struct('ma-nucleo', 'Torso y núcleo', 98, { plate: 22, hit: 42, tags: ['high-profile'], crit: true }),
  'ma-brazos': struct('ma-brazos', 'Brazos de impacto', 34, { plate: 8, hit: 14, tags: ['weapon'], pen: [['atk', -18]] }),
  'ma-piernas': struct('ma-piernas', 'Piernas hidráulicas', 34, { plate: 8, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -1], ['accuracy', -6]] }),
  'ma-mochila': struct('ma-mochila', 'Mochila de misiles', 30, { plate: 7, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -10]] }),

  // ── Cometa (100): volador; alas frágiles y fáciles de acertar ────────
  'co-casco': struct('co-casco', 'Morro sensor', 10, { plate: 2, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'co-fuselaje': struct('co-fuselaje', 'Fuselaje y núcleo', 40, { plate: 10, hit: 38, tags: ['high-profile'], crit: true }),
  'co-ala-izq': struct('co-ala-izq', 'Ala izquierda', 18, { plate: 3, hit: 16, tags: ['low-profile'], pen: [['evade', -12], ['move', -2]] }),
  'co-ala-der': struct('co-ala-der', 'Ala derecha', 18, { plate: 3, hit: 16, tags: ['low-profile'], pen: [['evade', -12], ['move', -2]] }),
  'co-cola': struct('co-cola', 'Cola de timón', 14, { plate: 3, hit: 12, tags: ['rear-exposed'], pen: [['accuracy', -10]] }),

  // ── Prisma (130): el láser de electrones libres es su identidad ────────
  'pr-casco': struct('pr-casco', 'Cabeza blindada', 12, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'pr-nucleo': struct('pr-nucleo', 'Torso y núcleo', 50, { plate: 9, hit: 40, tags: ['high-profile'], crit: true }),
  'pr-patas': struct('pr-patas', 'Piernas de asalto', 32, { plate: 5, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'pr-canon': struct('pr-canon', 'Emisor láser', 20, { plate: 5, hit: 12, tags: ['weapon'], pen: [['energyAtk', -30]] }),
  'pr-cola': struct('pr-cola', 'Cola estabilizadora', 16, { plate: 4, hit: 14, tags: ['rear-exposed'], pen: [['atk', -8]] }),
};

export const MODULES: Record<string, ModuleDefinition> = {
  ...COMBAT_FRAME_MODULES,
  // ── Centella-M ──────────────────────────────────────────────────
  'cm-cabeza': {
    id: 'cm-cabeza', name: 'Cabeza sensora', hp: 12, armor: 2, plating: 4, weight: 6, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:cm-cabeza', stat: 'evade', add: 5 }],
    onDestroyed: [{ source: 'module:cm-cabeza', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'cm-torso': {
    id: 'cm-torso', name: 'Torso y núcleo', hp: 46, armor: 3, plating: 16, weight: 40, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'cm-tren-del': {
    id: 'cm-tren-del', name: 'Tren delantero', hp: 16, armor: 2, plating: 6, weight: 18, hitWeight: 15,
    critical: false,
    contributions: [
      { source: 'module:cm-tren-del', stat: 'move', add: 3 },
      { source: 'module:cm-tren-del', stat: 'jump', add: 1 },
      { source: 'module:cm-tren-del', stat: 'speed', add: 2 },
      { source: 'module:cm-tren-del', stat: 'evade', add: 5 },
    ],
    onDestroyed: [{ source: 'module:cm-tren-del', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'cm-tren-tras': {
    id: 'cm-tren-tras', name: 'Tren trasero', hp: 16, armor: 2, plating: 6, weight: 18, hitWeight: 15,
    critical: false,
    contributions: [
      { source: 'module:cm-tren-tras', stat: 'move', add: 3 },
      { source: 'module:cm-tren-tras', stat: 'jump', add: 1 },
      { source: 'module:cm-tren-tras', stat: 'speed', add: 2 },
      { source: 'module:cm-tren-tras', stat: 'evade', add: 5 },
    ],
    onDestroyed: [{ source: 'module:cm-tren-tras', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'induction-claws-mod': {
    id: 'induction-claws-mod', name: 'Garras de inducción', hp: 14, armor: 1, plating: 5, weight: 10, hitWeight: 10,
    critical: false,
    contributions: [
      { source: 'module:induction-claws-mod', stat: 'atk', add: 20 },
      { source: 'module:induction-claws-mod', stat: 'energyAtk', add: 30 },
    ],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'jump-jets': {
    id: 'jump-jets', name: 'Impulsores de salto', hp: 16, armor: 1, plating: 6, weight: 12, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:jump-jets', stat: 'evade', add: 5 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },

  // ── Prisma-M ──────────────────────────────────────────────────
  'pm-cabeza': {
    id: 'pm-cabeza', name: 'Cabeza blindada', hp: 12, armor: 2, plating: 4, weight: 8, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:pm-cabeza', stat: 'evade', add: 4 }],
    onDestroyed: [{ source: 'module:pm-cabeza', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'pm-torso': {
    id: 'pm-torso', name: 'Torso y núcleo', hp: 52, armor: 4, plating: 18, weight: 45, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'pm-pierna-izq': {
    id: 'pm-pierna-izq', name: 'Pierna izquierda', hp: 18, armor: 3, plating: 7, weight: 16, hitWeight: 12,
    critical: false,
    contributions: [
      { source: 'module:pm-pierna-izq', stat: 'move', add: 2 },
      { source: 'module:pm-pierna-izq', stat: 'speed', add: 2 },
      { source: 'module:pm-pierna-izq', stat: 'evade', add: 3 },
    ],
    onDestroyed: [{ source: 'module:pm-pierna-izq', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'pm-pierna-der': {
    id: 'pm-pierna-der', name: 'Pierna derecha', hp: 18, armor: 3, plating: 7, weight: 16, hitWeight: 12,
    critical: false,
    contributions: [
      { source: 'module:pm-pierna-der', stat: 'move', add: 2 },
      { source: 'module:pm-pierna-der', stat: 'speed', add: 2 },
      { source: 'module:pm-pierna-der', stat: 'evade', add: 3 },
    ],
    onDestroyed: [{ source: 'module:pm-pierna-der', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'fel-emitter': {
    id: 'fel-emitter', name: 'Emisor láser', hp: 16, armor: 1, plating: 6, weight: 14, hitWeight: 12,
    critical: false,
    contributions: [{ source: 'module:fel-emitter', stat: 'energyAtk', add: 30 }],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'pm-cola': {
    id: 'pm-cola', name: 'Cola estabilizadora', hp: 14, armor: 1, plating: 5, weight: 10, hitWeight: 14,
    critical: false,
    contributions: [{ source: 'module:pm-cola', stat: 'atk', add: 10 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },

  // ── Aftermarket (garaje) ────────────────────────────────────────────
  // Piezas de recambio etiquetadas con una especialización: montarlas
  // orienta al Yantra hacia esa pista y, si coincide con la dominante del
  // piloto, activa el bonus de sinergia (core/progression.ts).
  'am-sniper-sensor': {
    id: 'am-sniper-sensor', name: 'Sensor de tirador', hp: 10, armor: 1, plating: 4, weight: 6, hitWeight: 10,
    critical: false, spec: 'sniper',
    contributions: [
      { source: 'module:am-sniper-sensor', stat: 'accuracy', add: 6 },
      { source: 'module:am-sniper-sensor', stat: 'evade', add: 2 },
    ],
    onDestroyed: [{ source: 'module:am-sniper-sensor', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'am-armored-head': {
    id: 'am-armored-head', name: 'Cabeza acorazada', hp: 18, armor: 4, plating: 12, weight: 10, hitWeight: 10,
    critical: false, spec: 'defense',
    contributions: [
      { source: 'module:am-armored-head', stat: 'def', add: 3 },
      { source: 'module:am-armored-head', stat: 'evade', add: 2 },
    ],
    onDestroyed: [{ source: 'module:am-armored-head', stat: 'accuracy', add: -20 }],
    tags: ['high-profile', 'sensor'],
  },
  'am-assault-boosters': {
    id: 'am-assault-boosters', name: 'Boosters de asalto', hp: 14, armor: 1, plating: 6, weight: 13, hitWeight: 10,
    critical: false, spec: 'assault',
    contributions: [
      { source: 'module:am-assault-boosters', stat: 'atk', add: 5 },
      { source: 'module:am-assault-boosters', stat: 'move', add: 1 },
    ],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-shield-pack': {
    id: 'am-shield-pack', name: 'Generador de pantalla', hp: 16, armor: 2, plating: 9, weight: 14, hitWeight: 10,
    critical: false, spec: 'defense',
    contributions: [{ source: 'module:am-shield-pack', stat: 'energyDef', add: 6 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-recoil-dampers': {
    id: 'am-recoil-dampers', name: 'Amortiguadores de retroceso', hp: 12, armor: 1, plating: 5, weight: 8, hitWeight: 14,
    critical: false, spec: 'sniper',
    contributions: [{ source: 'module:am-recoil-dampers', stat: 'accuracy', add: 4 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-heavy-claws': {
    id: 'am-heavy-claws', name: 'Garras reforzadas', hp: 16, armor: 2, plating: 6, weight: 14, hitWeight: 10,
    critical: false, spec: 'assault',
    contributions: [
      { source: 'module:am-heavy-claws', stat: 'atk', add: 27 },
      { source: 'module:am-heavy-claws', stat: 'energyAtk', add: 22 },
    ],
    onDestroyed: [],
    tags: ['weapon'],
  },
};

/**
 * Opciones de recambio que el garaje ofrece por slot (además de la pieza
 * de fábrica del chasis). Es una tabla de datos para clientes; el motor
 * acepta cualquier módulo del catálogo en cualquier slot del frame.
 */
export const GARAGE_MODULE_OPTIONS: Record<string, string[]> = {
  head: ['am-sniper-sensor', 'am-armored-head'],
  backpack: ['am-assault-boosters', 'am-shield-pack'],
  tail: ['am-recoil-dampers'],
  'weapon-claws': ['am-heavy-claws'],
};
