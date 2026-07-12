import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import {
  OVERCLOCK_ENGAGE_HEAT,
  SURROUNDED_HEAT,
  overclockModifiers,
} from '../src/core/systems.js';
import type { UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { FLAT_ARENA } from '../src/data/maps.js';

/** Rig con reactor completo (energía + calor): puede sobrecargarse. */
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

/** Monocasco sin componentes: no tiene reactor que sobrecargar. */
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

describe('Sobrecarga del reactor (overclock)', () => {
  it('es una acción libre que sube potencia, iniciativa y daño', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const unit = battle.unit('R');

    const before = battle.effectiveStats(unit);
    expect(before).toMatchObject({ move: 4, speed: 10, atk: 30, energyAtk: 30 });

    const events = battle.execute({ type: 'overclock', unitId: 'R', on: true });
    expect(events.some((e) => e.type === 'overclock-changed' && e.on === true)).toBe(true);
    expect(unit.overclocked).toBe(true);

    const after = battle.effectiveStats(unit);
    expect(after).toMatchObject({ move: 6, speed: 14, atk: 38, energyAtk: 38 });

    // Acción libre: ni consume el movimiento ni la acción del turno.
    expect(unit.hasMoved).toBe(false);
    expect(unit.hasActed).toBe(false);
  });

  it('enganchar la sobrecarga pega un tirón de calor inmediato', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const heat = battle.unit('R').components.heat!;
    expect(heat.current).toBe(0);

    const events = battle.execute({ type: 'overclock', unitId: 'R', on: true });
    expect(heat.current).toBe(OVERCLOCK_ENGAGE_HEAT);
    expect(events.some(
      (e) => e.type === 'heat-changed' && e.reason === 'overclock' && e.delta === OVERCLOCK_ENGAGE_HEAT,
    )).toBe(true);
  });

  it('sostener la sobrecarga sin refrigerar acaba en apagado y la corta sola', () => {
    const battle = rigBattle();
    const unit = battle.unit('R');
    unit.overclocked = true;
    // 30 + 18 (calor por turno de la sobrecarga) supera el límite de 40.
    unit.components.heat!.current = 30;

    const events = battle.nextTurn();
    const kinds = events.map((e) => e.type);
    expect(kinds).toContain('unit-shutdown');
    // El apagado de emergencia se protege cortando la sobrecarga.
    expect(events.some((e) => e.type === 'overclock-changed' && e.on === false)).toBe(true);
    expect(unit.overclocked).toBe(false);
  });

  it('re-enganchar una sobrecarga ya puesta se veta y NO vuelve a cobrar calor', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    battle.execute({ type: 'overclock', unitId: 'R', on: true });
    const heat = battle.unit('R').components.heat!.current; // = OVERCLOCK_ENGAGE_HEAT
    // La sobrecarga es acción libre y repetible: un segundo enganche debe vetarse
    // (si no, cada repetición reinyectaría el tirón de calor — bug hallado por la revisión).
    expect(battle.checkVetoes({ type: 'overclock', unitId: 'R', on: true })?.systemId).toBe('strain');
    expect(() => battle.execute({ type: 'overclock', unitId: 'R', on: true })).toThrow(/ya está sobrecargado/);
    expect(battle.unit('R').components.heat!.current).toBe(heat);
  });

  it('una máquina sin reactor no puede sobrecargarse (no-op)', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'D');
    const dummy = battle.unit('D');

    const events = battle.execute({ type: 'overclock', unitId: 'D', on: true });
    expect(events).toEqual([]);
    expect(dummy.overclocked).toBeFalsy();

    // Aunque se fuerce la bandera, sin reactor el bono no se aplica.
    dummy.overclocked = true;
    expect(overclockModifiers(dummy)).toEqual([]);
  });
});

describe('Calor como encrucijada (interacciones)', () => {
  it('el calor atasca un arma pesada antes de dispararla', () => {
    const battle = rigBattle();
    untilTurnOf(battle, 'R');
    const unit = battle.unit('R');
    // 20 + 30 (calor del láser) desbordaría el reactor (máx 40).
    unit.components.heat!.current = 20;

    const veto = battle.checkVetoes({
      type: 'ability', unitId: 'R', abilityId: 'strike-laser-claw', target: { x: 2, y: 1 },
    });
    expect(veto?.systemId).toBe('heat');
    expect(veto?.reason).toMatch(/recalentaría/);
  });

  it('operar rodeado (≥2 enemigos adyacentes) recalienta al cerrar el turno', () => {
    const battle = rigBattle({
      spawns: [
        { id: 'R', name: 'Rig', unitTypeId: 'rig', team: 'player', position: { x: 2, y: 2 } },
        { id: 'D1', name: 'D1', unitTypeId: 'dummy', team: 'enemy', position: { x: 1, y: 2 } },
        { id: 'D2', name: 'D2', unitTypeId: 'dummy', team: 'enemy', position: { x: 3, y: 2 } },
      ],
    });
    untilTurnOf(battle, 'R');

    const events = battle.execute({ type: 'wait', unitId: 'R' });
    expect(events.some(
      (e) => e.type === 'heat-changed' && e.reason === 'strain' && e.delta === SURROUNDED_HEAT,
    )).toBe(true);
  });

  it('un solo enemigo adyacente no basta para recalentar', () => {
    const battle = rigBattle({
      spawns: [
        { id: 'R', name: 'Rig', unitTypeId: 'rig', team: 'player', position: { x: 2, y: 2 } },
        { id: 'D1', name: 'D1', unitTypeId: 'dummy', team: 'enemy', position: { x: 1, y: 2 } },
      ],
    });
    untilTurnOf(battle, 'R');

    const events = battle.execute({ type: 'wait', unitId: 'R' });
    expect(events.some((e) => e.type === 'heat-changed' && e.reason === 'strain')).toBe(false);
  });
});
