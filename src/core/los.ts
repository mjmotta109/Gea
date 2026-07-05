import type { GameMap } from './grid.js';
import type { Position } from './types.js';

/**
 * Línea de visión (fase 3): un tiro/mirada entre dos casillas queda
 * bloqueado por muros, por relieve más alto que la línea de mira y por
 * las copas de los bosques intermedios.
 *
 * Modelo: se traza el segmento entre los centros de ambas casillas a la
 * altura de los "ojos" (altura del tile + EYE_HEIGHT) y se muestrea a
 * intervalos regulares; si alguna casilla intermedia tiene altura de
 * bloqueo ≥ la altura de la línea en ese punto, no hay visión.
 *
 * Consecuencias de diseño, deliberadas:
 *  - Estar DENTRO de un bosque no te ciega ni te oculta (las casillas
 *    origen y destino se excluyen): el bosque da cobertura (TERRAIN_COVER),
 *    pero disparar A TRAVÉS de él está bloqueado por la copa.
 *  - Ganar altura permite disparar por encima de obstáculos bajos, y
 *    ser más alto que el tirador no te protege de quien domina la loma.
 *  - Determinista y puro: mismas casillas ⇒ mismo resultado, sin RNG.
 */

/** Altura de los sensores/cabina sobre el suelo del tile, en medios niveles. */
const EYE_HEIGHT = 2;
/** Altura extra de bloqueo que aporta la copa de un bosque intermedio. */
const CANOPY_HEIGHT = 2;
/** Muestras por unidad de distancia al trazar la línea. */
const SAMPLES_PER_TILE = 4;

function blockingHeight(map: GameMap, pos: Position): number {
  const tile = map.tileAt(pos);
  if (tile.terrain === 'wall') return Infinity;
  return tile.height + (tile.terrain === 'forest' ? CANOPY_HEIGHT : 0);
}

export function hasLineOfSight(map: GameMap, from: Position, to: Position): boolean {
  if (!map.inBounds(from) || !map.inBounds(to)) return false;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  // Casillas adyacentes (ortogonal o diagonal) siempre se ven.
  if (dist <= Math.SQRT2 + 1e-9) return true;

  const eyeFrom = map.tileAt(from).height + EYE_HEIGHT;
  const eyeTo = map.tileAt(to).height + EYE_HEIGHT;

  const steps = Math.ceil(dist * SAMPLES_PER_TILE);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const cell = {
      x: Math.round(from.x + dx * t),
      y: Math.round(from.y + dy * t),
    };
    if ((cell.x === from.x && cell.y === from.y) || (cell.x === to.x && cell.y === to.y)) {
      continue;
    }
    const lineHeight = eyeFrom + (eyeTo - eyeFrom) * t;
    if (blockingHeight(map, cell) >= lineHeight) return false;
  }
  return true;
}
