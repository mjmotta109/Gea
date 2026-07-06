/*
 * El diorama: renderer isométrico en canvas (escalón 3 de la estética).
 *
 * Fórmula FFT: terreno en rombos con la ALTURA como prismas apilados,
 * y las bestias como billboards de pie sobre el terreno. Todo se dibuja
 * con código — cero archivos — y el motor ni se entera: este módulo
 * solo PINTA un estado que ya está resuelto.
 */

export interface DioramaTile {
  x: number;
  y: number;
  terrain: 'plain' | 'rough' | 'water' | 'forest' | 'wall';
  height: number;
  /** Color base ya sombreado por altura (lo calcula quien conoce la paleta). */
  fill: string;
}

export interface DioramaUnit {
  id: string;
  unitTypeId: string;
  team: 'player' | 'enemy';
  facing: 'north' | 'south' | 'east' | 'west';
  x: number;
  y: number;
  hpRatio: number;
  active: boolean;
  /** Elevación explícita (marcha interpolada); si falta, la de su casilla. */
  elev?: number;
  /** Factor de tamaño del sprite (bestias 2×2 ≈ 1.85; omitir = 1). */
  scale?: number;
}

export interface DioramaHighlights {
  move: Set<string>;
  boost: Set<string>;
  target: Set<string>;
  /** Zona de objetivo 'reach': llegar aquí gana la batalla. */
  zone?: Set<string>;
  path: Set<string>;
  faces: Map<string, string>;   // key → flecha
  labels: Map<string, string>;  // key → texto (p. ej. "62%")
  shots: Set<string>;
  pending?: { x: number; y: number };
  cursor?: { x: number; y: number };
}

export interface DioramaScene {
  width: number;
  height: number;
  tiles: DioramaTile[];
  units: DioramaUnit[];
  hl: DioramaHighlights;
  /** Milisegundos monotónicos para las aguas y los brillos. */
  time: number;
  /** Giro de cámara en cuartos de vuelta (0-3), sentido horario. */
  rotation?: number;
  /** Clima de la batalla: lluvia y tormenta se VEN, no solo restan. */
  weather?: 'clear' | 'rain' | 'sandstorm';
}

/**
 * Coordenadas de pantalla de un punto del mundo bajo un giro de cámara
 * de `r` cuartos de vuelta. Acepta flotantes (marchas interpoladas).
 */
export function rotatePoint(
  x: number, y: number, w: number, h: number, r: number,
): { x: number; y: number } {
  switch (((r % 4) + 4) % 4) {
    case 1: return { x: h - 1 - y, y: x };
    case 2: return { x: w - 1 - x, y: h - 1 - y };
    case 3: return { x: y, y: w - 1 - x };
    default: return { x, y };
  }
}

/** El facing también gira con la cámara (orden horario E→S→O→N). */
const FACING_RING = ['east', 'south', 'west', 'north'] as const;
export function rotateFacing(facing: DioramaUnit['facing'], r: number): DioramaUnit['facing'] {
  return FACING_RING[(FACING_RING.indexOf(facing) + ((r % 4) + 4) % 4) % 4]!;
}

// Proyección 2:1 clásica. La elevación sube en pasos fijos.
export const TILE_W = 62;
export const TILE_H = 31;
export const ELEV_STEP = 14;
const MARGIN_X = TILE_W / 2 + 8;
const MARGIN_TOP = 66; // aire para bestias y prismas de la fila 0

export interface IsoPoint { x: number; y: number }

/** Centro del rombo SUPERIOR de la casilla (con su elevación). */
export function isoProject(x: number, y: number, height: number, mapH: number): IsoPoint {
  return {
    x: (x - y) * (TILE_W / 2) + (mapH - 1) * (TILE_W / 2) + MARGIN_X,
    y: (x + y) * (TILE_H / 2) - Math.min(3, height) * ELEV_STEP + MARGIN_TOP,
  };
}

/** isoProject con giro de cámara: la vía para clientes con rotación. */
export function isoProjectView(
  x: number, y: number, height: number, mapW: number, mapH: number, rotation = 0,
): IsoPoint {
  const p = rotatePoint(x, y, mapW, mapH, rotation);
  const viewH = rotation % 2 === 1 ? mapW : mapH;
  return isoProject(p.x, p.y, height, viewH);
}

/** Tamaño de lienzo necesario para un mapa w×h (el giro lo conserva). */
export function isoCanvasSize(w: number, h: number): { width: number; height: number } {
  return {
    width: (w + h) * (TILE_W / 2) + MARGIN_X * 2 - TILE_W / 2,
    height: (w + h) * (TILE_H / 2) + MARGIN_TOP + ELEV_STEP * 3 + 26,
  };
}

/**
 * Casilla bajo un punto del lienzo: recorre de delante hacia atrás y
 * prueba el rombo superior de cada prisma (la elevación cuenta).
 */
export function isoPick(
  point: IsoPoint, tiles: DioramaTile[], mapW: number, mapH: number, rotation = 0,
): { x: number; y: number } | null {
  const depth = (t: DioramaTile): number => {
    const p = rotatePoint(t.x, t.y, mapW, mapH, rotation);
    return p.x + p.y;
  };
  const sorted = [...tiles].sort((a, b) => depth(b) - depth(a));
  for (const tile of sorted) {
    const c = isoProjectView(
      tile.x, tile.y, tile.terrain === 'wall' ? tile.height + 1 : tile.height, mapW, mapH, rotation);
    const dx = Math.abs(point.x - c.x) / (TILE_W / 2);
    const dy = Math.abs(point.y - c.y) / (TILE_H / 2);
    if (dx + dy <= 1) return { x: tile.x, y: tile.y };
  }
  return null;
}

function darken(color: string, factor: number): string {
  const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(color);
  let r = 0, g = 0, b = 0;
  if (m) { r = Number(m[1]); g = Number(m[2]); b = Number(m[3]); }
  else if (color.startsWith('#')) {
    const n = parseInt(color.slice(1), 16);
    r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
  }
  return `rgb(${Math.round(r * factor)},${Math.round(g * factor)},${Math.round(b * factor)})`;
}

function diamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, w = TILE_W, h = TILE_H): void {
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
}

/** Prisma completo: rombo superior + caras sur-oeste y sur-este. */
function prism(ctx: CanvasRenderingContext2D, cx: number, cy: number, depth: number, fill: string): void {
  if (depth > 0) {
    ctx.fillStyle = darken(fill, 0.62); // cara oeste (sombra)
    ctx.beginPath();
    ctx.moveTo(cx - TILE_W / 2, cy);
    ctx.lineTo(cx, cy + TILE_H / 2);
    ctx.lineTo(cx, cy + TILE_H / 2 + depth);
    ctx.lineTo(cx - TILE_W / 2, cy + depth);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = darken(fill, 0.45); // cara este (más sombra)
    ctx.beginPath();
    ctx.moveTo(cx + TILE_W / 2, cy);
    ctx.lineTo(cx, cy + TILE_H / 2);
    ctx.lineTo(cx, cy + TILE_H / 2 + depth);
    ctx.lineTo(cx + TILE_W / 2, cy + depth);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = fill;
  diamond(ctx, cx, cy);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** Arbolitos procedurales del bosque (deterministas por casilla). */
function trees(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
  const count = 2 + (seed % 2);
  for (let i = 0; i < count; i++) {
    const ox = ((seed * 37 + i * 53) % 30) - 15;
    const oy = ((seed * 91 + i * 17) % 12) - 6;
    const px = cx + ox * 0.8;
    const py = cy + oy * 0.6;
    const s = 7 + ((seed + i) % 3) * 2;
    ctx.fillStyle = '#241a10';
    ctx.fillRect(px - 1, py - 2, 2, 4);
    ctx.fillStyle = i % 2 === 0 ? '#2f6b3c' : '#275931';
    ctx.beginPath();
    ctx.moveTo(px, py - s - 6);
    ctx.lineTo(px + s * 0.55, py - 1);
    ctx.lineTo(px - s * 0.55, py - 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.moveTo(px, py - s - 6);
    ctx.lineTo(px + s * 0.3, py - s * 0.45 - 3);
    ctx.lineTo(px, py - s * 0.3 - 3);
    ctx.closePath();
    ctx.fill();
  }
}

/** Piedras del terreno abrupto. */
function rocks(ctx: CanvasRenderingContext2D, cx: number, cy: number, seed: number): void {
  for (let i = 0; i < 4; i++) {
    const ox = ((seed * 29 + i * 41) % 34) - 17;
    const oy = ((seed * 61 + i * 23) % 14) - 7;
    const r = 1.5 + ((seed + i) % 3);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.30)' : 'rgba(255,255,255,0.10)';
    ctx.beginPath();
    ctx.ellipse(cx + ox * 0.8, cy + oy * 0.7, r, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Sprites de bestia como imágenes cacheadas (SVG → Image, color horneado). */
const spriteCache = new Map<string, HTMLImageElement>();

export function spriteImage(
  svgBody: string, color: string, onReady: () => void,
): HTMLImageElement {
  const key = `${color}|${svgBody.length}|${svgBody.slice(0, 40)}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30">` +
    `<g fill="${color}">${svgBody}</g></svg>`;
  const img = new Image();
  img.onload = onReady;
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  spriteCache.set(key, img);
  return img;
}

const HL_COLORS = {
  move: 'rgba(83, 209, 224, 0.38)',
  boost: 'rgba(95, 217, 164, 0.38)',
  target: 'rgba(229, 96, 76, 0.42)',
  path: 'rgba(83, 209, 224, 0.85)',
};

/**
 * Dibuja la escena completa. `sprite` resuelve el cuerpo SVG de cada
 * unidad (lo aporta quien conoce el catálogo de siluetas).
 */
export function drawDiorama(
  canvas: HTMLCanvasElement,
  scene: DioramaScene,
  sprite: (unit: DioramaUnit) => { body: string; color: string },
  onSpriteReady: () => void,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = isoCanvasSize(scene.width, scene.height);
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Giro de cámara: todo se proyecta en coordenadas de PANTALLA; las
  // claves de resaltado siguen siendo del mundo (el motor no gira).
  const rot = scene.rotation ?? 0;
  const proj = (x: number, y: number, height: number): IsoPoint =>
    isoProjectView(x, y, height, scene.width, scene.height, rot);
  const viewDepth = (x: number, y: number): number => {
    const p = rotatePoint(x, y, scene.width, scene.height, rot);
    return p.x + p.y;
  };

  // Pintor: de atrás hacia delante EN PANTALLA.
  const tiles = [...scene.tiles].sort((a, b) =>
    viewDepth(a.x, a.y) - viewDepth(b.x, b.y) ||
    rotatePoint(a.x, a.y, scene.width, scene.height, rot).y - rotatePoint(b.x, b.y, scene.width, scene.height, rot).y);
  for (const tile of tiles) {
    const key = `${tile.x},${tile.y}`;
    const elev = Math.min(3, tile.height);
    const wall = tile.terrain === 'wall';
    const visualElev = wall ? elev + 1 : elev;
    const c = proj(tile.x, tile.y, visualElev);
    const depth = visualElev * ELEV_STEP + 6; // faldón mínimo: nada flota

    if (tile.terrain === 'water') {
      // El agua vive hundida y ondula.
      const wc = proj(tile.x, tile.y, 0);
      const wave = Math.sin(scene.time / 900 + (tile.x + tile.y * 1.7)) * 1.5;
      prism(ctx, wc.x, wc.y + 4 + wave * 0.4, 3, tile.fill);
      ctx.fillStyle = 'rgba(140, 200, 255, 0.18)';
      diamond(ctx, wc.x, wc.y + 4 + wave, TILE_W * 0.8, TILE_H * 0.8);
      ctx.fill();
    } else {
      prism(ctx, c.x, c.y, depth, tile.fill);
      if (tile.terrain === 'forest') trees(ctx, c.x, c.y, tile.x * 7 + tile.y * 13);
      if (tile.terrain === 'rough') rocks(ctx, c.x, c.y, tile.x * 11 + tile.y * 5);
      if (wall) {
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        diamond(ctx, c.x, c.y);
        ctx.stroke();
      }
    }

    // Resaltados tácticos sobre el rombo superior.
    const paint = (color: string): void => {
      ctx.fillStyle = color;
      diamond(ctx, c.x, c.y);
      ctx.fill();
    };
    if (scene.hl.move.has(key)) paint(HL_COLORS.move);
    if (scene.hl.boost.has(key)) paint(HL_COLORS.boost);
    if (scene.hl.target.has(key)) paint(HL_COLORS.target);
    if (scene.hl.path.has(key)) {
      ctx.fillStyle = HL_COLORS.path;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 4.5, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (scene.hl.shots.has(key)) {
      ctx.fillStyle = 'rgba(229, 96, 76, 0.95)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⌖', c.x, c.y + 4);
    }
    const face = scene.hl.faces.get(key);
    if (face) {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(face, c.x, c.y + 4);
    }
    if (scene.hl.pending && scene.hl.pending.x === tile.x && scene.hl.pending.y === tile.y) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      diamond(ctx, c.x, c.y);
      ctx.stroke();
    }
    if (scene.hl.zone?.has(key)) {
      ctx.strokeStyle = 'rgba(83,209,224,0.85)';
      ctx.lineWidth = 1.4;
      ctx.setLineDash([4, 3]);
      diamond(ctx, c.x, c.y, TILE_W - 8, TILE_H - 4);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (scene.hl.cursor && scene.hl.cursor.x === tile.x && scene.hl.cursor.y === tile.y) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.8;
      diamond(ctx, c.x, c.y, TILE_W - 6, TILE_H - 3);
      ctx.stroke();
    }

  }

  // Pasada 2 — las bestias, de atrás hacia delante. Su x/y puede ser
  // FLOTANTE (marcha interpolada): se proyectan por su cuenta.
  const tileAt = new Map<string, DioramaTile>();
  for (const tile of scene.tiles) tileAt.set(`${tile.x},${tile.y}`, tile);
  const sortedUnits = [...scene.units].sort((a, b) => viewDepth(a.x, a.y) - viewDepth(b.x, b.y));
  for (const unit of sortedUnits) {
    const under = tileAt.get(`${Math.round(unit.x)},${Math.round(unit.y)}`);
    const elev = unit.elev ??
      (under ? (under.terrain === 'wall' ? Math.min(3, under.height) + 1 : Math.min(3, under.height)) : 0);
    const c = proj(unit.x, unit.y, elev);
    const info = sprite(unit);
    const img = spriteImage(info.body, info.color, onSpriteReady);
    const k = unit.scale ?? 1;
    const w = 54 * k, h = 40 * k;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 3 * k, 17 * k, 6 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    if (img.complete && img.naturalWidth > 0) {
      ctx.save();
      if (unit.active) {
        ctx.shadowColor = 'rgba(255,255,255,0.85)';
        ctx.shadowBlur = 10;
      }
      const viewFacing = rotateFacing(unit.facing, rot);
      if (viewFacing === 'west' || viewFacing === 'north') {
        ctx.translate(c.x, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, c.y - h + 2, w, h);
      } else {
        ctx.drawImage(img, c.x - w / 2, c.y - h + 2, w, h);
      }
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(c.x - 14 * k, c.y + 7 * k, 28 * k, 3);
    ctx.fillStyle = unit.team === 'player' ? '#7ec96b' : '#ffb066';
    ctx.fillRect(c.x - 14 * k, c.y + 7 * k, 28 * k * Math.max(0, Math.min(1, unit.hpRatio)), 3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(unit.id, c.x, c.y - h + 2);
  }

  // Pasada 3 — etiquetas tácticas (el %): por encima de todo.
  for (const tile of tiles) {
    const key = `${tile.x},${tile.y}`;
    const label = scene.hl.labels.get(key);
    if (!label) continue;
    const visualElev = tile.terrain === 'wall' ? Math.min(3, tile.height) + 1 : Math.min(3, tile.height);
    const c = proj(tile.x, tile.y, visualElev);
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.85)';
    ctx.strokeText(label, c.x, c.y - 26);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, c.x, c.y - 26);
  }

  // Pasada 4 — el clima: la lluvia raya y azulea; la tormenta de arena
  // arrastra velos de polvo. Determinista respecto al reloj de escena.
  weatherOverlay(ctx, canvas.width, canvas.height, scene.weather ?? 'clear', scene.time);
}

function weatherOverlay(
  ctx: CanvasRenderingContext2D, w: number, h: number,
  weather: 'clear' | 'rain' | 'sandstorm', time: number,
): void {
  if (weather === 'rain') {
    ctx.fillStyle = 'rgba(38, 66, 105, 0.15)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(172, 206, 255, 0.35)';
    ctx.lineWidth = 1;
    const drops = Math.floor(w / 9);
    for (let i = 0; i < drops; i++) {
      const seed = (i * 2654435761) >>> 0;
      const x0 = seed % w;
      const speed = 0.6 + ((seed >>> 8) % 40) / 80;
      const len = 9 + ((seed >>> 16) % 9);
      const y0 = ((time * speed) / 2.4 + ((seed >>> 4) % (h + 60))) % (h + 60) - 30;
      ctx.beginPath();
      ctx.moveTo(x0 - len * 0.32, y0 - len);
      ctx.lineTo(x0, y0);
      ctx.stroke();
    }
  } else if (weather === 'sandstorm') {
    ctx.fillStyle = 'rgba(198, 148, 72, 0.16)';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      const seed = (i * 2246822519) >>> 0;
      const y0 = seed % h;
      const speed = 1 + ((seed >>> 6) % 60) / 40;
      const x0 = ((time * speed) / 5 + ((seed >>> 10) % (w + 240))) % (w + 240) - 120;
      const rx = 24 + ((seed >>> 16) % 46);
      ctx.fillStyle = `rgba(228, 188, 122, ${(6 + ((seed >>> 20) % 8)) / 100})`;
      ctx.beginPath();
      ctx.ellipse(x0, y0 + Math.sin(time / 700 + i) * 5, rx, 4 + ((seed >>> 22) % 4), 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
