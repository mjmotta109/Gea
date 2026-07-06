import { footprintTiles, GameMap, samePos } from './grid.js';
import type { Position, UnitState } from './types.js';

/**
 * Física mínima del motor (fase 4). Interfaces pensadas para crecer
 * (estabilidad por peso de módulos, retroceso, centro de gravedad); hoy
 * implementan un único efecto demostrativo: el empuje por impacto masivo.
 */

/** Perfil físico futuro de una unidad; hoy solo documenta el contrato. */
export interface PhysicsProfile {
  mass: number;
  /** 0-1: resistencia a ser desplazado; derivará del peso de los módulos. */
  stability: number;
}

/** Masa de proyectil a partir de la cual un impacto empuja al objetivo. */
export const KNOCKBACK_MASS_THRESHOLD = 3;

/**
 * Casilla a la que un impacto empujaría al objetivo: una casilla en la
 * dirección atacante→objetivo (eje dominante). null si el destino está
 * ocupado, es intransitable, se sale del mapa o exige salvar más de un
 * medio nivel de altura.
 */
export function knockbackDestination(
  map: GameMap,
  attackerPos: Position,
  victim: UnitState,
  units: UnitState[],
): Position | null {
  // Las bestias multi-casilla no se mueven ni con un cañonazo.
  if (victim.size > 1) return null;
  const dx = victim.position.x - attackerPos.x;
  const dy = victim.position.y - attackerPos.y;
  const step = Math.abs(dx) >= Math.abs(dy)
    ? { x: Math.sign(dx), y: 0 }
    : { x: 0, y: Math.sign(dy) };
  if (step.x === 0 && step.y === 0) return null;

  const dest = { x: victim.position.x + step.x, y: victim.position.y + step.y };
  if (!map.inBounds(dest)) return null;
  if (!isFinite(map.entryCost(dest, 'ground')) && !isFinite(map.entryCost(dest, 'amphibious'))) {
    return null; // muro; el agua sí recibe empujados (chapoteo incluido)
  }
  const heightDiff = map.tileAt(dest).height - map.tileAt(victim.position).height;
  if (heightDiff > 1) return null; // cuesta arriba no se empuja; caer sí
  if (units.some((u) => u.hp > 0 && !u.retreated && u.id !== victim.id &&
    footprintTiles(u.position, u.size).some((t) => samePos(t, dest)))) return null;
  return dest;
}
