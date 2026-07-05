import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/core/grid.js';
import { hasLineOfSight } from '../src/core/los.js';

describe('hasLineOfSight', () => {
  it('terreno llano: visión libre a cualquier distancia', () => {
    const map = GameMap.fromAscii(['00000000']);
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 7, y: 0 })).toBe(true);
  });

  it('las casillas adyacentes siempre se ven, incluso junto a un muro', () => {
    const map = GameMap.fromAscii(['0#0']);
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });

  it('un muro bloquea la visión', () => {
    const map = GameMap.fromAscii(['00#00']);
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('una colina alta bloquea entre unidades a ras de suelo', () => {
    const map = GameMap.fromAscii(['00400']);
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
  });

  it('un montículo bajo no bloquea', () => {
    const map = GameMap.fromAscii(['00100']);
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });

  it('desde lo alto se dispara por encima del obstáculo que cegaba abajo', () => {
    const map = GameMap.fromAscii(['60300']);
    // Tirador en altura 6: la línea pasa sobre la colina de 3.
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
    // Y la visión es simétrica: el de abajo también le ve.
    expect(hasLineOfSight(map, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(true);
  });

  it('la copa de un bosque intermedio bloquea, pero el ocupante del bosque es visible', () => {
    const map = GameMap.fromAscii(['00A00']);
    // A través del bosque: bloqueado por la copa.
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false);
    // Hacia dentro del bosque: el objetivo se ve (cobertura, no ocultación).
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(true);
    // Y el que está dentro puede disparar hacia fuera.
    expect(hasLineOfSight(map, { x: 2, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });

  it('funciona en diagonales', () => {
    const blocked = GameMap.fromAscii([
      '000',
      '0#0',
      '000',
    ]);
    expect(hasLineOfSight(blocked, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
    const open = GameMap.fromAscii([
      '000',
      '000',
      '000',
    ]);
    expect(hasLineOfSight(open, { x: 0, y: 0 }, { x: 2, y: 2 })).toBe(true);
  });
});
