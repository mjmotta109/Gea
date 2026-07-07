import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import { SCHOOL_ABILITY } from '../src/data/progression.js';

const CATALOGS = withWeaponLibrary(ABILITIES, WEAPONS);
import { SPECIALIZATIONS } from '../src/core/progression.js';

// Habilidades ACTIVAS de escuela: otorgadas al desplegar, una por batalla.

const P = (id: string, unitTypeId: string, x: number, y: number, extra?: string[]): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'player', position: { x, y }, ...(extra ? { extraAbilityIds: extra } : {}) });
const E = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'enemy', position: { x, y } });

function arena(overrides: Partial<BattleConfig>): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog,
    weaponCatalog: CATALOGS.weaponCatalog,
    seed: 17,
    spawns: [],
    ...overrides,
  });
}

describe('habilidades de escuela: activas, otorgadas y con cupo', () => {
  it('cada escuela tiene su habilidad, y todas son de un uso por batalla', () => {
    for (const spec of SPECIALIZATIONS) {
      const ability = ABILITIES[SCHOOL_ABILITY[spec]];
      expect(ability, spec).toBeDefined();
      expect(ability!.usesPerBattle).toBe(1);
    }
  });

  it('las otorgadas aparecen en el repertorio; sin otorgar, no existen', () => {
    const battle = arena({
      spawns: [
        P('P1', 'iron-kong', 1, 2, ['escuela-asalto']),
        P('P2', 'iron-kong', 1, 4),
        E('E1', 'molga', 6, 2),
      ],
    });
    expect(battle.knownAbilityIds(battle.unit('P1'))).toContain('escuela-asalto');
    expect(battle.knownAbilityIds(battle.unit('P2'))).not.toContain('escuela-asalto');
  });

  it('una por batalla: el segundo uso se rechaza y el cupo se ve', () => {
    const battle = arena({
      spawns: [P('P1', 'iron-kong', 2, 2, ['escuela-asalto']), E('E1', 'iron-kong', 3, 2)],
    });
    battle.nextTurn();
    // El kong es lento pero aquí es el único jugador: forzamos su turno.
    while (battle.getActiveUnit()?.id !== 'P1') {
      battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
      battle.nextTurn();
    }
    expect(battle.usesLeft(battle.unit('P1'), 'escuela-asalto')).toBe(1);
    battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'escuela-asalto', target: { x: 3, y: 2 } });
    expect(battle.usesLeft(battle.unit('P1'), 'escuela-asalto')).toBe(0);
    // Turno nuevo: sigue agotada — el cupo es POR BATALLA, no por turno.
    battle.execute({ type: 'wait', unitId: 'P1' });
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    expect(() =>
      battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'escuela-asalto', target: { x: 3, y: 2 } }),
    ).toThrow(/agotada/);
  });

  it('las habilidades sin cupo siguen siendo ilimitadas', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 2, 2), E('E1', 'molga', 6, 2)],
    });
    battle.nextTurn();
    expect(battle.usesLeft(battle.unit('P1'), 'bite-crush')).toBeUndefined();
  });

  it('la postura de hierro se lanza sobre uno mismo y aplica sus dos escudos', () => {
    const battle = arena({
      spawns: [P('P1', 'iron-kong', 2, 2, ['escuela-defensa']), E('E1', 'molga', 7, 5)],
    });
    while (battle.getActiveUnit()?.id !== 'P1') {
      if (!battle.getActiveUnit()) battle.nextTurn();
      else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    }
    const events = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'escuela-defensa', target: { x: 2, y: 2 },
    });
    const statuses = events.filter((e) => e.type === 'status-applied').map((e) =>
      e.type === 'status-applied' ? e.status : '');
    expect(statuses).toContain('armor-up');
    expect(statuses).toContain('evasion-up');
  });
});
