import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import { ZOIDS } from '../src/data/zoids.js';

/**
 * Red de seguridad de contenido: los chasis de 2ª generación montan armas
 * `lib-*` que solo existen en la biblioteca anexa. Si un catálogo se arma
 * sin withWeaponLibrary() esos chasis revientan al desplegarse — y nada de
 * tipos lo impide. Este test recorre TODO el catálogo con el catálogo
 * canónico (el mismo que arma el cliente web) y verifica que cada chasis se
 * instancia y que toda arma/habilidad que referencia existe de verdad.
 */
const { abilityCatalog, weaponCatalog } = withWeaponLibrary(ABILITIES, WEAPONS);

function deploy(unitTypeId: string, catalogs = { abilityCatalog, weaponCatalog }): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: catalogs.abilityCatalog,
    weaponCatalog: catalogs.weaponCatalog,
    moduleCatalog: MODULES,
    seed: 1,
    spawns: [{ id: 'U', name: unitTypeId, unitTypeId, team: 'player', position: { x: 1, y: 1 } }],
  });
}

describe('integridad de datos: todos los chasis se despliegan con el catálogo canónico', () => {
  for (const id of Object.keys(ZOIDS)) {
    it(`'${id}' se despliega y todas sus armas/habilidades existen`, () => {
      let battle!: Battle;
      expect(() => { battle = deploy(id); }).not.toThrow();
      // Toda habilidad conocida (innata o de arma montada) debe resolver.
      const unit = battle.unit('U');
      for (const abilityId of battle.knownAbilityIds(unit)) {
        expect(() => battle.abilityOf(abilityId)).not.toThrow();
      }
    });
  }
});

describe('daño localizado: los chasis con frame se ven en batalla', () => {
  // Los 7 chasis de combate que ganaron frame a medida (2026-07-09) + los 2 de
  // núcleo desnudo. Si alguno pierde el frame o descuadra su HP, salta aquí.
  const FRAMED = [
    'liger-zero', 'command-wolf', 'gun-sniper', 'gojulas', 'iron-kong', 'pteras', 'geno-saurer',
    'liger-zero-cas', 'geno-saurer-cp',
  ];

  for (const id of FRAMED) {
    it(`'${id}' tiene frame y sus módulos suman su maxHp`, () => {
      const unit = deploy(id).unit('U');
      const frame = unit.components.frame;
      expect(frame).toBeDefined();
      const sum = frame!.modules.reduce((n, m) => n + m.hp, 0);
      expect(sum).toBe(ZOIDS[id]!.stats.maxHp);
      // Un frame de combate tiene exactamente un núcleo crítico y piezas con placa.
      const cores = frame!.modules.filter((m) => MODULES[m.moduleId]!.critical);
      expect(cores).toHaveLength(1);
      expect(frame!.modules.some((m) => m.plating > 0)).toBe(true);
    });
  }
});

describe('el catálogo sin biblioteca falla con un mensaje útil', () => {
  it('un chasis lib-* nombra el chasis y sugiere withWeaponLibrary', () => {
    // brachios monta lib-w-arc-emitter, ausente del catálogo base WEAPONS.
    const build = () => deploy('brachios', { abilityCatalog: ABILITIES, weaponCatalog: WEAPONS });
    expect(build).toThrow(/brachios/);
    expect(build).toThrow(/withWeaponLibrary/);
  });
});
