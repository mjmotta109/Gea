import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { planTurn } from '../src/ai/simpleAi.js';
import type { BattleEvent } from '../src/core/types.js';

function duel(overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    seed: 123,
    spawns: [
      { id: 'P1', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 2 } },
      { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 6, y: 2 } },
    ],
    ...overrides,
  });
}

describe('Battle: flujo de turno', () => {
  it('abre el turno de la unidad más rápida', () => {
    const battle = duel();
    const events = battle.nextTurn();
    expect(events[0]).toEqual({ type: 'turn-started', unitId: 'P1' }); // Liger speed 16 > Molga 11
    expect(battle.getActiveUnit()?.id).toBe('P1');
  });

  it('permite mover una sola vez por turno', () => {
    const battle = duel();
    battle.nextTurn();
    battle.execute({ type: 'move', unitId: 'P1', to: { x: 3, y: 2 } });
    expect(battle.unit('P1').position).toEqual({ x: 3, y: 2 });
    expect(() => battle.execute({ type: 'move', unitId: 'P1', to: { x: 4, y: 2 } })).toThrow();
  });

  it('rechaza movimientos fuera de alcance', () => {
    const battle = duel();
    battle.nextTurn();
    // Liger move=6; (7,5) está a 9 de distancia
    expect(() => battle.execute({ type: 'move', unitId: 'P1', to: { x: 7, y: 5 } })).toThrow();
  });

  it('rechaza acciones de una unidad que no tiene el turno', () => {
    const battle = duel();
    battle.nextTurn();
    expect(() => battle.execute({ type: 'wait', unitId: 'E1' })).toThrow();
  });

  it('wait cierra el turno y nextTurn pasa al siguiente', () => {
    const battle = duel();
    battle.nextTurn();
    battle.execute({ type: 'wait', unitId: 'P1', facing: 'north' });
    expect(battle.unit('P1').facing).toBe('north');
    expect(battle.getActiveUnit()).toBeUndefined();
    battle.nextTurn();
    expect(battle.getActiveUnit()).toBeDefined();
  });
});

describe('Battle: habilidades', () => {
  it('resuelve un ataque melee con daño', () => {
    const battle = duel({
      spawns: [
        { id: 'P1', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 2 } },
        { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 2, y: 2 } },
      ],
    });
    battle.nextTurn();
    const events = battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 2, y: 2 } });
    const kinds = events.map((e) => e.type);
    expect(kinds).toContain('ability-used');
    expect(kinds.some((k) => k === 'damage-dealt' || k === 'ability-missed')).toBe(true);
  });

  it('rechaza habilidades que el chasis no conoce y objetivos fuera de rango', () => {
    const battle = duel({
      spawns: [
        { id: 'P1', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 2 } },
        { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 2, y: 2 } },
      ],
    });
    battle.nextTurn();
    expect(() => battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'sniper-rifle', target: { x: 2, y: 2 } }))
      .toThrow(/no conoce/);
    expect(() => battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 7, y: 5 } }))
      .toThrow(/ilegal/);
  });

  it('la curación no revive ni excede el HP máximo', async () => {
    const { WEAPONS } = await import('../src/data/weapons.js');
    const battle = new Battle({
      map: FLAT_ARENA,
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      weaponCatalog: WEAPONS,
      seed: 7,
      spawns: [
        { id: 'P1', name: 'Gustav', unitTypeId: 'gustav', team: 'player', position: { x: 1, y: 2 } },
        { id: 'P2', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 2, y: 2 } },
        { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 7, y: 5 } },
      ],
    });
    battle.unit('P2').hp = 100; // Liger maxHp 120
    // Avanza turnos hasta que le toque al Gustav.
    for (let i = 0; i < 10 && battle.getActiveUnit()?.id !== 'P1'; i++) {
      if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
      else battle.nextTurn();
    }
    expect(battle.getActiveUnit()?.id).toBe('P1');
    const events = battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'repair-drones', target: { x: 2, y: 2 } });
    const heal = events.find((e): e is Extract<BattleEvent, { type: 'unit-healed' }> => e.type === 'unit-healed');
    expect(heal).toBeDefined();
    expect(heal!.amount).toBe(20); // recorta a maxHp, no 45
    expect(battle.unit('P2').hp).toBe(120);
  });

  it('una batalla completa IA-vs-IA termina con un ganador y es determinista', () => {
    const run = (seed: number): { winner: string | undefined; turns: number } => {
      const battle = duel({ seed });
      let turns = 0;
      while (!battle.isOver && turns < 300) {
        battle.nextTurn();
        const active = battle.getActiveUnit();
        if (!active) break;
        turns++;
        for (const action of planTurn(battle, active)) {
          if (battle.isOver) break;
          battle.execute(action);
        }
      }
      return { winner: battle.winner, turns };
    };

    const a = run(99);
    const b = run(99);
    expect(a.winner).toBeDefined();
    expect(a).toEqual(b); // misma semilla ⇒ misma batalla
  });
});

describe('posturas de energía: reparto elegido, dos caras a la vista', () => {
  function stanceBattle(): Battle {
    const battle = new Battle({
      map: FLAT_ARENA,
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      seed: 7,
      spawns: [
        { id: 'P1', name: 'Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 0 } },
        { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 5, y: 0 } },
      ],
    });
    battle.nextTurn();
    return battle;
  }

  it('cambiar de postura es acción libre, persiste y modifica stats', () => {
    const battle = stanceBattle();
    const base = battle.effectiveStats(battle.unit('P1'));
    const events = battle.execute({ type: 'stance', unitId: 'P1', stance: 'cazador' });
    expect(events).toEqual([{ type: 'stance-changed', unitId: 'P1', stance: 'cazador' }]);
    expect(battle.getActiveUnit()?.id).toBe('P1'); // el turno sigue siendo suyo
    const hunter = battle.effectiveStats(battle.unit('P1'));
    expect(hunter.accuracy).toBe(base.accuracy + 10);
    expect(hunter.evade).toBe(base.evade - 5);
    // Repetir la misma postura no emite nada.
    expect(battle.execute({ type: 'stance', unitId: 'P1', stance: 'cazador' })).toEqual([]);
  });

  it('galope compra zancada vendiendo blindaje; tortuga al revés', () => {
    const battle = stanceBattle();
    const base = battle.effectiveStats(battle.unit('P1'));
    battle.execute({ type: 'stance', unitId: 'P1', stance: 'galope' });
    const gallop = battle.effectiveStats(battle.unit('P1'));
    expect(gallop.move).toBe(base.move + 2);
    expect(gallop.def).toBe(base.def - 10);
    battle.execute({ type: 'stance', unitId: 'P1', stance: 'tortuga' });
    const turtle = battle.effectiveStats(battle.unit('P1'));
    expect(turtle.def).toBe(base.def + 10);
    expect(turtle.move).toBe(base.move - 2);
  });
});
