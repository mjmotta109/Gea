import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { FIRE_HEAT, FIRE_DAMAGE_FRACTION } from '../src/core/systems.js';
import type { AbilityDefinition, UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPON_LIBRARY_ABILITIES } from '../src/data/weaponLibrary.js';
import { GameMap } from '../src/core/grid.js';
import { applyStatus } from '../src/core/status.js';

// Arena con una franja de agua en la columna 5 para probar que no prende.
const ARENA = GameMap.fromAscii([
  '00000~00',
  '00000~00',
  '00000~00',
  '00000~00',
  '00000~00',
  '00000~00',
]);

const IGNITER_ABILITY: Record<string, AbilityDefinition> = {
  ...ABILITIES,
  'test-ignite': {
    id: 'test-ignite', name: 'Incendiaria de pruebas', description: 'Prende sin dañar.',
    range: 6, minRange: 1, shape: 'single', aoeRadius: 1, accuracy: 100,
    targetsAllies: false, effects: [], ignites: 2,
  },
};
const IGNITER_WEAPON: Record<string, WeaponDefinition> = {
  'test-igniter': { id: 'test-igniter', name: 'Lanzallamas de pruebas', abilityId: 'test-ignite', costs: {}, magazine: 0, reserves: 0 },
};

const SHOOTER: UnitDefinition = {
  id: 'shooter', name: 'Tirador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 100, atk: 20, energyAtk: 20, def: 20, energyDef: 20, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: [], weapons: ['test-igniter'],
};
const REACTOR: UnitDefinition = {
  id: 'reactor', name: 'Reactor', role: 'tank', moveType: 'ground',
  stats: { maxHp: 200, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 8, move: 2, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
  energy: { capacity: 50, outputPerTurn: 10 }, heat: { max: 60, dissipationPerTurn: 10 },
};
const MONO: UnitDefinition = {
  id: 'mono', name: 'Monocasco', role: 'tank', moveType: 'ground',
  stats: { maxHp: 200, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 8, move: 2, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};

function fireBattle(targetType: 'reactor' | 'mono', overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: ARENA,
    unitCatalog: { shooter: SHOOTER, reactor: REACTOR, mono: MONO },
    abilityCatalog: IGNITER_ABILITY,
    weaponCatalog: IGNITER_WEAPON,
    seed: 5,
    spawns: [
      { id: 'S', name: 'Tirador', unitTypeId: 'shooter', team: 'player', position: { x: 1, y: 1 } },
      { id: 'T', name: 'Objetivo', unitTypeId: targetType, team: 'enemy', position: { x: 2, y: 2 } },
    ],
    ...overrides,
  });
}

function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 80; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('Control del campo: casillas de fuego', () => {
  it('un arma incendiaria PRENDE su zona de impacto', () => {
    const battle = fireBattle('mono');
    untilTurnOf(battle, 'S');
    const events = battle.execute({ type: 'ability', unitId: 'S', abilityId: 'test-ignite', target: { x: 3, y: 3 } });
    const ignited = events.filter((e) => e.type === 'tile-ignited');
    expect(ignited.length).toBeGreaterThan(0);
    expect(battle.map.fireAt({ x: 3, y: 3 })).toBe(2);
  });

  it('el agua y los muros no prenden', () => {
    const battle = fireBattle('mono');
    expect(battle.map.ignite({ x: 5, y: 2 }, 3)).toBe(false); // agua
    expect(battle.map.fireAt({ x: 5, y: 2 })).toBe(0);
    expect(battle.map.ignite({ x: 0, y: 0 }, 3)).toBe(true); // llanura sí
  });

  it('un reactor que cierra turno sobre fuego se COCE y se quema', () => {
    const battle = fireBattle('reactor');
    battle.map.ignite({ x: 2, y: 2 }, 3);
    untilTurnOf(battle, 'T');
    const t = battle.unit('T');
    const hpBefore = t.hp;
    const events = battle.execute({ type: 'wait', unitId: 'T' });
    expect(t.components.heat!.current).toBe(FIRE_HEAT); // arrancó en 0
    expect(events.some((e) => e.type === 'heat-changed' && e.reason === 'fire')).toBe(true);
    const burn = Math.round(200 * FIRE_DAMAGE_FRACTION);
    expect(t.hp).toBe(hpBefore - burn);
    expect(events.some((e) => e.type === 'unit-burned' && e.unitId === 'T')).toBe(true);
  });

  it('un monocasco se quema pero no tiene reactor que cocer', () => {
    const battle = fireBattle('mono');
    battle.map.ignite({ x: 2, y: 2 }, 3);
    untilTurnOf(battle, 'T');
    const t = battle.unit('T');
    const hpBefore = t.hp;
    const events = battle.execute({ type: 'wait', unitId: 'T' });
    expect(t.hp).toBe(hpBefore - Math.round(200 * FIRE_DAMAGE_FRACTION));
    expect(events.some((e) => e.type === 'unit-burned')).toBe(true);
    expect(events.some((e) => e.type === 'heat-changed')).toBe(false);
  });

  it('el fuego se consume un turno por ronda y acaba apagándose', () => {
    const battle = fireBattle('mono');
    battle.map.ignite({ x: 0, y: 5 }, 1); // lejos de las unidades
    const collected = [] as ReturnType<Battle['nextTurn']>;
    for (let i = 0; i < 30 && battle.map.fireAt({ x: 0, y: 5 }) > 0; i++) {
      const active = battle.getActiveUnit();
      collected.push(...(active ? battle.execute({ type: 'wait', unitId: active.id }) : battle.nextTurn()));
    }
    expect(battle.map.fireAt({ x: 0, y: 5 })).toBe(0);
    expect(collected.some((e) => e.type === 'tile-extinguished')).toBe(true);
  });
});

describe('El fuego no quema cadáveres', () => {
  it('un DoT que la tumba al cerrar turno sobre fuego no la quema (una sola destrucción)', () => {
    const battle = fireBattle('mono');
    battle.map.ignite({ x: 2, y: 2 }, 3);
    untilTurnOf(battle, 'T');
    const t = battle.unit('T');
    applyStatus(t, 'overheat', 1);          // el sobrecalentamiento corre ANTES que el fuego
    t.hp = Math.round(200 * 0.08);          // justo lo que ese tick le quita: muere en él
    const events = battle.execute({ type: 'wait', unitId: 'T' });
    expect(events.filter((e) => e.type === 'unit-destroyed' && e.unitId === 'T').length).toBe(1);
    expect(events.some((e) => e.type === 'unit-burned')).toBe(false);
  });
});

describe('Mortero incendiario (biblioteca)', () => {
  it('existe y prende la zona', () => {
    expect(WEAPON_LIBRARY_ABILITIES['lib-incendiary-mortar']!.ignites).toBeGreaterThan(0);
  });
});
