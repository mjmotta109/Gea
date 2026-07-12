import { planTurn } from '../../src/ai/simpleAi.js';
import { Battle } from '../../src/core/battle.js';
import type { BattleEvent } from '../../src/core/types.js';
import { ABILITIES } from '../../src/data/abilities.js';
import { WEAPONS } from '../../src/data/weapons.js';
import { MODULES } from '../../src/data/modules.js';
import { VALLEY_CROSSING } from '../../src/data/maps.js';
import { ZOIDS } from '../../src/data/zoids.js';

/**
 * Corre una batalla completa IA-vs-IA con una semilla fija y devuelve un
 * registro serializable de TODO lo observable: eventos y estado final.
 *
 * Es la base del golden master (tests/golden.test.ts): cualquier refactor
 * del motor debe reproducir este registro bit a bit. Si un cambio de
 * comportamiento es deliberado, se regeneran las referencias con
 * `npm run golden:update` en un commit que lo declare.
 */
export interface BattleRecord {
  seed: number;
  winner: string | null;
  turns: number;
  finalUnits: Array<{
    id: string;
    hp: number;
    x: number;
    y: number;
    facing: string;
    ct: number;
    statuses: Array<{ id: string; remainingTurns: number }>;
  }>;
  events: BattleEvent[];
}

export function runScriptedBattle(seed: number, maxTurns = 300): BattleRecord {
  const battle = new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    weaponCatalog: WEAPONS,
    moduleCatalog: MODULES,
    seed,
    spawns: [
      { id: 'P1', name: 'Liger Zero', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 3 } },
      { id: 'P2', name: 'Command Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 5 } },
      { id: 'P3', name: 'Gun Sniper', unitTypeId: 'gun-sniper', team: 'player', position: { x: 1, y: 7 } },
      { id: 'P4', name: 'Gustav', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 4 } },
      { id: 'E1', name: 'Geno Saurer', unitTypeId: 'geno-saurer', team: 'enemy', position: { x: 10, y: 3 } },
      { id: 'E2', name: 'Molga A', unitTypeId: 'molga', team: 'enemy', position: { x: 11, y: 5 } },
      { id: 'E3', name: 'Molga B', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 6 } },
      { id: 'E4', name: 'Pteras', unitTypeId: 'pteras', team: 'enemy', position: { x: 11, y: 2 } },
    ],
  });

  const events: BattleEvent[] = [];
  let turns = 0;
  while (!battle.isOver && turns < maxTurns) {
    events.push(...battle.nextTurn());
    const active = battle.getActiveUnit();
    if (!active) break;
    turns++;
    for (const action of planTurn(battle, active)) {
      // Un contraataque letal puede cerrar el turno del actor a mitad de
      // su plan: el resto de acciones muere con él.
      if (battle.isOver || battle.getActiveUnit()?.id !== active.id) break;
      events.push(...battle.execute(action));
    }
  }

  return {
    seed,
    winner: battle.winner ?? null,
    turns,
    finalUnits: battle.units.map((u) => ({
      id: u.id,
      hp: u.hp,
      x: u.position.x,
      y: u.position.y,
      facing: u.facing,
      ct: u.ct,
      statuses: u.statuses.map((s) => ({ id: s.id, remainingTurns: s.remainingTurns })),
    })),
    events,
  };
}
