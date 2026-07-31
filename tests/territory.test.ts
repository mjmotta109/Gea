import { describe, expect, it } from 'vitest';
import {
  buildOverworld, cellOfNode, emptySurvey, initialSurvey, landmarkAtCell,
  regionLandmarks, surveyHas, surveyReveal, terrainAt, SIGHT_RADIUS, OW_W, OW_H,
} from '../src/game/overworld.js';
import { landmarkSpec, resolveLandmark } from '../src/game/landmarks.js';
import { SALT_PASS_REGION, EMERALD_COAST_REGION, ASH_BELT_REGION } from '../src/data/world.js';
import { ZOIDS } from '../src/data/zoids.js';

// La niebla del territorio y los hitos del camino: la carta se levanta
// marchando, y lo que asoma trae peleas o decisiones de facción.

const REGIONS = [SALT_PASS_REGION, EMERALD_COAST_REGION, ASH_BELT_REGION];

describe('la niebla del territorio', () => {
  it('la máscara vacía no ve nada; ventear levanta el radio y nada más', () => {
    const empty = emptySurvey();
    expect(surveyHas(empty, { x: 5, y: 5 })).toBe(false);
    const mask = surveyReveal(empty, { x: 10, y: 10 }, 3);
    expect(surveyHas(mask, { x: 10, y: 10 })).toBe(true);
    expect(surveyHas(mask, { x: 13, y: 10 })).toBe(true);  // borde del radio
    expect(surveyHas(mask, { x: 14, y: 10 })).toBe(false); // fuera
    expect(surveyHas(mask, { x: 12, y: 12 })).toBe(false); // manhattan 4
    // Fuera del mapa nunca está venteado (y no revienta).
    expect(surveyHas(mask, { x: -1, y: 0 })).toBe(false);
    expect(surveyHas(mask, { x: OW_W, y: OW_H })).toBe(false);
  });

  it('ventear es acumulativo e idempotente (lo visto, visto se queda)', () => {
    const a = surveyReveal(emptySurvey(), { x: 4, y: 4 }, 2);
    const b = surveyReveal(a, { x: 20, y: 12 }, 2);
    expect(surveyHas(b, { x: 4, y: 4 })).toBe(true);
    expect(surveyHas(b, { x: 20, y: 12 })).toBe(true);
    expect(surveyReveal(b, { x: 4, y: 4 }, 2)).toBe(b); // re-ventear no cambia nada
  });

  it('la carta inicial conoce los caminos y los lugares; el campo es niebla', () => {
    const world = buildOverworld(SALT_PASS_REGION);
    const mask = initialSurvey(SALT_PASS_REGION);
    // Todo camino está cartografiado.
    for (let i = 0; i < world.cells.length; i++) {
      if (world.cells[i] === 'camino') {
        expect(surveyHas(mask, { x: i % OW_W, y: Math.floor(i / OW_W) })).toBe(true);
      }
    }
    // Los lugares conocidos, con su entorno.
    for (const node of SALT_PASS_REGION.nodes.filter((n) => !n.hidden)) {
      expect(surveyHas(mask, cellOfNode(node))).toBe(true);
    }
    // Pero el campo abierto sigue a oscuras en alguna parte.
    let dark = 0;
    for (let y = 0; y < OW_H; y++) {
      for (let x = 0; x < OW_W; x++) if (!surveyHas(mask, { x, y })) dark++;
    }
    expect(dark).toBeGreaterThan(OW_W * OW_H * 0.3); // buena parte por andar
  });
});

describe('los hitos del camino', () => {
  it('cada región siembra sus hitos: deterministas, en campo abierto y separados', () => {
    for (const region of REGIONS) {
      const world = buildOverworld(region);
      const landmarks = regionLandmarks(region);
      expect(landmarks).toBe(regionLandmarks(region)); // cacheado y estable
      expect(landmarks.length).toBeGreaterThanOrEqual(5);
      const nodeCells = region.nodes.map((n) => cellOfNode(n));
      for (const lm of landmarks) {
        const terrain = terrainAt(world, lm.cell);
        expect(terrain).not.toBe('agua');
        expect(terrain).not.toBe('camino');
        for (const nc of nodeCells) {
          expect(Math.abs(nc.x - lm.cell.x) + Math.abs(nc.y - lm.cell.y)).toBeGreaterThanOrEqual(3);
        }
        expect(landmarkAtCell(region, lm.cell)?.id).toBe(lm.id);
      }
      const cells = new Set(landmarks.map((l) => `${l.cell.x},${l.cell.y}`));
      expect(cells.size).toBe(landmarks.length); // sin solaparse
    }
  });

  it('los hitos duermen bajo la niebla inicial (se descubren marchando)', () => {
    const mask = initialSurvey(SALT_PASS_REGION);
    const hidden = regionLandmarks(SALT_PASS_REGION).filter((lm) => !surveyHas(mask, lm.cell));
    expect(hidden.length).toBeGreaterThan(0);
    // Y marchar al lado los saca a la luz.
    const lm = hidden[0]!;
    expect(surveyHas(surveyReveal(mask, lm.cell, SIGHT_RADIUS), lm.cell)).toBe(true);
  });

  it('cada clase tiene carta con opciones anunciadas, y resolver cumple lo anunciado', () => {
    for (const kind of ['pecio', 'campamento', 'antena', 'caravana', 'santuario'] as const) {
      const spec = landmarkSpec(kind);
      expect(spec.options.length).toBeGreaterThanOrEqual(2);
      for (const option of spec.options) {
        expect(option.detail.length).toBeGreaterThan(0); // consecuencia anunciada
      }
    }
    const lm = { id: 'poi:test:0', kind: 'santuario' as const, cell: { x: 5, y: 5 } };
    const velar = resolveLandmark(lm, 'velar');
    expect(velar.stressDelta).toBeLessThan(0);
    expect(velar.done).toBe(true);
    const saqueo = resolveLandmark(lm, 'saquear');
    expect(saqueo.cargo).toBeDefined();
    expect(saqueo.reputation![0]!.delta).toBeLessThan(0);
    expect(resolveLandmark(lm, 'seguir').done).toBe(false);
  });

  it('los combates de hito traen escuadra real, sesera y botín (sin resolver hasta vencer)', () => {
    for (const kind of ['campamento', 'caravana'] as const) {
      const lm = { id: `poi:test:${kind}`, kind, cell: { x: 8, y: 8 } };
      const optionId = kind === 'campamento' ? 'asaltar' : 'intervenir';
      const out = resolveLandmark(lm, optionId);
      expect(out.battle).toBeDefined();
      expect(out.done).toBe(false); // el hito se cierra al VENCER, no al decidir
      expect(out.battle!.reward).toBeGreaterThan(0);
      expect(out.battle!.aiSkill).toBeGreaterThan(0);
      for (const id of out.battle!.squad) expect(ZOIDS[id], `chasis real: ${id}`).toBeDefined();
      // Determinista: la misma decisión, la misma escuadra.
      expect(resolveLandmark(lm, optionId)).toEqual(out);
      // La decisión de intervenir/asaltar ya mueve facción (anunciado).
      expect(out.reputation!.some((r) => r.factionId === 'colonos' && r.delta > 0)).toBe(true);
    }
  });
});
