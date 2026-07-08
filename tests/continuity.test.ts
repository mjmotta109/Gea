import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import type { UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { FLAT_ARENA } from '../src/data/maps.js';

const RIG: UnitDefinition = {
  id: 'rig', name: 'Rig', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 100, atk: 30, energyAtk: 30, def: 20, energyDef: 20, speed: 10, move: 4, jump: 1, evade: 10, accuracy: 0 },
  abilityIds: ['bite-crush'],
  energy: { capacity: 50, outputPerTurn: 10 }, heat: { max: 40, dissipationPerTurn: 10 },
  weapons: ['w-rig-rifle'],
};
const DUMMY: UnitDefinition = {
  id: 'dummy', name: 'Blanco', role: 'tank', moveType: 'ground',
  stats: { maxHp: 500, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 1, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};
const WEAPONS: Record<string, WeaponDefinition> = {
  'w-rig-rifle': { id: 'w-rig-rifle', name: 'Rifle', abilityId: 'shock-cannon', costs: { heat: 5 }, magazine: 3, reserves: 1 },
};

function build(spawnP: Partial<UnitSpawn>): Battle {
  return new Battle({
    map: FLAT_ARENA, unitCatalog: { rig: RIG, dummy: DUMMY }, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS,
    seed: 5,
    spawns: [
      { id: 'R', name: 'Rig', unitTypeId: 'rig', team: 'player', position: { x: 1, y: 1 }, ...spawnP },
      { id: 'D', name: 'D', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 1 } },
    ],
  });
}

describe('Continuidad expedición↔combate', () => {
  it('sin campos, la unidad entra de fábrica (golden-safe)', () => {
    const r = build({}).unit('R');
    expect(r.components.heat!.current).toBe(0);
    expect(r.components.energy!.current).toBe(50);
    expect(r.components.arsenal!.weapons[0]!.ammo).toBe(3);
  });

  it('initialHeat entra con calor residual (acotado a max, sin apagar turno 1)', () => {
    const battle = build({ initialHeat: 100 }); // 100 > max 40 → se acota a 40
    expect(battle.unit('R').components.heat!.current).toBe(40);
    const events = battle.nextTurn(); // abre turno de R (el más rápido): entrar a tope NO apaga
    expect(events.some((e) => e.type === 'unit-shutdown')).toBe(false);
  });

  it('el calor residual degrada la puntería vía el pipeline', () => {
    const battle = build({ initialHeat: 30 }); // 30/40 = 75% ≥ umbral alto
    expect(battle.effectiveStats(battle.unit('R')).accuracy).toBe(-15);
  });

  it('initialEnergy=0 deja la energía agotada (penalización y veto)', () => {
    const battle = build({ initialEnergy: 0 });
    expect(battle.unit('R').components.energy!.current).toBe(0);
    expect(battle.effectiveStats(battle.unit('R')).evade).toBe(10 - 10);
    expect(battle.checkVetoes({ type: 'boost', unitId: 'R', to: { x: 1, y: 2 } })?.systemId).toBe('energy');
  });

  it('munición residual: cargador a 0 veta el arma', () => {
    const battle = build({ ammo: { 'w-rig-rifle': 0 } });
    expect(battle.unit('R').components.arsenal!.weapons[0]!.ammo).toBe(0);
    expect(battle.checkVetoes({ type: 'ability', unitId: 'R', abilityId: 'shock-cannon', target: { x: 4, y: 1 } })?.reason)
      .toMatch(/munición/);
  });

  it('valores corruptos (NaN) caen a fábrica, no propagan basura', () => {
    const r = build({ initialHeat: NaN, initialEnergy: NaN, ammo: { 'w-rig-rifle': NaN } }).unit('R');
    expect(r.components.heat!.current).toBe(0);
    expect(r.components.energy!.current).toBe(50);
    expect(r.components.arsenal!.weapons[0]!.ammo).toBe(3);
  });
});
