/*
 * Generador procedural de campos de batalla.
 *
 * Capa de JUEGO, sin motor: produce mapas en el mismo formato ASCII que
 * consume GameMap.fromAscii y el editor (0-2 llanura con altura, a-c
 * abrupto, A-C bosque, ~ agua, # muro), con 4 spawns por bando.
 *
 * Determinista por clave: la misma clave produce EXACTAMENTE el mismo
 * campo. La campaña siembra con contrato|lugar|día, así cada batalla
 * tiene su propio terreno y recargar la partida no lo cambia.
 */

export interface GeneratedMap {
  name: string;
  rows: string[];
  playerSpawns: Array<{ x: number; y: number }>;
  enemySpawns: Array<{ x: number; y: number }>;
}

/** mulberry32 local (misma razón que en expedition.ts: capa sin motor). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bioma: dicta densidades y presencia de agua. Sabor, no reglas. */
interface Biome {
  name: string;
  forest: number;   // manchas de bosque
  rough: number;    // manchas de terreno abrupto
  hills: number;    // lomas (altura 1-2)
  walls: number;    // restos/muros sueltos
  water: 'rio' | 'lago' | 'nada';
}

const BIOMES: Biome[] = [
  { name: 'Vega',     forest: 3, rough: 1, hills: 2, walls: 1, water: 'rio' },
  { name: 'Dunas',    forest: 0, rough: 4, hills: 3, walls: 1, water: 'nada' },
  { name: 'Espesura', forest: 5, rough: 1, hills: 1, walls: 0, water: 'lago' },
  { name: 'Páramo',   forest: 1, rough: 3, hills: 3, walls: 2, water: 'nada' },
  { name: 'Ruinas',   forest: 1, rough: 2, hills: 1, walls: 4, water: 'nada' },
];

type Cell = { kind: 'plain' | 'rough' | 'forest' | 'water' | 'wall'; height: 0 | 1 | 2 };

function toChar(cell: Cell): string {
  switch (cell.kind) {
    case 'plain': return String(cell.height);
    case 'rough': return String.fromCharCode(97 + cell.height);
    case 'forest': return String.fromCharCode(65 + cell.height);
    case 'water': return '~';
    case 'wall': return '#';
  }
}

/** Mancha orgánica: crece desde un centro con probabilidad decreciente. */
function blob(
  grid: Cell[][], rand: () => number, cx: number, cy: number, size: number,
  paint: (cell: Cell) => Cell, protect: (x: number, y: number) => boolean,
): void {
  const height = grid.length;
  const width = grid[0]!.length;
  const frontier: Array<{ x: number; y: number }> = [{ x: cx, y: cy }];
  const seen = new Set<string>();
  let budget = size;
  while (frontier.length > 0 && budget > 0) {
    const idx = Math.floor(rand() * frontier.length);
    const { x, y } = frontier.splice(idx, 1)[0]!;
    const key = `${x},${y}`;
    if (seen.has(key) || x < 0 || y < 0 || x >= width || y >= height) continue;
    seen.add(key);
    if (protect(x, y)) continue;
    grid[y]![x] = paint(grid[y]![x]!);
    budget--;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (rand() < 0.75) frontier.push({ x: x + dx, y: y + dy });
    }
  }
}

export interface BattlefieldOptions {
  /** Tier del contrato: los encargos grandes se pelean en campos grandes. */
  tier?: 'escolta' | 'asalto' | 'caza';
}

/**
 * Genera un campo de batalla a partir de una clave de texto.
 * Misma clave (y mismo tier) → mismo campo, siempre.
 */
export function generateBattlefield(key: string, opts: BattlefieldOptions = {}): GeneratedMap {
  const rand = mulberry32(hashString(key));
  const tierBias = opts.tier === 'caza' ? 2 : opts.tier === 'asalto' ? 1 : 0;
  const width = opts.tier
    ? 12 + tierBias + Math.floor(rand() * 2)   // escolta 12-13 · asalto 13-14 · caza 14-15
    : 12 + Math.floor(rand() * 4);             // libre: 12-15
  const height = opts.tier
    ? 9 + Math.floor(rand() * 2) + (opts.tier === 'caza' ? 1 : 0)
    : 9 + Math.floor(rand() * 3);              // libre: 9-11
  const biome = BIOMES[Math.floor(rand() * BIOMES.length)]!;

  const grid: Cell[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ kind: 'plain', height: 0 } as Cell)));

  // Los flancos de despliegue quedan protegidos: allí no crece nada duro.
  const protectedCol = (x: number): boolean => x <= 1 || x >= width - 2;

  // Lomas: altura 1 con núcleo a 2. La caza endurece el terreno.
  const extraHazard = opts.tier === 'caza' ? 1 : 0;
  for (let i = 0; i < biome.hills + extraHazard; i++) {
    const cx = 2 + Math.floor(rand() * (width - 4));
    const cy = Math.floor(rand() * height);
    blob(grid, rand, cx, cy, 5 + Math.floor(rand() * 4),
      (c) => (c.kind === 'plain' ? { ...c, height: 1 } : c), () => false);
    if (grid[cy]?.[cx]?.kind === 'plain') grid[cy]![cx] = { kind: 'plain', height: 2 };
  }

  // Agua: un río que cruza de arriba abajo (con vado) o un lago.
  if (biome.water === 'rio') {
    let x = 3 + Math.floor(rand() * (width - 6));
    const ford = Math.floor(rand() * height); // el vado: una fila sin agua
    for (let y = 0; y < height; y++) {
      if (y !== ford && !protectedCol(x)) grid[y]![x] = { kind: 'water', height: 0 };
      const drift = rand();
      if (drift < 0.3 && x > 3) x--;
      else if (drift > 0.7 && x < width - 4) x++;
    }
  } else if (biome.water === 'lago') {
    blob(grid, rand, Math.floor(width / 2), Math.floor(height / 2), 6 + Math.floor(rand() * 5),
      () => ({ kind: 'water', height: 0 }), protectedCol);
  }

  // Bosques y abrupto.
  for (let i = 0; i < biome.forest; i++) {
    blob(grid, rand, 2 + Math.floor(rand() * (width - 4)), Math.floor(rand() * height),
      3 + Math.floor(rand() * 4),
      (c) => (c.kind === 'plain' ? { kind: 'forest', height: c.height } : c), protectedCol);
  }
  for (let i = 0; i < biome.rough; i++) {
    blob(grid, rand, 2 + Math.floor(rand() * (width - 4)), Math.floor(rand() * height),
      3 + Math.floor(rand() * 4),
      (c) => (c.kind === 'plain' ? { kind: 'rough', height: c.height } : c), protectedCol);
  }

  // Muros: restos cortos de 2-3 casillas, verticales u horizontales.
  for (let i = 0; i < biome.walls + extraHazard; i++) {
    const wx = 3 + Math.floor(rand() * (width - 6));
    const wy = 1 + Math.floor(rand() * (height - 2));
    const len = 2 + Math.floor(rand() * 2);
    const vertical = rand() < 0.5;
    for (let k = 0; k < len; k++) {
      const x = vertical ? wx : wx + k;
      const y = vertical ? wy + k : wy;
      if (y >= 0 && y < height && !protectedCol(x) && grid[y]![x]!.kind !== 'water') {
        grid[y]![x] = { kind: 'wall', height: 0 };
      }
    }
  }

  // Spawns: 4 por bando, repartidos en el flanco, sobre llanura limpia.
  const spawnRows = (count: number): number[] => {
    const step = height / (count + 1);
    return Array.from({ length: count }, (_, i) => Math.min(height - 1, Math.round(step * (i + 1))));
  };
  const playerSpawns = spawnRows(4).map((y, i) => ({ x: i % 2, y }));
  const enemySpawns = spawnRows(4).map((y, i) => ({ x: width - 1 - (i % 2), y }));
  for (const spot of [...playerSpawns, ...enemySpawns]) {
    grid[spot.y]![spot.x] = { kind: 'plain', height: 0 };
  }

  // Conectividad garantizada: el mapa es transitable de lado a lado. El
  // agua se vadea y cualquier altura se escala (a un coste), así que el
  // ÚNICO terreno que corta el paso es el muro. Todo spawn — de ambos
  // bandos — debe ser alcanzable desde el primero del jugador esquivando
  // solo muros; si no lo es, se abre un pasillo de rescate.
  const passable = (x: number, y: number): boolean => {
    const cell = grid[y]?.[x];
    return cell !== undefined && cell.kind !== 'wall';
  };
  const reachable = (): Set<string> => {
    const seen = new Set<string>();
    const queue = [playerSpawns[0]!];
    while (queue.length > 0) {
      const { x, y } = queue.pop()!;
      const key = `${x},${y}`;
      if (seen.has(key) || !passable(x, y)) continue;
      seen.add(key);
      queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
    }
    return seen;
  };
  for (const target of [...playerSpawns.slice(1), ...enemySpawns]) {
    if (reachable().has(`${target.x},${target.y}`)) continue;
    // Pasillo de rescate: línea recta escalonada que derriba los muros que
    // encuentre (el agua no hace falta abrirla: ya es transitable).
    let { x, y } = playerSpawns[0]!;
    while (x !== target.x || y !== target.y) {
      if (x !== target.x && (y === target.y || rand() < 0.5)) x += Math.sign(target.x - x);
      else y += Math.sign(target.y - y);
      if (grid[y]![x]!.kind === 'wall') grid[y]![x] = { kind: 'plain', height: 0 };
    }
  }

  return {
    name: `${biome.name} ${(hashString(key) % 9000) + 1000}`,
    rows: grid.map((row) => row.map(toChar).join('')),
    playerSpawns,
    enemySpawns,
  };
}
