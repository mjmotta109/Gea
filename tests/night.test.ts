import { describe, expect, it } from 'vitest';
import { Battle, NIGHT_VISION_BASE, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { planTurn } from '../src/ai/simpleAi.js';
import { GameMap } from '../src/core/grid.js';
import { ZOIDS } from '../src/data/zoids.js';
import { MODULES } from '../src/data/modules.js';
import { ABILITIES } from '../src/data/abilities.js';

// Combate nocturno: la niebla SOLO existe de noche. Burbuja de sensores
// por equipo (enlace táctico); lo de fuera no se ve ni se puede apuntar.
// De día el motor es idéntico — el golden master lo certifica aparte.

const OPEN = GameMap.fromAscii([
  '000000000000000',
  '000000000000000',
  '000000000000000',
  '000000000000000',
  '000000000000000',
]);

// Un fusil de laboratorio con alcance de sobra para probar la burbuja.
const LAB_ABILITIES = {
  ...ABILITIES,
  'lab-fusil': {
    id: 'lab-fusil', name: 'Fusil de pruebas', description: 'Largo alcance.',
    range: 12, minRange: 0, shape: 'single' as const, aoeRadius: 0, accuracy: 90,
    targetsAllies: false, effects: [{ kind: 'damage' as const, power: 20, damageType: 'physical' as const }],
  },
};

const P = (id: string, x: number, y: number, extra?: string[]): UnitSpawn =>
  ({ id, name: id, unitTypeId: 'command-wolf', team: 'player', position: { x, y },
    ...(extra ? { extraAbilityIds: extra } : {}) });
const E = (id: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId: 'molga', team: 'enemy', position: { x, y } });

function nightBattle(spawns: UnitSpawn[], night = true): Battle {
  const config: BattleConfig = {
    map: OPEN, unitCatalog: ZOIDS, moduleCatalog: MODULES,
    abilityCatalog: LAB_ABILITIES, seed: 5, spawns, night,
  };
  return new Battle(config);
}

describe('combate nocturno: la burbuja de sensores', () => {
  it('de día no hay niebla: todo visible, todo apuntable', () => {
    const battle = nightBattle([P('P1', 1, 2, ['lab-fusil']), E('E1', 13, 2)], false);
    expect(battle.tileVisibleTo('player', { x: 13, y: 2 })).toBe(true);
    expect(battle.unitVisibleTo('player', battle.unit('E1'))).toBe(true);
    expect(battle.canTargetFrom(battle.unit('P1'), { x: 1, y: 2 }, 'lab-fusil', { x: 13, y: 2 })).toBe(true);
  });

  it('de noche, lo que queda fuera de la burbuja no se ve ni se apunta', () => {
    const battle = nightBattle([P('P1', 1, 2, ['lab-fusil']), E('E1', 13, 2)]);
    // A 12 casillas, muy fuera de la visión base (6): invisible e inapuntable.
    expect(battle.unitVisibleTo('player', battle.unit('E1'))).toBe(false);
    expect(battle.canTargetFrom(battle.unit('P1'), { x: 1, y: 2 }, 'lab-fusil', { x: 13, y: 2 })).toBe(false);
    // El motor lo VETA de verdad: ejecutar el disparo es ilegal.
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    expect(() => battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'lab-fusil', target: { x: 13, y: 2 },
    })).toThrow(/ilegal/i);
  });

  it('dentro de la burbuja (visión base 6) se ve y se dispara', () => {
    const battle = nightBattle([P('P1', 1, 2, ['lab-fusil']), E('E1', 6, 2)]);
    expect(NIGHT_VISION_BASE).toBe(6);
    expect(battle.unitVisibleTo('player', battle.unit('E1'))).toBe(true);
    expect(battle.canTargetFrom(battle.unit('P1'), { x: 1, y: 2 }, 'lab-fusil', { x: 6, y: 2 })).toBe(true);
  });

  it('el enlace táctico comparte sensores: el explorador adelantado ilumina', () => {
    // P1 tirador atrás (a 12 del blanco), P2 adelantado a 3 del blanco.
    const battle = nightBattle([
      P('P1', 1, 2, ['lab-fusil']), P('P2', 10, 2), E('E1', 13, 2),
    ]);
    expect(battle.unitVisibleTo('player', battle.unit('E1'))).toBe(true);
    expect(battle.canTargetFrom(battle.unit('P1'), { x: 1, y: 2 }, 'lab-fusil', { x: 13, y: 2 })).toBe(true);
  });

  it('los ojos de la noche ven más lejos: el König Wolf declara visión 9', () => {
    expect(ZOIDS['konig-wolf']!.vision).toBe(9);
    expect(ZOIDS['molga']!.vision).toBeUndefined(); // el resto, base
  });

  it('la IA nocturna no dispara a ciegas, pero SÍ avanza por el rumor', () => {
    const battle = nightBattle([P('P1', 1, 2, ['lab-fusil']), E('E1', 13, 2)]);
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    const plan = planTurn(battle, battle.unit('P1'));
    // Sin blanco visible: nada de disparos, pero se mueve hacia el eco.
    expect(plan.some((a) => a.type === 'ability')).toBe(false);
    const move = plan.find((a) => a.type === 'move');
    expect(move).toBeDefined();
    if (move && move.type === 'move') {
      expect(move.to.x).toBeGreaterThan(1); // rumbo al este, hacia el rumor
    }
  });
});
