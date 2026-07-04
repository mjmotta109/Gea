import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import {
  BOOST_ENERGY_COST,
  MOVE_ENERGY_COST,
} from '../src/core/systems.js';
import type { UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { FLAT_ARENA } from '../src/data/maps.js';

/** Unidad de pruebas con energía, calor y un rifle con munición finita. */
const RIG: UnitDefinition = {
  id: 'rig',
  name: 'Rig de pruebas',
  role: 'skirmisher',
  moveType: 'ground',
  stats: {
    maxHp: 100, atk: 30, energyAtk: 30, def: 20, energyDef: 20,
    speed: 10, move: 4, jump: 1, evade: 10, accuracy: 0,
  },
  abilityIds: ['bite-crush'],
  energy: { capacity: 50, outputPerTurn: 10 },
  heat: { max: 40, dissipationPerTurn: 10 },
  weapons: ['w-test-rifle', 'w-test-laser'],
};

/** Rival pasivo sin componentes, para que el golden path no se toque. */
const DUMMY: UnitDefinition = {
  id: 'dummy',
  name: 'Blanco',
  role: 'tank',
  moveType: 'ground',
  stats: {
    maxHp: 500, atk: 1, energyAtk: 1, def: 10, energyDef: 10,
    speed: 1, move: 1, jump: 1, evade: 0, accuracy: 0,
  },
  abilityIds: ['bite-crush'],
};

const TEST_WEAPONS: Record<string, WeaponDefinition> = {
  'w-test-rifle': {
    id: 'w-test-rifle', name: 'Rifle de pruebas', abilityId: 'shock-cannon',
    costs: { heat: 5 }, magazine: 2, reserves: 1,
  },
  'w-test-laser': {
    id: 'w-test-laser', name: 'Láser de pruebas', abilityId: 'strike-laser-claw',
    costs: { energy: 25, heat: 30, cooldownTurns: 1 }, magazine: 0, reserves: 0,
  },
};

function rigBattle(overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: { rig: RIG, dummy: DUMMY },
    abilityCatalog: ABILITIES,
    weaponCatalog: TEST_WEAPONS,
    seed: 5,
    spawns: [
      { id: 'R', name: 'Rig', unitTypeId: 'rig', team: 'player', position: { x: 1, y: 1 } },
      { id: 'D', name: 'Dummy', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 1 } },
    ],
    ...overrides,
  });
}

/** Avanza hasta que la unidad indicada tenga el turno activo. */
function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 50; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('EnergySystem', () => {
  it('arranca a plena carga, gasta al mover y regenera al inicio del turno', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const energy = battle.unit('R').components.energy!;
    expect(energy.current).toBe(50);

    battle.execute({ type: 'move', unitId: 'R', to: { x: 2, y: 1 } });
    expect(energy.current).toBe(50 - MOVE_ENERGY_COST);

    battle.execute({ type: 'wait', unitId: 'R' });
    untilTurnOf(battle, 'R');
    // Regenera 10 con tope en capacidad 50.
    expect(energy.current).toBe(50);
  });

  it('veta armas y boost sin energía suficiente y penaliza a cero', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const unit = battle.unit('R');
    unit.components.energy!.current = 10;

    expect(battle.checkVetoes({
      type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 2, y: 1 },
    })?.systemId).toBe('energy');
    expect(battle.checkVetoes({ type: 'boost', unitId: 'R', to: { x: 2, y: 1 } })?.systemId).toBe('energy');

    unit.components.energy!.current = 0;
    const stats = battle.effectiveStats(unit);
    expect(stats.evade).toBe(10 - 10);      // energy:depleted
    expect(stats.energyDef).toBe(20 - 10);
  });

  it('el boost mueve, gasta energía y solo se permite una vez por turno', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const energy = battle.unit('R').components.energy!;

    const events = battle.execute({ type: 'boost', unitId: 'R', to: { x: 1, y: 3 } });
    expect(events.some((e) => e.type === 'unit-boosted')).toBe(true);
    expect(battle.unit('R').position).toEqual({ x: 1, y: 3 });
    expect(energy.current).toBe(50 - BOOST_ENERGY_COST);
    expect(() => battle.execute({ type: 'boost', unitId: 'R', to: { x: 1, y: 1 } })).toThrow(/ya hizo boost/);

    // El boost no consume ni movimiento ni acción.
    expect(battle.unit('R').hasMoved).toBe(false);
    expect(battle.unit('R').hasActed).toBe(false);
  });

  it('las unidades sin componente de energía ignoran el sistema', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'D');
    expect(battle.checkVetoes({ type: 'move', unitId: 'D', to: { x: 4, y: 2 } })).toBeNull();
    expect(battle.checkVetoes({ type: 'boost', unitId: 'D', to: { x: 4, y: 2 } })?.systemId).toBe('energy');
  });
});

describe('HeatSystem', () => {
  it('las armas generan calor y el fin de turno lo disipa', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    battle.execute({ type: 'move', unitId: 'R', to: { x: 3, y: 1 } });
    battle.execute({ type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 4, y: 1 } });
    const heat = battle.unit('R').components.heat!;
    expect(heat.current).toBe(30);

    battle.execute({ type: 'wait', unitId: 'R' });
    expect(heat.current).toBe(20); // -10 de disipación
  });

  it('el calor alto degrada puntería y el crítico también movilidad', () => {
    const battle = rigBattle();
    const unit = battle.unit('R');
    unit.components.heat!.current = 28; // 70% de 40
    expect(battle.effectiveStats(unit).accuracy).toBe(-15);
    expect(battle.effectiveStats(unit).move).toBe(4);

    unit.components.heat!.current = 34; // 85%
    const stats = battle.effectiveStats(unit);
    expect(stats.accuracy).toBe(-15);
    expect(stats.move).toBe(2);
    expect(stats.evade).toBe(0);
  });

  it('superar el límite térmico provoca apagado: daño interno y turno perdido', () => {
    const battle = rigBattle();
    battle.unit('R').components.heat!.current = 41; // > max 40
    const events = battle.nextTurn();
    const kinds = events.map((e) => e.type);
    expect(kinds).toContain('unit-shutdown');
    // El stun del apagado consume el turno automáticamente.
    expect(kinds).toContain('turn-ended');
    expect(battle.unit('R').hp).toBe(100 - 8); // 8% de 100
    // Ventilación de emergencia: disipación doble al cerrar ese turno.
    expect(battle.unit('R').components.heat!.current).toBe(41 - 20);
  });
});

describe('ArsenalSystem', () => {
  it('descuenta munición, veta sin cargador y recarga consumiendo la acción', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    battle.execute({ type: 'move', unitId: 'R', to: { x: 2, y: 1 } });
    const rifle = battle.unit('R').components.arsenal!.weapons[0]!;

    battle.execute({ type: 'ability', unitId: 'R', abilityId: 'shock-cannon', target: { x: 4, y: 1 } });
    expect(rifle.ammo).toBe(1);

    battle.execute({ type: 'wait', unitId: 'R' });
    untilTurnOf(battle, 'R');
    battle.execute({ type: 'ability', unitId: 'R', abilityId: 'shock-cannon', target: { x: 4, y: 1 } });
    expect(rifle.ammo).toBe(0);

    battle.execute({ type: 'wait', unitId: 'R' });
    untilTurnOf(battle, 'R');
    expect(battle.checkVetoes({
      type: 'ability', unitId: 'R', abilityId: 'shock-cannon', target: { x: 4, y: 1 },
    })?.reason).toMatch(/munición/);

    const events = battle.execute({ type: 'reload', unitId: 'R', weaponId: 'w-test-rifle' });
    expect(events[0]).toMatchObject({ type: 'weapon-reloaded', ammo: 2 });
    expect(rifle.reserves).toBe(0);
    expect(battle.unit('R').hasActed).toBe(true);
    expect(() => battle.execute({
      type: 'ability', unitId: 'R', abilityId: 'shock-cannon', target: { x: 4, y: 1 },
    })).toThrow(/ya actuó/);
  });

  it('el enfriamiento bloquea el arma el turno siguiente', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    battle.execute({ type: 'move', unitId: 'R', to: { x: 3, y: 1 } });
    battle.execute({ type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 4, y: 1 } });
    battle.execute({ type: 'wait', unitId: 'R' });

    untilTurnOf(battle, 'R');
    expect(battle.checkVetoes({
      type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 4, y: 1 },
    })?.reason).toMatch(/enfriamiento/);

    battle.execute({ type: 'wait', unitId: 'R' });
    untilTurnOf(battle, 'R');
    expect(battle.checkVetoes({
      type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 4, y: 1 },
    })).toBeNull();
  });

  it('las armas del arsenal cuentan como habilidades conocidas', () => {
    const battle = rigBattle();
    expect(battle.knownAbilityIds(battle.unit('R')).sort()).toEqual(
      ['bite-crush', 'shock-cannon', 'strike-laser-claw'],
    );
  });
});
