import { describe, expect, it } from 'vitest';
import { Battle, type UnitSpawn } from '../src/core/battle.js';
import { GameMap } from '../src/core/grid.js';
import { VALLEY_CROSSING } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import type { BattleAction } from '../src/core/types.js';

// Repeticiones: el determinismo del motor las regala. La receta es
// (mapa serializado + spawns + semilla + acciones); recrearla debe
// reproducir la batalla BIT A BIT.

describe('repeticiones: la receta reproduce la batalla', () => {
  it('toAscii es el inverso exacto de fromAscii (todos los terrenos)', () => {
    const rows = ['012Ab~', '#cD3~9', 'AJaj00'];
    const map = GameMap.fromAscii(rows);
    expect(map.toAscii()).toEqual(rows);
    // Y el mapa reconstruido serializa igual: punto fijo.
    expect(GameMap.fromAscii(map.toAscii()).toAscii()).toEqual(rows);
  });

  it('mismo mapa serializado + mismas acciones → mismo estado final', () => {
    const spawns: UnitSpawn[] = [
      { id: 'P1', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 3 } },
      { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 3 } },
    ];
    const build = (map: GameMap): Battle => new Battle({
      map, unitCatalog: ZOIDS, abilityCatalog: ABILITIES, seed: 77, spawns,
    });

    // Batalla original: unas cuantas órdenes con dados de por medio.
    const original = build(VALLEY_CROSSING);
    const actions: BattleAction[] = [];
    const drive = (battle: Battle, record: boolean): string => {
      const exec = (a: BattleAction): void => {
        if (record) actions.push(a);
        battle.execute(a);
      };
      battle.nextTurn();
      exec({ type: 'move', unitId: 'P1', to: { x: 3, y: 3 } });
      exec({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 4, y: 3 } });
      exec({ type: 'wait', unitId: 'P1' });
      battle.nextTurn();
      if (battle.getActiveUnit()?.id === 'E1' && !battle.isOver) {
        exec({ type: 'wait', unitId: 'E1' });
      }
      return JSON.stringify({ units: battle.units, winner: battle.winner ?? null });
    };
    const originalState = drive(original, true);

    // La repetición: mapa RECONSTRUIDO desde ASCII + acciones grabadas.
    const replay = build(GameMap.fromAscii(VALLEY_CROSSING.toAscii()));
    replay.nextTurn();
    for (const action of actions.slice(0, 3)) replay.execute(action);
    replay.nextTurn();
    if (replay.getActiveUnit()?.id === 'E1' && !replay.isOver) {
      replay.execute(actions[3]!);
    }
    const replayState = JSON.stringify({ units: replay.units, winner: replay.winner ?? null });
    expect(replayState).toBe(originalState);
  });
});
