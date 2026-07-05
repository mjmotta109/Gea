import { describe, expect, it } from 'vitest';
import { generateBattlefield } from '../src/game/mapgen.js';
import { GameMap } from '../src/core/grid.js';

const LEGAL = /^[0-9a-jA-J~#]+$/;

describe('generador procedural de campos de batalla', () => {
  it('la misma clave produce exactamente el mismo campo', () => {
    const a = generateBattlefield('contrato-7|paso-sal|3');
    const b = generateBattlefield('contrato-7|paso-sal|3');
    expect(a).toEqual(b);
  });

  it('claves distintas producen campos distintos (nunca el mismo mapa)', () => {
    const signatures = new Set(
      Array.from({ length: 30 }, (_, i) => generateBattlefield(`clave-${i}`).rows.join('/')));
    expect(signatures.size).toBeGreaterThanOrEqual(28);
  });

  it('dimensiones acotadas, filas parejas y alfabeto legal', () => {
    for (let i = 0; i < 20; i++) {
      const map = generateBattlefield(`dim-${i}`);
      expect(map.rows.length).toBeGreaterThanOrEqual(9);
      expect(map.rows.length).toBeLessThanOrEqual(11);
      const width = map.rows[0]!.length;
      expect(width).toBeGreaterThanOrEqual(12);
      expect(width).toBeLessThanOrEqual(15);
      for (const row of map.rows) {
        expect(row.length).toBe(width);
        expect(row).toMatch(LEGAL);
      }
    }
  });

  it('el motor acepta el formato tal cual (GameMap.fromAscii)', () => {
    for (let i = 0; i < 10; i++) {
      expect(() => GameMap.fromAscii(generateBattlefield(`fmt-${i}`).rows)).not.toThrow();
    }
  });

  it('4 spawns por bando, sobre llanura limpia y sin solaparse', () => {
    for (let i = 0; i < 20; i++) {
      const map = generateBattlefield(`spawn-${i}`);
      expect(map.playerSpawns).toHaveLength(4);
      expect(map.enemySpawns).toHaveLength(4);
      const all = [...map.playerSpawns, ...map.enemySpawns];
      expect(new Set(all.map((s) => `${s.x},${s.y}`)).size).toBe(8);
      for (const spot of all) {
        const ch = map.rows[spot.y]![spot.x]!;
        expect('012').toContain(ch); // llanura, sin muro ni agua
      }
    }
  });

  it('todo spawn enemigo es alcanzable por tierra desde el jugador', () => {
    for (let i = 0; i < 30; i++) {
      const map = generateBattlefield(`conn-${i}`);
      const width = map.rows[0]!.length;
      const height = map.rows.length;
      const passable = (x: number, y: number): boolean => {
        if (x < 0 || y < 0 || x >= width || y >= height) return false;
        const ch = map.rows[y]![x]!;
        return ch !== '#' && ch !== '~';
      };
      const seen = new Set<string>();
      const queue = [map.playerSpawns[0]!];
      while (queue.length > 0) {
        const { x, y } = queue.pop()!;
        const key = `${x},${y}`;
        if (seen.has(key) || !passable(x, y)) continue;
        seen.add(key);
        queue.push({ x: x + 1, y }, { x: x - 1, y }, { x, y: y + 1 }, { x, y: y - 1 });
      }
      for (const target of map.enemySpawns) {
        expect(seen.has(`${target.x},${target.y}`)).toBe(true);
      }
    }
  });
});
