import { describe, expect, it } from 'vitest';
import {
  buildOverworld, cellOfNode, nodeAtCell, planRoute, spotHiddenNodes,
  terrainAt, OW_HOUR_COST, OW_W, OW_H, SIGHT_RADIUS,
} from '../src/game/overworld.js';
import { legEvent, startExpedition } from '../src/game/expedition.js';
import { SALT_PASS_REGION, EMERALD_COAST_REGION, ASH_BELT_REGION } from '../src/data/world.js';

// El mundo abierto: la región como territorio continuo. Determinista,
// conectado por caminos (las viejas aristas hechas geografía) y con la
// exploración convertida en ANDAR: lo oculto se avista al pasar cerca.

describe('el mundo abierto', () => {
  it('el territorio es determinista: la misma región, byte a byte', () => {
    const a = buildOverworld(SALT_PASS_REGION);
    const b = buildOverworld(SALT_PASS_REGION);
    expect(a).toBe(b); // cacheado
    expect(a.cells.length).toBe(OW_W * OW_H);
  });

  it('cada región tiene su carácter: dunas donde manda la arena, verde donde llueve', () => {
    const salt = buildOverworld(SALT_PASS_REGION);      // tormentas de arena
    const coast = buildOverworld(EMERALD_COAST_REGION); // lluvias
    const count = (cells: string[], t: string): number => cells.filter((c) => c === t).length;
    expect(count(salt.cells, 'arena')).toBeGreaterThan(count(coast.cells, 'arena'));
    expect(count(coast.cells, 'bosque')).toBeGreaterThan(count(salt.cells, 'bosque'));
  });

  it('TODOS los nodos de TODAS las regiones son alcanzables desde su cuartel', () => {
    for (const region of [SALT_PASS_REGION, EMERALD_COAST_REGION, ASH_BELT_REGION]) {
      const world = buildOverworld(region);
      const hq = region.nodes.find((n) => n.id === region.hq)!;
      for (const node of region.nodes) {
        const route = planRoute(world, cellOfNode(hq), cellOfNode(node));
        expect(route, `${region.id} → ${node.id}`).not.toBeNull();
        expect(isFinite(route!.hours)).toBe(true);
      }
    }
  });

  it('los caminos tallados son los baratos: las celdas de nodo son camino', () => {
    const world = buildOverworld(SALT_PASS_REGION);
    for (const node of SALT_PASS_REGION.nodes) {
      expect(terrainAt(world, cellOfNode(node))).toBe('camino');
    }
    expect(OW_HOUR_COST.camino).toBeLessThan(OW_HOUR_COST.llano);
    expect(OW_HOUR_COST.agua).toBe(Infinity);
  });

  it('la ruta es estable (mismo par → mismo camino) y el agua no se pisa', () => {
    const world = buildOverworld(SALT_PASS_REGION);
    const hq = cellOfNode(SALT_PASS_REGION.nodes.find((n) => n.id === SALT_PASS_REGION.hq)!);
    const far = cellOfNode(SALT_PASS_REGION.nodes[SALT_PASS_REGION.nodes.length - 1]!);
    const r1 = planRoute(world, hq, far)!;
    const r2 = planRoute(world, hq, far)!;
    expect(r1.path).toEqual(r2.path);
    for (const cell of r1.path) expect(terrainAt(world, cell)).not.toBe('agua');
  });

  it('lo oculto se AVISTA al pasar cerca (radio de vista)', () => {
    const hidden = SALT_PASS_REGION.nodes.find((n) => n.hidden)!;
    const at = cellOfNode(hidden);
    const near = { x: at.x + SIGHT_RADIUS, y: at.y };
    const spotted = spotHiddenNodes(SALT_PASS_REGION, near, []);
    expect(spotted.map((n) => n.id)).toContain(hidden.id);
    // Ya descubierto, no se re-avista; desde lejos, tampoco se ve.
    expect(spotHiddenNodes(SALT_PASS_REGION, near, [hidden.id])).toHaveLength(0);
    expect(spotHiddenNodes(SALT_PASS_REGION, { x: 0, y: 0 }, []).map((n) => n.id))
      .not.toContain(hidden.id);
  });

  it('nodeAtCell encuentra al ocupante exacto de una celda', () => {
    const hq = SALT_PASS_REGION.nodes.find((n) => n.id === SALT_PASS_REGION.hq)!;
    expect(nodeAtCell(SALT_PASS_REGION, cellOfNode(hq))?.id).toBe(hq.id);
    expect(nodeAtCell(SALT_PASS_REGION, { x: 0, y: 0 })).toBeUndefined();
  });

  it('legEvent es determinista y reparte las mesas de siempre', () => {
    const exp = startExpedition(SALT_PASS_REGION, 'c0-caza', 'caza');
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const a = legEvent(exp, SALT_PASS_REGION, `tramo-${i}`);
      const b = legEvent(exp, SALT_PASS_REGION, `tramo-${i}`);
      expect(a).toEqual(b); // mismos dados, mismo evento
      kinds.add(a.event);
      if (a.event === 'encounter') expect(a.encounter?.options.length).toBeGreaterThan(0);
    }
    expect([...kinds].sort()).toEqual(['calm', 'encounter', 'find', 'storm']);
  });
});
