import { describe, expect, it } from 'vitest';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPON_LIBRARY_ABILITIES, WEAPON_LIBRARY_WEAPONS } from '../src/data/weaponLibrary.js';

/**
 * Red de seguridad del rebranding (docs/RENOMBRES.md). Los nombres MOSTRADOS
 * no pueden contener términos de la franquicia: si alguien añade un chasis o
 * un arma copiando de la referencia, salta aquí y no en la página de Steam.
 * Los IDS internos SÍ los conservan a propósito (no se publican y cambiarlos
 * exigiría migrar guardados) — por eso se revisan solo los nombres.
 */
const PROHIBIDOS = [
  'Zoid', 'Liger', 'Gojulas', 'Molga', 'Pteras', 'Gustav', 'Geno', 'Saurer',
  'Kong', 'Dibison', 'Gordos', 'Redler', 'Guysak', 'Brachios', 'Zaber',
  'Sworder', 'König', 'Konig', 'Naomi', 'Irvine', 'Moonbay', 'Fiona',
  'Strike Laser', 'Rev Raptor',
];

const catalogos: Array<[string, Array<{ id: string; name: string }>]> = [
  ['chasis', Object.values(ZOIDS)],
  ['habilidades', Object.values(ABILITIES)],
  ['armas', Object.values(WEAPONS)],
  ['biblioteca: habilidades', Object.values(WEAPON_LIBRARY_ABILITIES)],
  ['biblioteca: armas', Object.values(WEAPON_LIBRARY_WEAPONS)],
  ['módulos', Object.values(MODULES)],
];

describe('rebranding: ningún nombre mostrado huele a franquicia', () => {
  for (const [etiqueta, entradas] of catalogos) {
    it(`${etiqueta}: nombres limpios`, () => {
      const sucios = entradas
        .filter((e) => PROHIBIDOS.some((t) => e.name.toLowerCase().includes(t.toLowerCase())))
        .map((e) => `${e.id} → "${e.name}"`);
      expect(sucios).toEqual([]);
    });
  }

  it('el término del universo es «armazón», no «zoid»', () => {
    const todos = catalogos.flatMap(([, e]) => e).map((e) => e.name).join(' | ');
    expect(todos.toLowerCase()).not.toContain('zoid');
  });
});
