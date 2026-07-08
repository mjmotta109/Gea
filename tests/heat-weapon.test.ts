import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import type { AbilityDefinition, UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPON_LIBRARY_ABILITIES, WEAPON_LIBRARY_WEAPONS } from '../src/data/weaponLibrary.js';
import { FLAT_ARENA } from '../src/data/maps.js';

/** Rayo de calor PURO de pruebas: sin daño, solo vierte calor. Aísla la
 *  mecánica del rider térmico (no consume azar). */
const TEST_ABILITIES: Record<string, AbilityDefinition> = {
  ...ABILITIES,
  'test-heat-ray': {
    id: 'test-heat-ray',
    name: 'Rayo de calor de pruebas',
    description: 'Vierte calor en el reactor del objetivo.',
    range: 2,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 100,
    targetsAllies: false,
    effects: [{ kind: 'heat', amount: 20 }],
  },
};

const TEST_WEAPONS: Record<string, WeaponDefinition> = {
  'test-heat-w': {
    id: 'test-heat-w', name: 'Emisor de pruebas', abilityId: 'test-heat-ray',
    costs: {}, magazine: 0, reserves: 0,
  },
};

/** Tirador rápido con el emisor térmico (no necesita reactor propio). */
const SHOOTER: UnitDefinition = {
  id: 'shooter', name: 'Tirador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 100, atk: 20, energyAtk: 20, def: 20, energyDef: 20, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: [], weapons: ['test-heat-w'],
};

/** Objetivo con reactor (energía + calor): SÍ se puede cocer. */
const REACTOR: UnitDefinition = {
  id: 'reactor', name: 'Reactor', role: 'tank', moveType: 'ground',
  stats: { maxHp: 200, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 6, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
  energy: { capacity: 50, outputPerTurn: 10 },
  heat: { max: 40, dissipationPerTurn: 10 },
};

/** Objetivo monocasco (sin componentes): no tiene reactor que cocer. */
const MONO: UnitDefinition = {
  id: 'mono', name: 'Monocasco', role: 'tank', moveType: 'ground',
  stats: { maxHp: 200, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 6, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};

function heatBattle(targetType: 'reactor' | 'mono', overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: { shooter: SHOOTER, reactor: REACTOR, mono: MONO },
    abilityCatalog: TEST_ABILITIES,
    weaponCatalog: TEST_WEAPONS,
    seed: 5,
    spawns: [
      { id: 'S', name: 'Tirador', unitTypeId: 'shooter', team: 'player', position: { x: 1, y: 1 } },
      { id: 'T', name: 'Objetivo', unitTypeId: targetType, team: 'enemy', position: { x: 2, y: 1 } },
    ],
    ...overrides,
  });
}

function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 50; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('Arma térmica (vierte calor en el objetivo)', () => {
  it('cuece el reactor del objetivo: sube su calor sin tocar su HP', () => {
    const battle = heatBattle('reactor');
    untilTurnOf(battle, 'S');
    const target = battle.unit('T');
    expect(target.components.heat!.current).toBe(0);
    const hpBefore = target.hp;

    const events = battle.execute({ type: 'ability', unitId: 'S', abilityId: 'test-heat-ray', target: { x: 2, y: 1 } });

    expect(target.components.heat!.current).toBe(20);
    expect(target.hp).toBe(hpBefore); // calor puro: no rasca el casco
    expect(events.some(
      (e) => e.type === 'heat-changed' && e.unitId === 'T' && e.reason === 'weapon' && e.delta === 20,
    )).toBe(true);
  });

  it('contra un monocasco no hace nada (no hay reactor que cocer)', () => {
    const battle = heatBattle('mono');
    untilTurnOf(battle, 'S');
    const target = battle.unit('T');
    const hpBefore = target.hp;

    const events = battle.execute({ type: 'ability', unitId: 'S', abilityId: 'test-heat-ray', target: { x: 2, y: 1 } });

    expect(target.hp).toBe(hpBefore);
    expect(events.some((e) => e.type === 'heat-changed')).toBe(false);
  });

  it('cocer por encima del límite fuerza el apagado del objetivo su turno', () => {
    const battle = heatBattle('reactor');
    untilTurnOf(battle, 'S');
    // A 30 de 40, el rayo (+20) desborda el reactor.
    battle.unit('T').components.heat!.current = 30;
    battle.execute({ type: 'ability', unitId: 'S', abilityId: 'test-heat-ray', target: { x: 2, y: 1 } });
    expect(battle.unit('T').components.heat!.current).toBe(50);

    // Avanzar hasta que se abra el turno del objetivo (el tirador es más
    // rápido: puede volver a jugar antes). El apagado salta al abrir su turno.
    const collected = [] as ReturnType<Battle['nextTurn']>;
    for (let i = 0; i < 20 && !battle.isOver; i++) {
      const active = battle.getActiveUnit();
      collected.push(...(active ? battle.execute({ type: 'wait', unitId: active.id }) : battle.nextTurn()));
      if (collected.some((e) => e.type === 'unit-shutdown' && e.unitId === 'T')) break;
    }
    expect(collected.some((e) => e.type === 'unit-shutdown' && e.unitId === 'T')).toBe(true);
  });
});

describe('Lanzallamas de plasma (biblioteca)', () => {
  it('existe con efecto de calor y su daño es mínimo', () => {
    const ability = WEAPON_LIBRARY_ABILITIES['lib-plasma-flamer']!;
    const heat = ability.effects.find((e) => e.kind === 'heat');
    const dmg = ability.effects.find((e) => e.kind === 'damage');
    expect(heat && heat.kind === 'heat' ? heat.amount : 0).toBeGreaterThan(0);
    expect(dmg && dmg.kind === 'damage' ? dmg.power : 99).toBeLessThan(20);
    expect(WEAPON_LIBRARY_WEAPONS['lib-w-plasma-flamer']!.abilityId).toBe('lib-plasma-flamer');
  });

  it('el arma REAL montada cuece el reactor (calor +26, pase o no el daño)', () => {
    const flamerAmount = (WEAPON_LIBRARY_ABILITIES['lib-plasma-flamer']!.effects
      .find((e) => e.kind === 'heat') as { kind: 'heat'; amount: number }).amount;
    const gunner: UnitDefinition = { ...SHOOTER, weapons: ['lib-w-plasma-flamer'] };
    const battle = new Battle({
      map: FLAT_ARENA,
      unitCatalog: { shooter: gunner, reactor: REACTOR, mono: MONO },
      // Catálogos reales + biblioteca (como el cliente y la campaña).
      abilityCatalog: { ...ABILITIES, ...WEAPON_LIBRARY_ABILITIES },
      weaponCatalog: { ...WEAPON_LIBRARY_WEAPONS },
      seed: 5,
      spawns: [
        { id: 'S', name: 'Tirador', unitTypeId: 'shooter', team: 'player', position: { x: 1, y: 1 } },
        { id: 'T', name: 'Objetivo', unitTypeId: 'reactor', team: 'enemy', position: { x: 2, y: 1 } },
      ],
    });
    untilTurnOf(battle, 'S');
    const heatBefore = battle.unit('T').components.heat!.current;
    battle.execute({ type: 'ability', unitId: 'S', abilityId: 'lib-plasma-flamer', target: { x: 2, y: 1 } });
    expect(battle.unit('T').components.heat!.current).toBe(heatBefore + flamerAmount);
  });
});
