import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { knockbackDestination } from '../src/core/physics.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import type { UnitState } from '../src/core/types.js';

const P = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'player', position: { x, y } });
const E = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'enemy', position: { x, y } });

function arena(overrides: Partial<BattleConfig>): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed: 31,
    spawns: [],
    ...overrides,
  });
}

describe('bestias 2×2: los jefes ocupan lo que pesan', () => {
  it('ocupa sus cuatro casillas y responde al apuntar a cualquiera', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 0, 0), E('B1', 'gran-brontes', 4, 2)],
    });
    const boss = battle.unit('B1');
    expect(boss.size).toBe(2);
    for (const pos of [{ x: 4, y: 2 }, { x: 5, y: 2 }, { x: 4, y: 3 }, { x: 5, y: 3 }]) {
      expect(battle.unitAt(pos)?.id).toBe('B1');
    }
    expect(battle.unitAt({ x: 6, y: 2 })).toBeUndefined();
  });

  it('el constructor rechaza spawns que pisen la huella del jefe', () => {
    expect(() => arena({
      spawns: [P('P1', 'liger-zero', 5, 3), E('B1', 'gran-brontes', 4, 2)],
    })).toThrow(/Dos unidades/);
  });

  it('no puede terminar el paso solapando a otra unidad ni salirse del mapa', () => {
    const battle = arena({
      spawns: [E('B1', 'gran-brontes', 4, 2), P('P1', 'liger-zero', 2, 2)],
    });
    // Turno del liger primero (más rápido): lo esperamos fuera.
    // El liger repite turno varias veces (speed 16 vs 9): esperamos al jefe.
    for (let i = 0; i < 20 && battle.getActiveUnit()?.id !== 'B1'; i++) {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    expect(battle.getActiveUnit()?.id).toBe('B1');
    const anchors = battle.legalMoves('B1').map((t) => `${t.pos.x},${t.pos.y}`);
    expect(anchors).not.toContain('1,2'); // pisaría al liger en (2,2)
    expect(anchors).not.toContain('2,2');
    // Anclas cuya huella se saldría del mapa (8×6): x máx 6, y máx 4.
    expect(anchors.every((a) => {
      const [x, y] = a.split(',').map(Number);
      return x! <= 6 && y! <= 4;
    })).toBe(true);
  });

  it('el golpe con área le pega UNA vez aunque pise varias casillas', () => {
    const battle = arena({
      spawns: [P('P1', 'gojulas', 1, 2), E('B1', 'gran-brontes', 3, 2)],
    });
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    const events = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'missile-pod', target: { x: 3, y: 2 },
    });
    const resolutions = events.filter((e) =>
      (e.type === 'damage-dealt' && e.targetUnitId === 'B1') ||
      (e.type === 'ability-missed' && e.targetUnitId === 'B1'));
    expect(resolutions).toHaveLength(1);
  });

  it('la cercanía cuenta desde su casilla más próxima, no desde el ancla', () => {
    // Mismo chasis en versión 1×1 para comparar solo la distancia:
    // el tirador en (4,3) está a 3 del ancla (2,2) pero a 1 de la pata
    // (3,3). El bonus de proximidad debe usar la pata: +16 en vez de +8.
    // Evasión alta para que ningún pronóstico sature el techo del 99%.
    const esquivo = { ...ZOIDS['gran-brontes']!.stats, evade: 40 };
    const big = arena({
      unitCatalog: { ...ZOIDS, 'gran-brontes': { ...ZOIDS['gran-brontes']!, stats: esquivo } },
      spawns: [P('P1', 'gun-sniper', 4, 3), E('B1', 'gran-brontes', 2, 2)],
    });
    const small = arena({
      unitCatalog: {
        ...ZOIDS,
        'brontes-uno': { ...ZOIDS['gran-brontes']!, id: 'brontes-uno', size: 1, stats: esquivo },
      },
      spawns: [P('P1', 'gun-sniper', 4, 3), E('B1', 'brontes-uno', 2, 2)],
    });
    big.nextTurn();
    small.nextTurn();
    const nearChance = big.attackPreview('P1', 'bite-crush', { x: 2, y: 2 })!.chance;
    const farChance = small.attackPreview('P1', 'bite-crush', { x: 2, y: 2 })!.chance;
    expect(nearChance - farChance).toBe(8); // proximidad(1)=16 vs proximidad(3)=8
  });

  it('ni un cañonazo lo desplaza: inmune al empuje', () => {
    const victim = {
      id: 'B1', name: 'B1', unitTypeId: 'gran-brontes', isCommander: false,
      team: 'enemy', position: { x: 4, y: 2 }, size: 2, facing: 'west',
      hp: 340, ct: 0, statuses: [], hasMoved: false, hasActed: false,
      reactionReady: true, components: {},
    } as UnitState;
    expect(knockbackDestination(FLAT_ARENA, { x: 1, y: 2 }, victim, [victim])).toBeNull();
  });
});
