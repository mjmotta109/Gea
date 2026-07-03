import { GameMap } from '../core/grid.js';

/**
 * Mapas de ejemplo en formato ASCII:
 *   0-9  llanura con altura
 *   a-j  terreno abrupto (coste 2) con altura 0-9
 *   ~    agua (solo voladores/anfibios)
 *   #    muro intransitable
 */

/** Valle con un río central, un puente y colinas en los flancos. */
export const VALLEY_CROSSING = GameMap.fromAscii([
  '0000111~2222',
  '0000011~1222',
  '000aa11~1122',
  '00aaa0000112',
  '000000000011',
  '000~~~000001',
  '00~~~~~00000',
  '001100000b00',
  '0011000bbb00',
  '00000000bb00',
]);

/** Arena pequeña y plana, útil para tests y duelos rápidos. */
export const FLAT_ARENA = GameMap.fromAscii([
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
]);
