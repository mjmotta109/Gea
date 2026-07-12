import { describe, expect, it } from 'vitest';
import { GameMap, posKey } from '../src/core/grid.js';
import { aoeTiles, reachableTiles, targetableTiles } from '../src/core/pathfinding.js';
import type { UnitState } from '../src/core/types.js';

function ghostUnit(id: string, x: number, y: number, team: 'player' | 'enemy'): UnitState {
  return {
    id, name: id, unitTypeId: 'test', team,
    position: { x, y }, facing: 'east', hp: 10, ct: 0,
    statuses: [], hasMoved: false, hasActed: false, size: 1, reactionReady: true, components: {}, isCommander: false,
  };
}

describe('reachableTiles', () => {
  it('respeta el rango de movimiento en terreno llano', () => {
    const map = GameMap.fromAscii(['00000', '00000', '00000', '00000', '00000']);
    const tiles = reachableTiles(map, { x: 2, y: 2 }, { move: 2, jump: 1, moveType: 'ground', team: 'player' }, []);
    // Diamante Manhattan de radio 2: 13 tiles, incluida la casilla origen.
    expect(tiles).toHaveLength(13);
    expect(tiles.every((t) => Math.abs(t.pos.x - 2) + Math.abs(t.pos.y - 2) <= 2)).toBe(true);
  });

  it('escalar desniveles mayores que el salto es posible, pero cuesta movimiento extra', () => {
    const map = GameMap.fromAscii(['030']); // altura 0 → 3 → 0
    // Subir 3 con salto 1 = 2 niveles de más × 2 + 1 de entrar = 5 de coste.
    const rich = reachableTiles(map, { x: 0, y: 0 }, { move: 5, jump: 1, moveType: 'ground', team: 'player' }, []);
    const cliff = rich.find((t) => posKey(t.pos) === '1,0');
    expect(cliff?.cost).toBe(5); // ya no está tapiado: se escala
    // Pero si no le alcanza el movimiento, no puede.
    const poor = reachableTiles(map, { x: 0, y: 0 }, { move: 4, jump: 1, moveType: 'ground', team: 'player' }, []);
    expect(poor.map((t) => posKey(t.pos))).not.toContain('1,0');
  });

  it('los voladores ignoran altura y agua', () => {
    const map = GameMap.fromAscii(['0~9']);
    const tiles = reachableTiles(map, { x: 0, y: 0 }, { move: 5, jump: 1, moveType: 'flying', team: 'player' }, []);
    expect(tiles).toHaveLength(3);
  });

  it('los terrestres vadean el agua a coste alto (3), no la cruzan gratis', () => {
    const map = GameMap.fromAscii(['0a0', '0~0', '000']);
    // Con movimiento 2, el agua queda fuera de alcance (vadear cuesta 3),
    // pero el abrupto se pisa a coste 2.
    const tight = reachableTiles(map, { x: 0, y: 0 }, { move: 2, jump: 1, moveType: 'ground', team: 'player' }, []);
    expect(tight.find((t) => posKey(t.pos) === '1,0')?.cost).toBe(2); // abrupto coste 2
    expect(tight.map((t) => posKey(t.pos))).not.toContain('1,1'); // agua fuera de alcance
    // Con movimiento 4 sí entra al agua: 0,1 llano (1) + 1,1 agua (3) = 4.
    const roomy = reachableTiles(map, { x: 0, y: 0 }, { move: 4, jump: 1, moveType: 'ground', team: 'player' }, []);
    expect(roomy.find((t) => posKey(t.pos) === '1,1')?.cost).toBe(4);
  });

  it('no atraviesa enemigos pero sí aliados, sin terminar sobre ellos', () => {
    const map = GameMap.fromAscii(['00000']);
    const enemy = ghostUnit('E', 2, 0, 'enemy');
    const blocked = reachableTiles(map, { x: 0, y: 0 }, { move: 4, jump: 1, moveType: 'ground', team: 'player' }, [enemy]);
    expect(blocked.map((t) => posKey(t.pos)).sort()).toEqual(['0,0', '1,0']);

    const ally = ghostUnit('A', 2, 0, 'player');
    const through = reachableTiles(map, { x: 0, y: 0 }, { move: 4, jump: 1, moveType: 'ground', team: 'player' }, [ally]);
    const keys = through.map((t) => posKey(t.pos));
    expect(keys).toContain('3,0'); // pasa a través del aliado
    expect(keys).not.toContain('2,0'); // pero no termina encima
  });
});

describe('targetableTiles', () => {
  it('respeta rango mínimo y máximo', () => {
    const map = GameMap.fromAscii(['00000', '00000', '00000', '00000', '00000']);
    const tiles = targetableTiles(map, { x: 2, y: 2 }, 2, 2, 'single');
    expect(tiles.every((t) => Math.abs(t.x - 2) + Math.abs(t.y - 2) === 2)).toBe(true);
  });

  it('las habilidades en línea solo apuntan en cruz', () => {
    const map = GameMap.fromAscii(['00000', '00000', '00000', '00000', '00000']);
    const tiles = targetableTiles(map, { x: 2, y: 2 }, 2, 1, 'line');
    expect(tiles.every((t) => t.x === 2 || t.y === 2)).toBe(true);
  });
});

describe('aoeTiles', () => {
  it('radio 0 devuelve solo el centro', () => {
    const map = GameMap.fromAscii(['000', '000', '000']);
    expect(aoeTiles(map, { x: 1, y: 1 }, 0)).toEqual([{ x: 1, y: 1 }]);
  });

  it('radio 1 devuelve la cruz recortada al mapa', () => {
    const map = GameMap.fromAscii(['000', '000', '000']);
    const tiles = aoeTiles(map, { x: 0, y: 0 }, 1);
    expect(tiles.map(posKey).sort()).toEqual(['0,0', '0,1', '1,0']);
  });
});
