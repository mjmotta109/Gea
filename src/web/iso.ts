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
}

export interface DioramaHighlights {
  move: Set<string>;
  boost: Set<string>;
  target: Set<string>;
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

/** Tamaño de lienzo necesario para un mapa w×h. */
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
  point: IsoPoint, tiles: DioramaTile[], mapH: number,
): { x: number; y: number } | null {
  const sorted = [...tiles].sort((a, b) => (b.x + b.y) - (a.x + a.y));
  for (const tile of sorted) {
    const c = isoProject(tile.x, tile.y, tile.terrain === 'wall' ? tile.height + 1 : tile.height, mapH);
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

  const byPos = new Map<string, DioramaUnit>();
  for (const unit of scene.units) byPos.set(`${unit.x},${unit.y}`, unit);

  // Pintor: de atrás (x+y menor) hacia delante.
  const tiles = [...scene.tiles].sort((a, b) => (a.x + a.y) - (b.x + b.y) || a.y - b.y);
  for (const tile of tiles) {
    const key = `${tile.x},${tile.y}`;
    const elev = Math.min(3, tile.height);
    const wall = tile.terrain === 'wall';
    const visualElev = wall ? elev + 1 : elev;
    const c = isoProject(tile.x, tile.y, visualElev, scene.height);
    const depth = visualElev * ELEV_STEP + 6; // faldón mínimo: nada flota

    if (tile.terrain === 'water') {
      // El agua vive hundida y ondula.
      const wc = isoProject(tile.x, tile.y, 0, scene.height);
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
    if (scene.hl.cursor && scene.hl.cursor.x === tile.x && scene.hl.cursor.y === tile.y) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.8;
      diamond(ctx, c.x, c.y, TILE_W - 6, TILE_H - 3);
      ctx.stroke();
    }

    // La bestia de esta casilla: billboard de pie con sombra.
    const unit = byPos.get(key);
    if (unit) {
      const info = sprite(unit);
      const img = spriteImage(info.body, info.color, onSpriteReady);
      const w = 54, h = 40;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 3, 17, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (img.complete && img.naturalWidth > 0) {
        ctx.save();
        if (unit.active) {
          ctx.shadowColor = 'rgba(255,255,255,0.85)';
          ctx.shadowBlur = 10;
        }
        if (unit.facing === 'west' || unit.facing === 'north') {
          ctx.translate(c.x, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, -w / 2, c.y - h + 2, w, h);
        } else {
          ctx.drawImage(img, c.x - w / 2, c.y - h + 2, w, h);
        }
        ctx.restore();
      }
      // Etiqueta y barra de vida a los pies.
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(c.x - 14, c.y + 7, 28, 3);
      ctx.fillStyle = unit.team === 'player' ? '#7ec96b' : '#ffb066';
      ctx.fillRect(c.x - 14, c.y + 7, 28 * Math.max(0, Math.min(1, unit.hpRatio)), 3);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(unit.id, c.x, c.y - h + 2);
    }

    // La etiqueta táctica (p. ej. el %) SIEMPRE por encima de la bestia.
    const label = scene.hl.labels.get(key);
    if (label) {
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.strokeText(label, c.x, c.y - 26);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, c.x, c.y - 26);
    }
  }
}
