import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { GameMap } from '../src/core/grid.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import type { BattleEvent } from '../src/core/types.js';

const CATALOGS = withWeaponLibrary(ABILITIES, WEAPONS);

const P = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'player', position: { x, y } });
const E = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'enemy', position: { x, y } });

function arena(overrides: Partial<BattleConfig>): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog,
    weaponCatalog: CATALOGS.weaponCatalog,
    seed: 5,
    spawns: [],
    ...overrides,
  });
}

const reactions = (events: BattleEvent[]): Extract<BattleEvent, { type: 'reaction' }>[] =>
  events.filter((e): e is Extract<BattleEvent, { type: 'reaction' }> => e.type === 'reaction');

describe('reacciones: el posicionamiento por fin cuesta', () => {
  it('despegarse de un enemigo en contacto provoca su tiro de oportunidad', () => {
    const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'molga', 3, 2)] });
    battle.nextTurn(); // liger, el más rápido
    const events = battle.execute({ type: 'move', unitId: 'P1', to: { x: 0, y: 2 } });
    const fired = reactions(events);
    expect(fired).toHaveLength(1);
    expect(fired[0]).toMatchObject({ unitId: 'E1', targetUnitId: 'P1', reaction: 'oportunidad' });
  });

  it('moverse SIN salir del contacto no provoca nada', () => {
    const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'molga', 3, 2)] });
    battle.nextTurn();
    const events = battle.execute({ type: 'move', unitId: 'P1', to: { x: 3, y: 3 } });
    expect(reactions(events)).toHaveLength(0);
  });

  it('sobrevivir un golpe a bocajarro desata el contraataque, sin cadenas', () => {
    const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'iron-kong', 3, 2)] });
    battle.nextTurn();
    const events = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 3, y: 2 },
    });
    const fired = reactions(events);
    expect(fired).toHaveLength(1); // el contraataque jamás encadena otro
    expect(fired[0]).toMatchObject({ unitId: 'E1', targetUnitId: 'P1', reaction: 'contraataque' });
  });

  it('una reacción por ronda: gastada en el contraataque, la fuga sale gratis', () => {
    const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'iron-kong', 3, 2)] });
    battle.nextTurn();
    const hit = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 3, y: 2 },
    });
    expect(reactions(hit)).toHaveLength(1);
    const flee = battle.execute({ type: 'move', unitId: 'P1', to: { x: 0, y: 2 } });
    expect(reactions(flee)).toHaveLength(0); // E1 ya reaccionó esta ronda
  });

  it('la reacción se recupera al abrir el turno propio', () => {
    const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'iron-kong', 3, 2)] });
    battle.nextTurn();
    battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 3, y: 2 } });
    battle.execute({ type: 'wait', unitId: 'P1' });
    // Turno del kong: recupera su reacción y espera sin moverse.
    battle.nextTurn();
    expect(battle.getActiveUnit()?.id).toBe('E1');
    battle.execute({ type: 'wait', unitId: 'E1' });
    battle.nextTurn();
    expect(battle.getActiveUnit()?.id).toBe('P1');
    const flee = battle.execute({ type: 'move', unitId: 'P1', to: { x: 0, y: 2 } });
    expect(reactions(flee)).toHaveLength(1); // ronda nueva, reflejo nuevo
  });

  it('mismas órdenes, mismos reflejos: las reacciones son deterministas', () => {
    const run = (): string => {
      const battle = arena({ spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'iron-kong', 3, 2)] });
      battle.nextTurn();
      const events = battle.execute({
        type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 3, y: 2 },
      });
      return JSON.stringify(events);
    };
    expect(run()).toBe(run());
  });
});

describe('terreno que sufre la batalla', () => {
  it('una explosión arrasa el bosque: la cobertura desaparece', () => {
    const forestMap = GameMap.fromAscii([
      '000000',
      '00AA00',
      '000000',
    ]);
    const battle = arena({
      map: forestMap,
      spawns: [P('P1', 'gojulas', 0, 1), E('E1', 'molga', 2, 1)],
    });
    // Turno del gojulas (no hay nadie más rápido en pie... la molga sí lo es).
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    const events = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'missile-pod', target: { x: 2, y: 1 },
    });
    const razed = events.filter((e) => e.type === 'terrain-razed');
    expect(razed.length).toBeGreaterThan(0);
    expect(battle.map.tileAt({ x: 2, y: 1 }).terrain).toBe('plain');
  });
});
