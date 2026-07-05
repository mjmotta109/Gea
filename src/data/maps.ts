import { GameMap } from '../core/grid.js';

/**
 * Mapas de ejemplo en formato ASCII:
 *   0-9  llanura con altura
 *   a-j  terreno abrupto (coste 2) con altura 0-9
 *   A-J  bosque (coste 2, cobertura, la copa bloquea la visión) altura 0-9
 *   ~    agua (solo voladores/anfibios)
 *   #    muro intransitable
 */

/** Valle con río central, colinas en los flancos y bosques que cortan
 *  las líneas de tiro largas (fase 3). */
export const VALLEY_CROSSING = GameMap.fromAscii([
  '0000111~2222',
  '0000011~1222',
  '000aa11~1122',
  '00aaa0000112',
  '000000AA0011',
  '000~~~0A0001',
  '00~~~~~00000',
  '00BB00000b00',
  '00BB000bbb00',
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
