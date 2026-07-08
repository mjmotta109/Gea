import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { planTurn } from '../src/ai/simpleAi.js';
import { applyStatus } from '../src/core/status.js';
import type { AbilityDefinition, UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { GameMap } from '../src/core/grid.js';

const ARENA = GameMap.fromAscii([
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
]);

const GUNNER: UnitDefinition = {
  id: 'gunner', name: 'Tirador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: [], weapons: ['w-cannon'],
};
const BRUISER: UnitDefinition = {
  id: 'bruiser', name: 'Melé', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'], weapons: [],
};
const DUMMY: UnitDefinition = {
  id: 'dummy', name: 'Blanco', role: 'tank', moveType: 'ground',
  stats: { maxHp: 120, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 1, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};
const WEAPONS: Record<string, WeaponDefinition> = {
  'w-cannon': { id: 'w-cannon', name: 'Cañón', abilityId: 'shock-cannon', costs: {}, magazine: 0, reserves: 0 },
};

function mk(spawns: BattleConfig['spawns'], catalog: Record<string, UnitDefinition>): Battle {
  return new Battle({ map: ARENA, unitCatalog: catalog, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS, seed: 5, spawns });
}
function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 60; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('IA táctica (mecánicas nuevas)', () => {
  it('remata al enemigo SUPRIMIDO antes que a uno intacto', () => {
    const battle = mk([
      { id: 'S', name: 'S', unitTypeId: 'gunner', team: 'player', position: { x: 1, y: 2 } },
      { id: 'E1', name: 'E1', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 2 } },
      { id: 'E2', name: 'E2', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 3 } },
    ], { gunner: GUNNER, dummy: DUMMY });
    untilTurnOf(battle, 'S');
    applyStatus(battle.unit('E2'), 'suprimido', 1); // el más lejano-en-orden, para que el sesgo mande
    const actions = planTurn(battle, battle.unit('S'));
    const shot = actions.find((a) => a.type === 'ability');
    expect(shot && shot.type === 'ability' ? shot.target : null).toEqual({ x: 4, y: 3 }); // E2, el suprimido
  });

  it('no termina su turno sobre el fuego: se aparta', () => {
    const battle = mk([
      { id: 'U', name: 'U', unitTypeId: 'bruiser', team: 'player', position: { x: 2, y: 2 } },
      { id: 'D', name: 'D', unitTypeId: 'dummy', team: 'enemy', position: { x: 7, y: 4 } }, // lejos: sin tiro
    ], { bruiser: BRUISER, dummy: DUMMY });
    untilTurnOf(battle, 'U');
    battle.map.ignite({ x: 2, y: 2 }, 3); // ardiendo bajo sus pies
    const actions = planTurn(battle, battle.unit('U'));
    const move = actions.find((a) => a.type === 'move');
    expect(move && move.type === 'move' ? battle.map.fireAt(move.to) : 1).toBe(0); // se mueve a casilla sin fuego
    expect(move && move.type === 'move' ? move.to : { x: 2, y: 2 }).not.toEqual({ x: 2, y: 2 });
  });

  it('sin fuego, la maniobra elige el mismo avance que antes (golden-safe)', () => {
    const battle = mk([
      { id: 'U', name: 'U', unitTypeId: 'bruiser', team: 'player', position: { x: 1, y: 2 } },
      { id: 'D', name: 'D', unitTypeId: 'dummy', team: 'enemy', position: { x: 7, y: 2 } },
    ], { bruiser: BRUISER, dummy: DUMMY });
    untilTurnOf(battle, 'U');
    const actions = planTurn(battle, battle.unit('U'));
    const move = actions.find((a) => a.type === 'move');
    // Avanza acercándose (minimiza distancia): de x=1 hacia x=7, move 4 → x=5.
    expect(move && move.type === 'move' ? move.to.x : 0).toBeGreaterThan(1);
  });
});
