import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { defaultSystems } from '../src/core/systems.js';
import type { BattleSystem } from '../src/core/systems.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';

function duel(overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    seed: 123,
    spawns: [
      { id: 'P1', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 2 } },
      { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 6, y: 2 } },
    ],
    ...overrides,
  });
}

describe('bus de sistemas', () => {
  it('invoca onTurnStart y onTurnEnd en el turno de cada unidad', () => {
    const calls: string[] = [];
    const spy: BattleSystem = {
      id: 'spy',
      onTurnStart: (unit) => { calls.push(`start:${unit.id}`); return []; },
      onTurnEnd: (unit) => { calls.push(`end:${unit.id}`); return []; },
    };
    const battle = duel({ systems: [...defaultSystems(), spy] });
    battle.nextTurn();
    battle.execute({ type: 'wait', unitId: 'P1' });
    expect(calls).toEqual(['start:P1', 'end:P1']);
  });

  it('un veto de onValidateAction hace ilegal la acción', () => {
    const noMoves: BattleSystem = {
      id: 'no-moves',
      onValidateAction: (action) =>
        action.type === 'move' ? { systemId: 'no-moves', reason: 'prohibido moverse' } : null,
    };
    const battle = duel({ systems: [...defaultSystems(), noMoves] });
    battle.nextTurn();
    expect(() => battle.execute({ type: 'move', unitId: 'P1', to: { x: 2, y: 2 } }))
      .toThrow(/prohibido moverse/);
    // Otras acciones siguen funcionando.
    expect(() => battle.execute({ type: 'wait', unitId: 'P1' })).not.toThrow();
  });

  it('onActionResolved recibe la acción ejecutada', () => {
    const seen: string[] = [];
    const spy: BattleSystem = {
      id: 'spy',
      onActionResolved: (action) => { seen.push(action.type); return []; },
    };
    const battle = duel({ systems: [...defaultSystems(), spy] });
    battle.nextTurn();
    battle.execute({ type: 'move', unitId: 'P1', to: { x: 2, y: 2 } });
    battle.execute({ type: 'wait', unitId: 'P1' });
    expect(seen).toEqual(['move', 'wait']);
  });

  it('el overheatSystem daña al final del turno de la unidad afectada', () => {
    const battle = duel();
    battle.nextTurn();
    const p1 = battle.unit('P1');
    p1.statuses.push({ id: 'overheat', remainingTurns: 2 });
    const events = battle.execute({ type: 'wait', unitId: 'P1' });
    const tick = events.find((e) => e.type === 'status-ticked');
    expect(tick).toBeDefined();
    expect(p1.hp).toBe(120 - Math.round(120 * 0.08)); // 8% del maxHp del Liger
  });
});
