import type { ModuleDefinition, Stats } from '../core/types.js';

/**
 * Catálogo de módulos para los frames de los Zoids.
 *
 * DOS convenciones conviven:
 *  1. Frames "núcleo desnudo" (Liger Zero CAS, Geno Saurer CP): las stats base
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
 *
 * REGLA DEL NÚCLEO GORDO (medida, 2026-07-09). Montar un frame NO puede salir
 * a impuesto: un chasis con frame tiene que valer lo mismo que el mismo chasis
 * monocasco, o el hangar queda desigual según a quién le escribimos un frame.
 * La unidad muere cuando revienta el NÚCLEO, y el núcleo no solo recibe su
 * cuota de impactos: también le llega el DESBORDAMIENTO de cada pieza que
 * cae. Con núcleos pequeños (~38% del casco) eso mataba a la máquina con el
 * 45% del casco AÚN SANO — un −19% de dureza real frente al monocasco.
 * Por eso el núcleo se lleva ~55% del casco: así "núcleo roto" ≈ "casco
 * agotado" (desperdicio medido 45% → 32%) y el blindaje por placa (~28%)
 * cubre casi justo lo que se pierde (neto −5%).
 * Al tocar estos números, re-mide: scripts/balance-hangar.ts (banco) y
 * scripts/campaign-sim.ts (arco). No se calibra a ojo.
 */
const COMBAT_FRAME_MODULES: Record<string, ModuleDefinition> = {
  // ── Liger Zero (120): felino de asalto, garras devastadoras ──────────
  'lz-casco': struct('lz-casco', 'Cabeza sensora', 9, { plate: 4, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'lz-nucleo': struct('lz-nucleo', 'Torso y núcleo Zoid', 66, { plate: 14, hit: 40, tags: ['high-profile'], crit: true }),
  'lz-tren-del': struct('lz-tren-del', 'Tren delantero', 12, { plate: 5, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'lz-tren-tras': struct('lz-tren-tras', 'Tren trasero', 12, { plate: 5, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'lz-garras': struct('lz-garras', 'Garras Strike Laser', 11, { plate: 4, hit: 12, tags: ['weapon'], pen: [['atk', -18], ['energyAtk', -20]] }),
  'lz-lomo': struct('lz-lomo', 'Propulsores de lomo', 10, { plate: 4, hit: 10, tags: ['rear-exposed'], pen: [['evade', -8]] }),

  // ── Command Wolf (100): escaramuza, cañón dorsal expuesto ────────────
  'cw-casco': struct('cw-casco', 'Cabeza sensora', 8, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -18]] }),
  'cw-nucleo': struct('cw-nucleo', 'Torso y núcleo Zoid', 55, { plate: 12, hit: 40, tags: ['high-profile'], crit: true }),
  'cw-patas-del': struct('cw-patas-del', 'Patas delanteras', 11, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'cw-patas-tras': struct('cw-patas-tras', 'Patas traseras', 11, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'cw-canon': struct('cw-canon', 'Cañón dorsal', 15, { plate: 5, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -12], ['energyAtk', -15]] }),

  // ── Gun Sniper (80): cristal; la cola-sensor da la puntería ──────────
  'gsn-sensor': struct('gsn-sensor', 'Cabeza de puntería', 6, { plate: 2, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'gsn-nucleo': struct('gsn-nucleo', 'Torso y núcleo Zoid', 44, { plate: 8, hit: 40, tags: ['high-profile'], crit: true }),
  'gsn-patas': struct('gsn-patas', 'Patas de salto', 11, { plate: 4, hit: 15, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['evade', -4]] }),
  'gsn-cola': struct('gsn-cola', 'Cola estabilizadora', 9, { plate: 3, hit: 14, tags: ['rear-exposed', 'sensor'], pen: [['accuracy', -15]] }),
  'gsn-rifle': struct('gsn-rifle', 'Rifle de francotirador', 10, { plate: 3, hit: 10, tags: ['weapon'], pen: [['atk', -20]] }),

  // ── Gojulas (200): muralla; el HP vive en el núcleo ──────────────────
  'gj-casco': struct('gj-casco', 'Cabeza acorazada', 14, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'gj-nucleo': struct('gj-nucleo', 'Torso y reactor Zoid', 110, { plate: 10, hit: 45, tags: ['high-profile'], crit: true }),
  'gj-patas': struct('gj-patas', 'Patas de asedio', 29, { plate: 5, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -6]] }),
  'gj-misiles': struct('gj-misiles', 'Batería de misiles', 26, { plate: 4, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -14]] }),
  'gj-coraza': struct('gj-coraza', 'Coraza lateral', 21, { plate: 5, hit: 12, tags: ['high-profile'], pen: [['def', -8]] }),

  // ── Iron Kong (190): gorila; mochila de misiles a la espalda ─────────
  'ik-casco': struct('ik-casco', 'Cabeza sensora', 12, { plate: 4, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'ik-nucleo': struct('ik-nucleo', 'Torso y núcleo Zoid', 116, { plate: 22, hit: 42, tags: ['high-profile'], crit: true }),
  'ik-brazos': struct('ik-brazos', 'Brazos de impacto', 28, { plate: 8, hit: 14, tags: ['weapon'], pen: [['atk', -18]] }),
  'ik-piernas': struct('ik-piernas', 'Piernas hidráulicas', 29, { plate: 8, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -1], ['accuracy', -6]] }),
  'ik-mochila': struct('ik-mochila', 'Mochila de misiles', 25, { plate: 7, hit: 12, tags: ['rear-exposed', 'weapon'], pen: [['atk', -10]] }),

  // ── Pteras (100): volador; alas frágiles y fáciles de acertar ────────
  'pt-casco': struct('pt-casco', 'Morro sensor', 8, { plate: 2, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -15]] }),
  'pt-fuselaje': struct('pt-fuselaje', 'Fuselaje y núcleo Zoid', 55, { plate: 10, hit: 38, tags: ['high-profile'], crit: true }),
  'pt-ala-izq': struct('pt-ala-izq', 'Ala izquierda', 13, { plate: 3, hit: 16, tags: ['low-profile'], pen: [['evade', -12], ['move', -2]] }),
  'pt-ala-der': struct('pt-ala-der', 'Ala derecha', 13, { plate: 3, hit: 16, tags: ['low-profile'], pen: [['evade', -12], ['move', -2]] }),
  'pt-cola': struct('pt-cola', 'Cola de timón', 11, { plate: 3, hit: 12, tags: ['rear-exposed'], pen: [['accuracy', -10]] }),

  // ── Geno Saurer (130): el cañón de partículas es su identidad ────────
  'gsa-casco': struct('gsa-casco', 'Cabeza blindada', 9, { plate: 3, hit: 10, tags: ['high-profile', 'sensor'], pen: [['accuracy', -20]] }),
  'gsa-nucleo': struct('gsa-nucleo', 'Torso y núcleo Zoid', 72, { plate: 9, hit: 40, tags: ['high-profile'], crit: true }),
  'gsa-patas': struct('gsa-patas', 'Piernas de asalto', 22, { plate: 5, hit: 14, tags: ['low-profile', 'locomotion'], pen: [['move', -2], ['accuracy', -8]] }),
  'gsa-canon': struct('gsa-canon', 'Cañón de partículas', 15, { plate: 5, hit: 12, tags: ['weapon'], pen: [['energyAtk', -30]] }),
  'gsa-cola': struct('gsa-cola', 'Cola estabilizadora', 12, { plate: 4, hit: 14, tags: ['rear-exposed'], pen: [['atk', -8]] }),
};

export const MODULES: Record<string, ModuleDefinition> = {
  ...COMBAT_FRAME_MODULES,
  // ── Liger Zero CAS ──────────────────────────────────────────────────
  'liger-head': {
    id: 'liger-head', name: 'Cabeza sensora', hp: 9, armor: 2, plating: 4, weight: 6, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:liger-head', stat: 'evade', add: 5 }],
    onDestroyed: [{ source: 'module:liger-head', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'liger-torso': {
    id: 'liger-torso', name: 'Torso y núcleo Zoid', hp: 66, armor: 3, plating: 16, weight: 40, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'liger-legs-front': {
    id: 'liger-legs-front', name: 'Tren delantero', hp: 12, armor: 2, plating: 6, weight: 18, hitWeight: 15,
    critical: false,
    contributions: [
      { source: 'module:liger-legs-front', stat: 'move', add: 3 },
      { source: 'module:liger-legs-front', stat: 'jump', add: 1 },
      { source: 'module:liger-legs-front', stat: 'speed', add: 2 },
      { source: 'module:liger-legs-front', stat: 'evade', add: 5 },
    ],
    onDestroyed: [{ source: 'module:liger-legs-front', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'liger-legs-rear': {
    id: 'liger-legs-rear', name: 'Tren trasero', hp: 12, armor: 2, plating: 6, weight: 18, hitWeight: 15,
    critical: false,
    contributions: [
      { source: 'module:liger-legs-rear', stat: 'move', add: 3 },
      { source: 'module:liger-legs-rear', stat: 'jump', add: 1 },
      { source: 'module:liger-legs-rear', stat: 'speed', add: 2 },
      { source: 'module:liger-legs-rear', stat: 'evade', add: 5 },
    ],
    onDestroyed: [{ source: 'module:liger-legs-rear', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'strike-claws': {
    id: 'strike-claws', name: 'Garras Strike Laser', hp: 10, armor: 1, plating: 5, weight: 10, hitWeight: 10,
    critical: false,
    contributions: [
      { source: 'module:strike-claws', stat: 'atk', add: 20 },
      { source: 'module:strike-claws', stat: 'energyAtk', add: 30 },
    ],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'ion-boosters': {
    id: 'ion-boosters', name: 'Propulsores iónicos', hp: 11, armor: 1, plating: 6, weight: 12, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:ion-boosters', stat: 'evade', add: 5 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },

  // ── Geno Saurer CP ──────────────────────────────────────────────────
  'geno-head': {
    id: 'geno-head', name: 'Cabeza blindada', hp: 9, armor: 2, plating: 4, weight: 8, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:geno-head', stat: 'evade', add: 4 }],
    onDestroyed: [{ source: 'module:geno-head', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'geno-torso': {
    id: 'geno-torso', name: 'Torso y núcleo Zoid', hp: 72, armor: 4, plating: 18, weight: 45, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'geno-leg-l': {
    id: 'geno-leg-l', name: 'Pierna izquierda', hp: 13, armor: 3, plating: 7, weight: 16, hitWeight: 12,
    critical: false,
    contributions: [
      { source: 'module:geno-leg-l', stat: 'move', add: 2 },
      { source: 'module:geno-leg-l', stat: 'speed', add: 2 },
      { source: 'module:geno-leg-l', stat: 'evade', add: 3 },
    ],
    onDestroyed: [{ source: 'module:geno-leg-l', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'geno-leg-r': {
    id: 'geno-leg-r', name: 'Pierna derecha', hp: 13, armor: 3, plating: 7, weight: 16, hitWeight: 12,
    critical: false,
    contributions: [
      { source: 'module:geno-leg-r', stat: 'move', add: 2 },
      { source: 'module:geno-leg-r', stat: 'speed', add: 2 },
      { source: 'module:geno-leg-r', stat: 'evade', add: 3 },
    ],
    onDestroyed: [{ source: 'module:geno-leg-r', stat: 'accuracy', add: -10 }],
    tags: ['low-profile', 'locomotion'],
  },
  'particle-intake': {
    id: 'particle-intake', name: 'Cañón de partículas', hp: 12, armor: 1, plating: 6, weight: 14, hitWeight: 12,
    critical: false,
    contributions: [{ source: 'module:particle-intake', stat: 'energyAtk', add: 30 }],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'geno-tail': {
    id: 'geno-tail', name: 'Cola estabilizadora', hp: 11, armor: 1, plating: 5, weight: 10, hitWeight: 14,
    critical: false,
    contributions: [{ source: 'module:geno-tail', stat: 'atk', add: 10 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },

  // ── Aftermarket (garaje) ────────────────────────────────────────────
  // Piezas de recambio etiquetadas con una especialización: montarlas
  // orienta al Zoid hacia esa pista y, si coincide con la dominante del
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
