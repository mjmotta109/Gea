import type { ModuleDefinition } from '../core/types.js';

/**
 * Catálogo de módulos para los frames de los Zoids.
 *
 * Convención de calibrado: las stats base de una unidad framed representan
 * su núcleo desnudo, y los módulos aportan el resto vía contributions. La
 * suma (base + módulos intactos) debe igualar a la versión monocasco para
 * que ambas sean intercambiables en balance — hay un test de equivalencia
 * que lo verifica.
 */
export const MODULES: Record<string, ModuleDefinition> = {
  // ── Liger Zero CAS ──────────────────────────────────────────────────
  'liger-head': {
    id: 'liger-head', name: 'Cabeza sensora', hp: 12, armor: 2, weight: 6, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:liger-head', stat: 'evade', add: 5 }],
    onDestroyed: [{ source: 'module:liger-head', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'liger-torso': {
    id: 'liger-torso', name: 'Torso y núcleo Zoid', hp: 46, armor: 3, weight: 40, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'liger-legs-front': {
    id: 'liger-legs-front', name: 'Tren delantero', hp: 16, armor: 2, weight: 18, hitWeight: 15,
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
    id: 'liger-legs-rear', name: 'Tren trasero', hp: 16, armor: 2, weight: 18, hitWeight: 15,
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
    id: 'strike-claws', name: 'Garras Strike Laser', hp: 14, armor: 1, weight: 10, hitWeight: 10,
    critical: false,
    contributions: [
      { source: 'module:strike-claws', stat: 'atk', add: 20 },
      { source: 'module:strike-claws', stat: 'energyAtk', add: 30 },
    ],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'ion-boosters': {
    id: 'ion-boosters', name: 'Propulsores iónicos', hp: 16, armor: 1, weight: 12, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:ion-boosters', stat: 'evade', add: 5 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },

  // ── Geno Saurer CP ──────────────────────────────────────────────────
  'geno-head': {
    id: 'geno-head', name: 'Cabeza blindada', hp: 12, armor: 2, weight: 8, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:geno-head', stat: 'evade', add: 4 }],
    onDestroyed: [{ source: 'module:geno-head', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'geno-torso': {
    id: 'geno-torso', name: 'Torso y núcleo Zoid', hp: 52, armor: 4, weight: 45, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'geno-leg-l': {
    id: 'geno-leg-l', name: 'Pierna izquierda', hp: 18, armor: 3, weight: 16, hitWeight: 12,
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
    id: 'geno-leg-r', name: 'Pierna derecha', hp: 18, armor: 3, weight: 16, hitWeight: 12,
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
    id: 'particle-intake', name: 'Cañón de partículas', hp: 16, armor: 1, weight: 14, hitWeight: 12,
    critical: false,
    contributions: [{ source: 'module:particle-intake', stat: 'energyAtk', add: 30 }],
    onDestroyed: [],
    tags: ['weapon'],
  },
  'geno-tail': {
    id: 'geno-tail', name: 'Cola estabilizadora', hp: 14, armor: 1, weight: 10, hitWeight: 14,
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
    id: 'am-sniper-sensor', name: 'Sensor de tirador', hp: 10, armor: 1, weight: 6, hitWeight: 10,
    critical: false, spec: 'sniper',
    contributions: [
      { source: 'module:am-sniper-sensor', stat: 'accuracy', add: 6 },
      { source: 'module:am-sniper-sensor', stat: 'evade', add: 2 },
    ],
    onDestroyed: [{ source: 'module:am-sniper-sensor', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'am-armored-head': {
    id: 'am-armored-head', name: 'Cabeza acorazada', hp: 18, armor: 4, weight: 10, hitWeight: 10,
    critical: false, spec: 'defense',
    contributions: [
      { source: 'module:am-armored-head', stat: 'def', add: 3 },
      { source: 'module:am-armored-head', stat: 'evade', add: 2 },
    ],
    onDestroyed: [{ source: 'module:am-armored-head', stat: 'accuracy', add: -20 }],
    tags: ['high-profile', 'sensor'],
  },
  'am-assault-boosters': {
    id: 'am-assault-boosters', name: 'Boosters de asalto', hp: 14, armor: 1, weight: 13, hitWeight: 10,
    critical: false, spec: 'assault',
    contributions: [
      { source: 'module:am-assault-boosters', stat: 'atk', add: 5 },
      { source: 'module:am-assault-boosters', stat: 'move', add: 1 },
    ],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-shield-pack': {
    id: 'am-shield-pack', name: 'Generador de pantalla', hp: 16, armor: 2, weight: 14, hitWeight: 10,
    critical: false, spec: 'defense',
    contributions: [{ source: 'module:am-shield-pack', stat: 'energyDef', add: 6 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-recoil-dampers': {
    id: 'am-recoil-dampers', name: 'Amortiguadores de retroceso', hp: 12, armor: 1, weight: 8, hitWeight: 14,
    critical: false, spec: 'sniper',
    contributions: [{ source: 'module:am-recoil-dampers', stat: 'accuracy', add: 4 }],
    onDestroyed: [],
    tags: ['rear-exposed'],
  },
  'am-heavy-claws': {
    id: 'am-heavy-claws', name: 'Garras reforzadas', hp: 16, armor: 2, weight: 14, hitWeight: 10,
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
