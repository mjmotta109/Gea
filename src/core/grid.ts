import type { Position, Tile, TerrainType } from './types.js';

/**
 * Mapa de batalla: rejilla rectangular de tiles con terreno y altura.
 * La ocupación de unidades vive en Battle, no aquí; el mapa es estático.
 */
export class GameMap {
  readonly width: number;
  readonly height: number;
  private tiles: Tile[];

  constructor(width: number, height: number, tiles: Tile[]) {
    if (tiles.length !== width * height) {
      throw new Error(`Se esperaban ${width * height} tiles, llegaron ${tiles.length}`);
    }
    this.width = width;
    this.height = height;
    this.tiles = tiles;
  }

  /**
   * Construye un mapa desde arte ASCII: cada carácter es un tile.
   * Dígitos 0-9 = llanura con esa altura; '~' = agua; '#' = muro;
   * letras a-j = terreno abrupto con altura 0-9;
   * letras A-J = bosque con altura 0-9.
   */
  static fromAscii(rows: string[]): GameMap {
    const height = rows.length;
    const width = rows[0]!.length;
    const tiles: Tile[] = [];
    for (const row of rows) {
      if (row.length !== width) throw new Error('Todas las filas deben medir lo mismo');
      for (const ch of row) {
        tiles.push(GameMap.tileFromChar(ch));
      }
    }
    return new GameMap(width, height, tiles);
  }

  private static tileFromChar(ch: string): Tile {
    if (ch >= '0' && ch <= '9') return { terrain: 'plain', height: ch.charCodeAt(0) - 48 };
    if (ch >= 'a' && ch <= 'j') return { terrain: 'rough', height: ch.charCodeAt(0) - 97 };
    if (ch >= 'A' && ch <= 'J') return { terrain: 'forest', height: ch.charCodeAt(0) - 65 };
    if (ch === '~') return { terrain: 'water', height: 0 };
    if (ch === '#') return { terrain: 'wall', height: 99 };
    throw new Error(`Carácter de mapa desconocido: '${ch}'`);
  }

  inBounds(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  tileAt(pos: Position): Tile {
    if (!this.inBounds(pos)) throw new Error(`Fuera de mapa: ${pos.x},${pos.y}`);
    return this.tiles[pos.y * this.width + pos.x]!;
  }

  /** Coste de entrar a un tile según terreno y tipo de movimiento. Infinity = intransitable. */
  entryCost(pos: Position, moveType: 'ground' | 'flying' | 'amphibious'): number {
    const tile = this.tileAt(pos);
    switch (tile.terrain) {
      case 'wall':
        return Infinity;
      case 'plain':
        return 1;
      case 'rough':
      case 'forest':
        return moveType === 'flying' ? 1 : 2;
      case 'water':
        if (moveType === 'flying' || moveType === 'amphibious') return 1;
        return Infinity;
    }
  }
}

/**
 * Cobertura por terreno (fase 3): se suma a la evasión del defensor que
 * ocupa el tile. Es la adaptación del bonus de cobertura de XCOM a mechas
 * gigantes: no hay parapetos direccionales, hay entornos que dificultan
 * el tiro — vegetación, rocas, agua somera que oculta las piernas.
 */
export const TERRAIN_COVER: Record<TerrainType, number> = {
  plain: 0,
  rough: 10,
  water: 5,
  forest: 20,
  wall: 0,
};

export function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

export function samePos(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function manhattan(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export const CARDINAL_OFFSETS: ReadonlyArray<Position> = [
  { x: 0, y: -1 }, // north
  { x: 1, y: 0 },  // east
  { x: 0, y: 1 },  // south
  { x: -1, y: 0 }, // west
];

export function terrainLabel(terrain: TerrainType): string {
  switch (terrain) {
    case 'plain': return 'llanura';
    case 'rough': return 'terreno abrupto';
    case 'water': return 'agua';
    case 'forest': return 'bosque';
    case 'wall': return 'muro';
  }
}
