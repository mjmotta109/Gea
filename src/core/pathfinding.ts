import { CARDINAL_OFFSETS, GameMap, posKey } from './grid.js';
import type { MoveType, Position, Team, UnitState } from './types.js';

export interface ReachableTile {
  pos: Position;
  cost: number;
  /** Camino completo desde el origen hasta este tile (incluye origen). */
  path: Position[];
}

interface MoverProfile {
  move: number;
  jump: number;
  moveType: MoveType;
  team: Team;
}

/**
 * Dijkstra sobre la rejilla respetando coste de terreno, salto entre
 * alturas y oclusión: no se atraviesan enemigos, sí aliados, pero solo
 * se puede terminar en tiles libres.
 */
export function reachableTiles(
  map: GameMap,
  origin: Position,
  mover: MoverProfile,
  units: UnitState[],
): ReachableTile[] {
  const blockers = new Map<string, Team>();
  for (const u of units) {
    if (u.hp > 0 && !(u.position.x === origin.x && u.position.y === origin.y)) {
      blockers.set(posKey(u.position), u.team);
    }
  }

  const best = new Map<string, ReachableTile>();
  best.set(posKey(origin), { pos: origin, cost: 0, path: [origin] });
  // El mapa es pequeño: una frontera simple ordenada por coste basta.
  const frontier: ReachableTile[] = [{ pos: origin, cost: 0, path: [origin] }];

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost);
    const current = frontier.shift()!;
    if (current.cost > (best.get(posKey(current.pos))?.cost ?? Infinity)) continue;

    const currentHeight = map.tileAt(current.pos).height;
    for (const offset of CARDINAL_OFFSETS) {
      const next: Position = { x: current.pos.x + offset.x, y: current.pos.y + offset.y };
      if (!map.inBounds(next)) continue;

      const stepCost = map.entryCost(next, mover.moveType);
      if (!isFinite(stepCost)) continue;

      // Los voladores ignoran diferencias de altura.
      if (mover.moveType !== 'flying') {
        const heightDiff = Math.abs(map.tileAt(next).height - currentHeight);
        if (heightDiff > mover.jump) continue;
      }

      const blockerTeam = blockers.get(posKey(next));
      if (blockerTeam !== undefined && blockerTeam !== mover.team) continue;

      const totalCost = current.cost + stepCost;
      if (totalCost > mover.move) continue;

      const key = posKey(next);
      if (totalCost < (best.get(key)?.cost ?? Infinity)) {
        const entry: ReachableTile = { pos: next, cost: totalCost, path: [...current.path, next] };
        best.set(key, entry);
        frontier.push(entry);
      }
    }
  }

  // No se puede terminar el movimiento sobre otra unidad (ni aliada).
  const result: ReachableTile[] = [];
  for (const entry of best.values()) {
    if (blockers.has(posKey(entry.pos))) continue;
    result.push(entry);
  }
  return result;
}

/**
 * Tiles que una habilidad puede tener como objetivo desde una posición.
 * 'single' y 'cross' usan distancia Manhattan; 'line' exige línea recta.
 */
export function targetableTiles(
  map: GameMap,
  origin: Position,
  range: number,
  minRange: number,
  shape: 'single' | 'cross' | 'line',
): Position[] {
  const tiles: Position[] = [];
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const pos = { x, y };
      const dist = Math.abs(x - origin.x) + Math.abs(y - origin.y);
      if (dist < minRange || dist > range) continue;
      if (shape === 'line' && x !== origin.x && y !== origin.y) continue;
      if (map.tileAt(pos).terrain === 'wall') continue;
      tiles.push(pos);
    }
  }
  return tiles;
}

/** Tiles afectados por el área de una habilidad centrada en `center`. */
export function aoeTiles(map: GameMap, center: Position, radius: number): Position[] {
  if (radius === 0) return map.inBounds(center) ? [center] : [];
  const tiles: Position[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const pos = { x, y };
      if (!map.inBounds(pos)) continue;
      if (Math.abs(x - center.x) + Math.abs(y - center.y) > radius) continue;
      if (map.tileAt(pos).terrain === 'wall') continue;
      tiles.push(pos);
    }
  }
  return tiles;
}
