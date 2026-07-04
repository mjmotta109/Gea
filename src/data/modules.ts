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
    onDestroyed: [],
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
    onDestroyed: [],
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
    onDestroyed: [],
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
    onDestroyed: [],
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
};
