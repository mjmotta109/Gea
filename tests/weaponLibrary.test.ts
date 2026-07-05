import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { ABILITIES } from '../src/data/abilities.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';
import {
  WEAPON_LIBRARY_ABILITIES,
  WEAPON_LIBRARY_ENTRIES,
  WEAPON_LIBRARY_LOADOUTS,
  WEAPON_LIBRARY_WEAPONS,
  withWeaponLibrary,
} from '../src/data/weaponLibrary.js';

describe('libreria anexa de armas', () => {
  it('cada arma apunta a una habilidad existente del anexo', () => {
    for (const weapon of Object.values(WEAPON_LIBRARY_WEAPONS)) {
      expect(WEAPON_LIBRARY_ABILITIES[weapon.abilityId]).toBeDefined();
    }
  });

  it('los metadatos y presets solo referencian armas existentes', () => {
    for (const [id, entry] of Object.entries(WEAPON_LIBRARY_ENTRIES)) {
      expect(entry.weaponId).toBe(id);
      expect(WEAPON_LIBRARY_WEAPONS[entry.weaponId]).toBeDefined();
      expect(WEAPON_LIBRARY_ABILITIES[entry.abilityId]).toBeDefined();
    }

    for (const loadout of Object.values(WEAPON_LIBRARY_LOADOUTS)) {
      for (const weaponId of loadout) {
        expect(WEAPON_LIBRARY_WEAPONS[weaponId]).toBeDefined();
      }
    }
  });

  it('se mezcla con los catalogos base sin pisar IDs existentes', () => {
    const { abilityCatalog, weaponCatalog } = withWeaponLibrary(ABILITIES, WEAPONS);

    expect(abilityCatalog['strike-laser-claw']).toBe(ABILITIES['strike-laser-claw']);
    expect(weaponCatalog['w-strike-laser-claw']).toBe(WEAPONS['w-strike-laser-claw']);
    expect(abilityCatalog['lib-rail-lance']).toBe(WEAPON_LIBRARY_ABILITIES['lib-rail-lance']);
    expect(weaponCatalog['lib-w-rail-lance']).toBe(WEAPON_LIBRARY_WEAPONS['lib-w-rail-lance']);
  });

  it('un Battle puede montar un loadout del anexo sin cambiar el motor', () => {
    const { abilityCatalog, weaponCatalog } = withWeaponLibrary(ABILITIES, WEAPONS);
    const battle = new Battle({
      map: FLAT_ARENA,
      unitCatalog: ZOIDS,
      abilityCatalog,
      moduleCatalog: MODULES,
      weaponCatalog,
      seed: 17,
      spawns: [
        {
          id: 'wolf',
          name: 'Command Wolf personalizado',
          unitTypeId: 'command-wolf',
          team: 'player',
          position: { x: 0, y: 0 },
          loadout: { weapons: WEAPON_LIBRARY_LOADOUTS.skirmisher },
        },
        { id: 'target', name: 'Molga objetivo', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
      ],
    });

    const wolf = battle.unit('wolf');
    expect(wolf.components.arsenal!.weapons.map((w) => w.weaponId)).toEqual(WEAPON_LIBRARY_LOADOUTS.skirmisher);
    expect(battle.knownAbilityIds(wolf)).toContain('lib-twin-autocannon');
    expect(battle.knownAbilityIds(wolf)).toContain('lib-plasma-carbine');
  });
});
