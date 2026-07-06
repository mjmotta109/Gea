import { describe, expect, it } from 'vitest';
import {
  isoPick, isoProjectView, rotateFacing, rotatePoint, type DioramaTile,
} from '../src/web/iso.js';

// El renderer es presentación, pero su MATEMÁTICA de giro debe ser
// exacta: proyectar y picar deben ser inversas bajo cualquier rotación.

// Mapa llano: la oclusión por altura es comportamiento aparte (una
// loseta alta puede tapar a la de atrás); aquí se mide SOLO el giro.
const W = 4, H = 3;
const tiles: DioramaTile[] = [];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    tiles.push({ x, y, terrain: x === 3 && y === 0 ? 'wall' : 'plain', height: 0, fill: 'rgb(50,80,50)' });
  }
}

describe('diorama giratorio: la cámara da vueltas, el mundo no', () => {
  it('rotatePoint recorre las 4 vueltas y regresa a casa', () => {
    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        // Cuatro cuartos = identidad (aplicando el giro de 1 en cadena
        // sobre dimensiones que van alternando).
        let p = { x, y };
        let w = W, h = H;
        for (let i = 0; i < 4; i++) {
          p = rotatePoint(p.x, p.y, w, h, 1);
          [w, h] = [h, w];
        }
        expect(p).toEqual({ x, y });
        // Y el giro doble coincide con dos sencillos.
        const twice = rotatePoint(x, y, W, H, 2);
        const one = rotatePoint(x, y, W, H, 1);
        const oneMore = rotatePoint(one.x, one.y, H, W, 1);
        expect(twice).toEqual(oneMore);
      }
    }
  });

  it('proyectar y picar son inversas bajo cualquier giro', () => {
    for (const rotation of [0, 1, 2, 3]) {
      for (const tile of tiles) {
        const visualElev = tile.terrain === 'wall' ? tile.height + 1 : tile.height;
        const c = isoProjectView(tile.x, tile.y, visualElev, W, H, rotation);
        const picked = isoPick(c, tiles, W, H, rotation);
        expect(picked, `giro ${rotation}, casilla ${tile.x},${tile.y}`).toEqual({ x: tile.x, y: tile.y });
      }
    }
  });

  it('el facing gira con la cámara (E→S→O→N, horario)', () => {
    expect(rotateFacing('east', 1)).toBe('south');
    expect(rotateFacing('north', 1)).toBe('east');
    expect(rotateFacing('west', 2)).toBe('east');
    expect(rotateFacing('south', 3)).toBe('east');
    expect(rotateFacing('east', 0)).toBe('east');
    expect(rotateFacing('east', 4)).toBe('east');
  });
});
