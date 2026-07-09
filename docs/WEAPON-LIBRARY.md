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

Presets en `WEAPON_LIBRARY_LOADOUTS` (armas montables en cualquier chasis):

| Rol | Preset | Armas |
| --- | --- | --- |
| Asalto | `striker` | Colmillo vibratorio, Sable termico, Garra monomolecular |
| Ruptura melee | `meleeBreaker` | Hacha de plasma, Pilote |
| Escaramuza | `skirmisher` | Autocanon gemelo, Carabina de plasma |
| Francotirador | `sniper` | Lanza railgun, Aguja termica |
| Ruptura | `breaker` | Martillo Gauss, Enjambre de micromisiles |
| Artilleria | `artillery` | Mortero de racimo, Cohete termobarico, Descarga de metralla, **Mortero incendiario** |
| Soporte | `support` | Haz de reparacion, Mortero de humo, Proyector de barrera |
| Control | `controller` | Lanza ionica, Aguja termica, Mortero de humo, Emisor de arco, **Lanzallamas de plasma** |
| Control de zona | `zoneControl` | Percutor sismico, Emisor de arco, Descarga de metralla, **Supresor** |

## Armas de calor, fuego y control (encajan con los ejes profundos)

Estas familias no son solo daño: interactuan con los sistemas de calor, control del campo y supresion, y la campaña las usa como **contras** (adaptacion de faccion) segun tu estilo de juego.

- **Termicas** (`lib-thermal-saber`, `lib-w-heat-needle`): vierten calor en el reactor del blanco, empujandolo al atasco de armas y al apagado. Contra a jugadores que fuerzan su reactor.
- **Incendiarias** (`lib-incendiary-mortar` con `ignites`, `lib-plasma-flamer`): PRENDEN la casilla de impacto. Quien cierra su turno sobre fuego se quema (daño de brasas) y se calienta. Control del campo.
- **Supresor** (`lib-suppressor`): FIJA al enemigo (estado `suprimido`): no puede contraatacar ni vigilar. Contra a los que cargan al cuerpo a cuerpo.
- **Humo** (`lib-smoke-mortar`): rompe la linea de tiro. Contra a los hostigadores a distancia.

## Notas de balance

- Las armas energeticas gastan energia y generan calor, pero no consumen municion.
- Las armas balisticas suelen consumir municion y pueden tener proyectil para animacion, dispersion, penetracion y empuje.
- Las armas PESADAS declaran `ctCost`: pegan fuerte, calientan y te RETRASAN (tempo). El peso es una decision, no gratis.
- `lib-w-gauss-hammer` tiene masa suficiente para activar el empuje fisico existente.
- Las armas de soporte reutilizan estados ya existentes (`evasion-up`, `armor-up`) o curacion, asi que no requieren sistemas nuevos.
- Los IDs usan el prefijo `lib-` para evitar colisiones con el contenido base. NINGUNA arma de la biblioteca entra en el golden master (las batallas del golden usan solo el catalogo base), asi que ampliar la biblioteca es golden-safe.
