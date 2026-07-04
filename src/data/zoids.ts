import type { UnitDefinition } from '../core/types.js';

/**
 * Catálogo de chasis de Zoids. Cumplen el papel de los jobs de FFTA:
 * definen stats, movimiento y qué habilidades están disponibles.
 *
 * Roles pensados para que el plantel base cubra el triángulo táctico:
 * asalto rápido, tanque, francotirador, soporte, volador y grunt barato.
 */
export const ZOIDS: Record<string, UnitDefinition> = {
  'liger-zero': {
    id: 'liger-zero',
    name: 'Liger Zero',
    role: 'assault',
    moveType: 'ground',
    stats: {
      maxHp: 120, atk: 45, energyAtk: 55, def: 30, energyDef: 25,
      speed: 16, move: 6, jump: 2, evade: 20, accuracy: 0,
    },
    abilityIds: ['strike-laser-claw', 'bite-crush', 'e-shield'],
  },
  'command-wolf': {
    id: 'command-wolf',
    name: 'Command Wolf',
    role: 'skirmisher',
    moveType: 'ground',
    stats: {
      maxHp: 100, atk: 40, energyAtk: 30, def: 25, energyDef: 20,
      speed: 14, move: 5, jump: 2, evade: 15, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'shock-cannon', 'smoke-discharger'],
  },
  'gojulas': {
    id: 'gojulas',
    name: 'Gojulas',
    role: 'tank',
    moveType: 'ground',
    stats: {
      maxHp: 200, atk: 60, energyAtk: 40, def: 50, energyDef: 40,
      speed: 8, move: 3, jump: 1, evade: 0, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'missile-pod', 'e-shield'],
  },
  'gun-sniper': {
    id: 'gun-sniper',
    name: 'Gun Sniper',
    role: 'sniper',
    moveType: 'ground',
    stats: {
      maxHp: 80, atk: 50, energyAtk: 25, def: 15, energyDef: 15,
      speed: 12, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['sniper-rifle', 'bite-crush'],
  },
  'pteras': {
    id: 'pteras',
    name: 'Pteras',
    role: 'flyer',
    moveType: 'flying',
    stats: {
      maxHp: 85, atk: 30, energyAtk: 35, def: 15, energyDef: 20,
      speed: 15, move: 7, jump: 99, evade: 25, accuracy: 0,
    },
    abilityIds: ['shock-cannon', 'stun-blade'],
  },
  'gustav': {
    id: 'gustav',
    name: 'Gustav',
    role: 'support',
    moveType: 'ground',
    stats: {
      maxHp: 140, atk: 20, energyAtk: 15, def: 45, energyDef: 35,
      speed: 10, move: 4, jump: 1, evade: 5, accuracy: 0,
    },
    abilityIds: ['repair-drones', 'smoke-discharger', 'e-shield'],
  },
  'molga': {
    id: 'molga',
    name: 'Molga',
    role: 'skirmisher',
    moveType: 'ground',
    stats: {
      maxHp: 70, atk: 30, energyAtk: 20, def: 20, energyDef: 15,
      speed: 11, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'shock-cannon'],
  },
  'geno-saurer': {
    id: 'geno-saurer',
    name: 'Geno Saurer',
    role: 'assault',
    moveType: 'ground',
    stats: {
      maxHp: 130, atk: 45, energyAtk: 65, def: 35, energyDef: 30,
      speed: 12, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['charged-particle-gun', 'bite-crush', 'e-shield'],
  },
};
