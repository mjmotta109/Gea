# Libreria anexa de armas

Este anexo agrega una libreria de armas personalizables sin modificar el motor ni los catalogos base. Vive en `src/data/weaponLibrary.ts` y exporta:

- `WEAPON_LIBRARY_ABILITIES`: habilidades declarativas compatibles con `AbilityDefinition`.
- `WEAPON_LIBRARY_WEAPONS`: armas montadas compatibles con `WeaponDefinition`.
- `WEAPON_LIBRARY_ENTRIES`: metadatos de diseno para UI, garaje o balance.
- `WEAPON_LIBRARY_LOADOUTS`: presets de armas por rol.
- `withWeaponLibrary()`: helper para mezclar la libreria con los catalogos base.

## Uso basico

```ts
import { Battle } from '../src/core/battle.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { withWeaponLibrary, WEAPON_LIBRARY_LOADOUTS } from '../src/data/weaponLibrary.js';

const { abilityCatalog, weaponCatalog } = withWeaponLibrary(ABILITIES, WEAPONS);

const battle = new Battle({
  map,
  unitCatalog,
  abilityCatalog,
  weaponCatalog,
  moduleCatalog,
  seed: 42,
  spawns: [
    {
      id: 'wolf-1',
      name: 'Wolf personalizado',
      unitTypeId: 'command-wolf',
      team: 'player',
      position: { x: 1, y: 1 },
      loadout: { weapons: WEAPON_LIBRARY_LOADOUTS.skirmisher },
    },
  ],
});
```

## Filosofia de compatibilidad

Las armas del anexo no tienen `mountSlot` por defecto. Eso las hace compatibles con unidades monocasco y unidades con frame modular. Si una campana quiere que un arma dependa de un modulo concreto, puede clonar la entrada y agregar `mountSlot` en su propio catalogo:

```ts
const campaignWeapons = {
  ...WEAPON_LIBRARY_WEAPONS,
  'campaign-back-rail-lance': {
    ...WEAPON_LIBRARY_WEAPONS['lib-w-rail-lance'],
    id: 'campaign-back-rail-lance',
    mountSlot: 'backpack',
  },
};
```

## Familias incluidas

| Rol | Preset | Armas |
| --- | --- | --- |
| Asalto | `striker` | Colmillo vibratorio, Sable termico |
| Escaramuza | `skirmisher` | Autocanon gemelo, Carabina de plasma |
| Francotirador | `sniper` | Lanza railgun, Aguja termica |
| Ruptura | `breaker` | Martillo Gauss, Enjambre de micromisiles |
| Soporte | `support` | Haz de reparacion, Mortero de humo, Proyector de barrera |
| Control | `controller` | Lanza ionica, Aguja termica, Mortero de humo |

## Notas de balance

- Las armas energeticas gastan energia y generan calor, pero no consumen municion.
- Las armas balisticas suelen consumir municion y pueden tener proyectil para animacion, dispersion, penetracion y empuje.
- `lib-w-gauss-hammer` tiene masa suficiente para activar el empuje fisico existente.
- Las armas de soporte reutilizan estados ya existentes (`evasion-up`, `armor-up`) o curacion, asi que no requieren sistemas nuevos.
- Los IDs usan el prefijo `lib-` para evitar colisiones con el contenido base.
