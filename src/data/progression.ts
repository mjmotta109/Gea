import type { PerkTable } from '../core/progression.js';

/**
 * Tabla de perks por pista de especialización del piloto. Cada nivel
 * aplica su fila de modificadores ACUMULATIVAMENTE (nivel 3 = filas 1-3).
 * Números modestos a propósito: el posicionamiento debe seguir importando
 * más que el nivel (GAME-DESIGN §4).
 */
export const PERKS: PerkTable = {
  perks: {
    assault: [
      [{ source: 'pilot:assault-1', stat: 'atk', add: 3 }, { source: 'pilot:assault-1', stat: 'energyAtk', add: 3 }],
      [{ source: 'pilot:assault-2', stat: 'move', add: 1 }],
      [{ source: 'pilot:assault-3', stat: 'atk', add: 4 }, { source: 'pilot:assault-3', stat: 'energyAtk', add: 4 }],
      [{ source: 'pilot:assault-4', stat: 'speed', add: 1 }],
      [{ source: 'pilot:assault-5', stat: 'atk', add: 5 }, { source: 'pilot:assault-5', stat: 'energyAtk', add: 5 }],
    ],
    sniper: [
      [{ source: 'pilot:sniper-1', stat: 'accuracy', add: 4 }],
      [{ source: 'pilot:sniper-2', stat: 'evade', add: 4 }],
      [{ source: 'pilot:sniper-3', stat: 'accuracy', add: 5 }],
      [{ source: 'pilot:sniper-4', stat: 'atk', add: 4 }],
      [{ source: 'pilot:sniper-5', stat: 'accuracy', add: 6 }],
    ],
    support: [
      [{ source: 'pilot:support-1', stat: 'energyDef', add: 4 }],
      [{ source: 'pilot:support-2', stat: 'speed', add: 1 }],
      [{ source: 'pilot:support-3', stat: 'def', add: 4 }],
      [{ source: 'pilot:support-4', stat: 'move', add: 1 }],
      [{ source: 'pilot:support-5', stat: 'maxHp', add: 10 }],
    ],
    defense: [
      [{ source: 'pilot:defense-1', stat: 'def', add: 3 }, { source: 'pilot:defense-1', stat: 'energyDef', add: 3 }],
      [{ source: 'pilot:defense-2', stat: 'maxHp', add: 8 }],
      [{ source: 'pilot:defense-3', stat: 'def', add: 4 }, { source: 'pilot:defense-3', stat: 'energyDef', add: 4 }],
      [{ source: 'pilot:defense-4', stat: 'evade', add: 4 }],
      [{ source: 'pilot:defense-5', stat: 'maxHp', add: 14 }],
    ],
  },
  // Sinergia piloto↔máquina: cada pieza montada que casa con la pista
  // dominante refuerza su estilo (máx. 2 piezas).
  synergy: {
    assault: { source: 'synergy:assault', stat: 'atk', add: 3 },
    sniper: { source: 'synergy:sniper', stat: 'accuracy', add: 3 },
    support: { source: 'synergy:support', stat: 'speed', add: 1 },
    defense: { source: 'synergy:defense', stat: 'def', add: 3 },
  },
  synergyCap: 2,
};
