import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

function garage(loadout?: { slots?: Record<string, string>; weapons?: string[] }) {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed: 4,
    spawns: [
      { id: 'L', name: 'Liger', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 0, y: 0 }, loadout },
      { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 7, y: 5 } },
    ],
  });
}

describe('garaje: loadouts al desplegar', () => {
  it('sin loadout, la unidad sale de fábrica', () => {
    const battle = garage();
    const liger = battle.unit('L');
    expect(battle.effectiveStats(liger).maxHp).toBe(120);
    expect(liger.components.arsenal!.weapons[0]!.weaponId).toBe('w-strike-laser-claw');
  });

  it('cambiar el arsenal cambia las armas montadas', () => {
    const battle = garage({ weapons: ['w-impact-cannon'] });
    const liger = battle.unit('L');
    expect(liger.components.arsenal!.weapons.map((w) => w.weaponId)).toEqual(['w-impact-cannon']);
    // La habilidad del arma nueva es conocida; la de la vieja ya no.
    expect(battle.knownAbilityIds(liger)).toContain('shock-cannon');
    expect(battle.knownAbilityIds(liger)).not.toContain('strike-laser-claw');
  });

  it('sustituir un módulo cambia stats y maxHp derivado', () => {
    // La mochila del Liger (16 hp, evade+5) se cambia por la cola del Geno
    // (14 hp, atk+10): pierde evasión y HP, gana ataque.
    const stock = garage();
    const custom = garage({ slots: { backpack: 'geno-tail' } });
    const stockStats = stock.effectiveStats(stock.unit('L'));
    const customStats = custom.effectiveStats(custom.unit('L'));
    expect(customStats.maxHp).toBe(stockStats.maxHp - 2); // 16→14
    expect(customStats.evade).toBe(stockStats.evade - 5);
    expect(customStats.atk).toBe(stockStats.atk + 10);
    expect(custom.unit('L').hp).toBe(118);
  });

  it('rechaza slots que el chasis no tiene y loadout sin frame', () => {
    expect(() => garage({ slots: { 'weapon-cannon': 'geno-tail' } })).toThrow(/no tiene el slot/);
    expect(() => new Battle({
      map: FLAT_ARENA,
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      weaponCatalog: WEAPONS,
      seed: 4,
      spawns: [
        { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'player', position: { x: 0, y: 0 }, loadout: { slots: { torso: 'geno-torso' } } },
      ],
    })).toThrow(/sin frame/);
  });
});
