import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { YANTRAS } from '../src/data/yantras.js';

function garage(loadout?: { slots?: Record<string, string>; weapons?: string[] }) {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: YANTRAS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed: 4,
    spawns: [
      { id: 'L', name: 'Centella', unitTypeId: 'centella-m', team: 'player', position: { x: 0, y: 0 }, loadout },
      { id: 'M', name: 'Tornillo', unitTypeId: 'tornillo', team: 'enemy', position: { x: 7, y: 5 } },
    ],
  });
}

describe('garaje: loadouts al desplegar', () => {
  it('sin loadout, la unidad sale de fábrica', () => {
    const battle = garage();
    const centella = battle.unit('L');
    expect(battle.effectiveStats(centella).maxHp).toBe(120);
    expect(centella.components.arsenal!.weapons[0]!.weaponId).toBe('w-arc-claw');
  });

  it('cambiar el arsenal cambia las armas montadas', () => {
    const battle = garage({ weapons: ['w-impact-cannon'] });
    const centella = battle.unit('L');
    expect(centella.components.arsenal!.weapons.map((w) => w.weaponId)).toEqual(['w-impact-cannon']);
    // La habilidad del arma nueva es conocida; la de la vieja ya no.
    expect(battle.knownAbilityIds(centella)).toContain('shock-cannon');
    expect(battle.knownAbilityIds(centella)).not.toContain('arc-claw');
  });

  it('sustituir un módulo cambia stats y maxHp derivado', () => {
    // La mochila del Centella (16 hp, evade+5) se cambia por la cola del Prisma
    // (14 hp, atk+10): pierde evasión y HP, gana ataque.
    const stock = garage();
    const custom = garage({ slots: { backpack: 'pm-cola' } });
    const stockStats = stock.effectiveStats(stock.unit('L'));
    const customStats = custom.effectiveStats(custom.unit('L'));
    expect(customStats.maxHp).toBe(stockStats.maxHp - 2); // 16→14
    expect(customStats.evade).toBe(stockStats.evade - 5);
    expect(customStats.atk).toBe(stockStats.atk + 10);
    expect(custom.unit('L').hp).toBe(118);
  });

  it('rechaza slots que el chasis no tiene y loadout sin frame', () => {
    expect(() => garage({ slots: { 'weapon-cannon': 'pm-cola' } })).toThrow(/no tiene el slot/);
    expect(() => new Battle({
      map: FLAT_ARENA,
      unitCatalog: YANTRAS,
      abilityCatalog: ABILITIES,
      weaponCatalog: WEAPONS,
      seed: 4,
      spawns: [
        { id: 'M', name: 'Tornillo', unitTypeId: 'tornillo', team: 'player', position: { x: 0, y: 0 }, loadout: { slots: { torso: 'pm-torso' } } },
      ],
    })).toThrow(/sin frame/);
  });
});
