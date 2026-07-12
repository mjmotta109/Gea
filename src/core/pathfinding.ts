import { CARDINAL_OFFSETS, footprintTiles, GameMap, posKey } from './grid.js';
import type { MoveType, Position, Team, UnitState } from './types.js';

/**
 * Coste de movimiento extra por cada nivel de altura que un no-volador
 * escala (o baja) POR ENCIMA de su `jump`. Ya no hay tope de salto: si le
 * alcanza el movimiento, escala cualquier desnivel — pero escalar cuesta.
 */
export const CLIMB_COST_PER_LEVEL = 2;

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
  /** Casillas de lado del que se mueve (1 por defecto; 2 = huella 2×2). */
  size?: number;
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
  const size = mover.size ?? 1;
  const blockers = new Map<string, Team>();
  for (const u of units) {
    if (u.hp > 0 && !u.retreated && !(u.position.x === origin.x && u.position.y === origin.y)) {
      for (const tile of footprintTiles(u.position, u.size)) {
        blockers.set(posKey(tile), u.team);
      }
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
      // La huella completa debe caber: bordes, terreno, salto y enemigos
      // se comprueban casilla a casilla para las unidades grandes.
      const stamp = footprintTiles(next, size);
      if (stamp.some((t) => !map.inBounds(t))) continue;

      const stepCost = map.entryCost(next, mover.moveType);
      if (stamp.some((t) => !isFinite(map.entryCost(t, mover.moveType)))) continue;

      // Escalar cuesta: los voladores ignoran las alturas; el resto puede
      // subir o bajar CUALQUIER desnivel, pero paga movimiento extra por
      // cada nivel que exceda su salto. Ya no hay tope de altura.
      let climbCost = 0;
      if (mover.moveType !== 'flying') {
        for (const t of stamp) {
          const over = Math.abs(map.tileAt(t).height - currentHeight) - mover.jump;
          if (over > 0) climbCost = Math.max(climbCost, over * CLIMB_COST_PER_LEVEL);
        }
      }

      if (stamp.some((t) => {
        const blockerTeam = blockers.get(posKey(t));
        return blockerTeam !== undefined && blockerTeam !== mover.team;
      })) continue;

      const totalCost = current.cost + stepCost + climbCost;
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
    if (footprintTiles(entry.pos, size).some((t) => blockers.has(posKey(t)))) continue;
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

/**
 * Tiles afectados por el área de una habilidad centrada en `center`.
 * `includeWalls` los incluye (para demolición por explosión, fase 4).
 */
export function aoeTiles(map: GameMap, center: Position, radius: number, includeWalls = false): Position[] {
  if (radius === 0) return map.inBounds(center) ? [center] : [];
  const tiles: Position[] = [];
  for (let y = center.y - radius; y <= center.y + radius; y++) {
    for (let x = center.x - radius; x <= center.x + radius; x++) {
      const pos = { x, y };
      if (!map.inBounds(pos)) continue;
      if (Math.abs(x - center.x) + Math.abs(y - center.y) > radius) continue;
      if (!includeWalls && map.tileAt(pos).terrain === 'wall') continue;
      tiles.push(pos);
    }
  }
  return tiles;
}
