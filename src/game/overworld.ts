/**
 * El mundo abierto: cada región deja de ser un grafo con botones y se
 * convierte en GEOGRAFÍA — una rejilla de terreno continua, determinista
 * por región, donde los lugares están EN el paisaje y la ruta la eliges
 * tú. Las aristas del diseño clásico se tallan como CAMINOS visibles
 * (garantizan la conectividad); el resto es campo abierto con su coste.
 *
 * Capa pura: sin DOM, sin motor de batalla. El cliente pinta y persiste.
 */
import type { WorldNode, WorldRegion } from './expedition.js';

export type OverworldTerrain = 'camino' | 'llano' | 'arena' | 'bosque' | 'abrupto' | 'agua';

export interface OverworldCell { x: number; y: number }

export interface Overworld {
  width: number;
  height: number;
  /** Terreno por celda, fila a fila (y * width + x). */
  cells: OverworldTerrain[];
}

export const OW_W = 36;
export const OW_H = 24;

/** Horas de marcha por entrar a una celda. La caravana no vuela. */
export const OW_HOUR_COST: Record<OverworldTerrain, number> = {
  camino: 1,
  llano: 2,
  arena: 3,
  bosque: 3,
  abrupto: 4,
  agua: Infinity,
};

// El mismo RNG de la casa (duplicado a propósito: capa pura sin imports
// del motor, igual que hace mercenary.ts).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}

/** Celda de la rejilla donde vive un nodo (sus x,y son 0-100). */
export function cellOfNode(node: WorldNode): OverworldCell {
  return {
    x: Math.max(1, Math.min(OW_W - 2, Math.round((node.x / 100) * (OW_W - 1)))),
    y: Math.max(1, Math.min(OW_H - 2, Math.round((node.y / 100) * (OW_H - 1)))),
  };
}

/** Nodo que ocupa una celda (si alguno). */
export function nodeAtCell(region: WorldRegion, cell: OverworldCell): WorldNode | undefined {
  return region.nodes.find((n) => {
    const c = cellOfNode(n);
    return c.x === cell.x && c.y === cell.y;
  });
}

/** Ruido de valor barato y determinista (celosía + interpolación). */
function valueNoise(rand: () => number, w: number, h: number, scale: number): number[] {
  const gw = Math.ceil(w / scale) + 2;
  const gh = Math.ceil(h / scale) + 2;
  const lattice: number[] = [];
  for (let i = 0; i < gw * gh; i++) lattice.push(rand());
  const smooth = (t: number): number => t * t * (3 - 2 * t);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / scale, gy = y / scale;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const tx = smooth(gx - x0), ty = smooth(gy - y0);
      const v00 = lattice[y0 * gw + x0]!;
      const v10 = lattice[y0 * gw + x0 + 1]!;
      const v01 = lattice[(y0 + 1) * gw + x0]!;
      const v11 = lattice[(y0 + 1) * gw + x0 + 1]!;
      out.push((v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty);
    }
  }
  return out;
}

/** Línea de Bresenham entre dos celdas (para tallar caminos). */
function line(a: OverworldCell, b: OverworldCell): OverworldCell[] {
  const points: OverworldCell[] = [];
  let x = a.x, y = a.y;
  const dx = Math.abs(b.x - a.x), dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1, sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    points.push({ x, y });
    if (x === b.x && y === b.y) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return points;
}

const OVERWORLD_CACHE = new Map<string, Overworld>();

/**
 * Construye (y cachea) el territorio de una región. Determinista: la
 * misma región produce byte a byte el mismo mundo, siempre.
 * El perfil de clima da el carácter: donde manda la arena hay dunas,
 * donde llueve hay verde. Los caminos (las viejas aristas) y las celdas
 * de nodo JAMÁS los pisa el ruido: la conectividad está garantizada.
 */
export function buildOverworld(region: WorldRegion): Overworld {
  const cached = OVERWORLD_CACHE.get(region.id);
  if (cached) return cached;

  const rand = mulberry32(hashString(`overworld|${region.id}`));
  const relief = valueNoise(rand, OW_W, OW_H, 6);   // abrupto / colinas
  const veget = valueNoise(rand, OW_W, OW_H, 5);    // bosque
  const wet = valueNoise(rand, OW_W, OW_H, 8);      // lagunas

  const w = region.weather ?? { clear: 6, rain: 2, sandstorm: 2 };
  const sandy = w.sandstorm >= Math.max(w.rain, 2);  // región de dunas
  const lush = w.rain >= Math.max(w.sandstorm, 2);   // región verde

  const cells: OverworldTerrain[] = [];
  for (let i = 0; i < OW_W * OW_H; i++) {
    let terrain: OverworldTerrain = sandy ? 'arena' : 'llano';
    // En región lluviosa manda la vegetación; en el resto, el relieve.
    if (lush && veget[i]! > 0.55) terrain = 'bosque';
    else if (relief[i]! > 0.72) terrain = 'abrupto';
    else if (!lush && veget[i]! > 0.78) terrain = 'bosque';
    if (wet[i]! > 0.82) terrain = 'agua';
    cells.push(terrain);
  }

  // Tallar los caminos sobre las aristas del diseño: la historia del
  // grafo se queda, ahora como geografía visible y barata de andar.
  for (const edge of region.edges) {
    const a = region.nodes.find((n) => n.id === edge.a);
    const b = region.nodes.find((n) => n.id === edge.b);
    if (!a || !b) continue;
    for (const p of line(cellOfNode(a), cellOfNode(b))) {
      cells[p.y * OW_W + p.x] = 'camino';
    }
  }
  // Las celdas de nodo, siempre pisables y de camino.
  for (const node of region.nodes) {
    const c = cellOfNode(node);
    cells[c.y * OW_W + c.x] = 'camino';
  }

  const world: Overworld = { width: OW_W, height: OW_H, cells };
  OVERWORLD_CACHE.set(region.id, world);
  return world;
}

export function terrainAt(world: Overworld, cell: OverworldCell): OverworldTerrain {
  return world.cells[cell.y * world.width + cell.x]!;
}

/**
 * Ruta de marcha entre dos celdas: A* de 4 direcciones con desempate
 * estable (determinista). Devuelve el camino (incluye origen y destino)
 * y su coste TOTAL en horas, o null si no hay paso.
 */
export function planRoute(
  world: Overworld, from: OverworldCell, to: OverworldCell,
): { path: OverworldCell[]; hours: number } | null {
  const idx = (c: OverworldCell): number => c.y * world.width + c.x;
  if (!isFinite(OW_HOUR_COST[terrainAt(world, to)])) return null;
  const open: Array<{ cell: OverworldCell; g: number; f: number; order: number }> = [
    { cell: from, g: 0, f: 0, order: 0 },
  ];
  const gScore = new Map<number, number>([[idx(from), 0]]);
  const cameFrom = new Map<number, OverworldCell>();
  let pushOrder = 1;
  const OFFSETS = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];

  while (open.length > 0) {
    // Extracción determinista: menor f, luego menor orden de inserción.
    let bestIdx = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIdx]!.f ||
        (open[i]!.f === open[bestIdx]!.f && open[i]!.order < open[bestIdx]!.order)) bestIdx = i;
    }
    const current = open.splice(bestIdx, 1)[0]!;
    if (current.cell.x === to.x && current.cell.y === to.y) {
      const path: OverworldCell[] = [current.cell];
      let key = idx(current.cell);
      while (cameFrom.has(key)) {
        const prev = cameFrom.get(key)!;
        path.unshift(prev);
        key = idx(prev);
      }
      return { path, hours: current.g };
    }
    for (const o of OFFSETS) {
      const next = { x: current.cell.x + o.x, y: current.cell.y + o.y };
      if (next.x < 0 || next.y < 0 || next.x >= world.width || next.y >= world.height) continue;
      const cost = OW_HOUR_COST[terrainAt(world, next)];
      if (!isFinite(cost)) continue;
      const g = current.g + cost;
      const k = idx(next);
      if (g < (gScore.get(k) ?? Infinity)) {
        gScore.set(k, g);
        cameFrom.set(k, current.cell);
        const h = Math.abs(next.x - to.x) + Math.abs(next.y - to.y);
        open.push({ cell: next, g, f: g + h, order: pushOrder++ });
      }
    }
  }
  return null;
}

/**
 * Avistamientos: nodos OCULTOS que quedan a la vista (radio manhattan)
 * desde una celda. Pasar cerca de un secreto lo pone en el mapa — la
 * exploración es literalmente ANDAR el territorio.
 */
export const SIGHT_RADIUS = 3;

export function spotHiddenNodes(
  region: WorldRegion, at: OverworldCell, discovered: string[],
): WorldNode[] {
  return region.nodes.filter((n) => {
    if (!n.hidden || discovered.includes(n.id)) return false;
    const c = cellOfNode(n);
    return Math.abs(c.x - at.x) + Math.abs(c.y - at.y) <= SIGHT_RADIUS;
  });
}

// ── La niebla del territorio: la carta se LEVANTA marchando ─────────────
//
// La compañía tiene una carta de rutas (los caminos y los lugares
// conocidos), pero el campo abierto es NIEBLA hasta que la caravana pasa
// y lo ventea. La máscara es persistente por región (la lleva la
// campaña): lo levantado, levantado se queda.
// Formato: cadena hexadecimal de OW_W×OW_H bits (bit = celda venteada).

const SURVEY_HEX_LEN = Math.ceil((OW_W * OW_H) / 4);

/** Máscara vacía: todo el territorio en niebla. */
export function emptySurvey(): string {
  return '0'.repeat(SURVEY_HEX_LEN);
}

function surveyBit(mask: string, index: number): boolean {
  const nibble = parseInt(mask[index >> 2] ?? '0', 16);
  return (nibble & (1 << (index & 3))) !== 0;
}

/** ¿Está venteada (a la vista en la carta) esta celda? */
export function surveyHas(mask: string, cell: OverworldCell): boolean {
  if (cell.x < 0 || cell.y < 0 || cell.x >= OW_W || cell.y >= OW_H) return false;
  return surveyBit(mask, cell.y * OW_W + cell.x);
}

/** Ventea el radio manhattan alrededor de una celda. Sin mutar. */
export function surveyReveal(mask: string, at: OverworldCell, radius = SIGHT_RADIUS): string {
  const chars = mask.padEnd(SURVEY_HEX_LEN, '0').split('');
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (Math.abs(dx) + Math.abs(dy) > radius) continue;
      const x = at.x + dx, y = at.y + dy;
      if (x < 0 || y < 0 || x >= OW_W || y >= OW_H) continue;
      const index = y * OW_W + x;
      const nibble = parseInt(chars[index >> 2]!, 16) | (1 << (index & 3));
      chars[index >> 2] = nibble.toString(16);
    }
  }
  return chars.join('');
}

/**
 * La carta de rutas inicial de una región: los CAMINOS (las arterias
 * cartografiadas) y el entorno inmediato de los lugares conocidos. El
 * campo abierto —lo que hay a los lados— queda en niebla hasta andarse.
 */
export function initialSurvey(region: WorldRegion, discovered: string[] = []): string {
  const world = buildOverworld(region);
  let mask = emptySurvey();
  const chars = mask.split('');
  for (let i = 0; i < world.cells.length; i++) {
    if (world.cells[i] === 'camino') {
      const nibble = parseInt(chars[i >> 2]!, 16) | (1 << (i & 3));
      chars[i >> 2] = nibble.toString(16);
    }
  }
  mask = chars.join('');
  for (const node of region.nodes) {
    if (node.hidden && !discovered.includes(node.id)) continue;
    mask = surveyReveal(mask, cellOfNode(node), 2);
  }
  return mask;
}

// ── Hitos del territorio: lo que se ve en el camino ─────────────────────
//
// Elementos PUNTUALES dignos de exploración, sembrados por región de
// forma determinista. Duermen bajo la niebla: la marcha los saca a la
// luz, y visitarlos trae peleas o decisiones que mueven facciones (las
// consecuencias viven en src/game/landmarks.ts).

export type LandmarkKind = 'pecio' | 'campamento' | 'antena' | 'caravana' | 'santuario';

export interface Landmark {
  id: string;
  kind: LandmarkKind;
  cell: OverworldCell;
}

const LANDMARK_KINDS: LandmarkKind[] = ['pecio', 'campamento', 'antena', 'caravana', 'santuario'];
const LANDMARKS_PER_REGION = 7;

const LANDMARK_CACHE = new Map<string, Landmark[]>();

/**
 * Los hitos de una región: deterministas, en campo abierto (nunca agua,
 * camino ni encima de un lugar), separados entre sí y de los nodos.
 */
export function regionLandmarks(region: WorldRegion): Landmark[] {
  const cached = LANDMARK_CACHE.get(region.id);
  if (cached) return cached;
  const world = buildOverworld(region);
  const rand = mulberry32(hashString(`hitos|${region.id}`));
  const nodeCells = region.nodes.map((n) => cellOfNode(n));
  const landmarks: Landmark[] = [];
  const farFrom = (cell: OverworldCell, others: OverworldCell[], min: number): boolean =>
    others.every((o) => Math.abs(o.x - cell.x) + Math.abs(o.y - cell.y) >= min);
  for (let attempt = 0; attempt < 400 && landmarks.length < LANDMARKS_PER_REGION; attempt++) {
    const cell = {
      x: 1 + Math.floor(rand() * (OW_W - 2)),
      y: 1 + Math.floor(rand() * (OW_H - 2)),
    };
    const terrain = terrainAt(world, cell);
    if (terrain === 'agua' || terrain === 'camino') continue;
    if (!farFrom(cell, nodeCells, 3)) continue;
    if (!farFrom(cell, landmarks.map((l) => l.cell), 4)) continue;
    landmarks.push({
      id: `poi:${region.id}:${landmarks.length}`,
      kind: LANDMARK_KINDS[Math.floor(rand() * LANDMARK_KINDS.length)]!,
      cell,
    });
  }
  LANDMARK_CACHE.set(region.id, landmarks);
  return landmarks;
}

/** Hito que ocupa una celda exacta (si alguno). */
export function landmarkAtCell(region: WorldRegion, cell: OverworldCell): Landmark | undefined {
  return regionLandmarks(region).find((l) => l.cell.x === cell.x && l.cell.y === cell.y);
}
