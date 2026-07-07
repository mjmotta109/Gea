import { describe, expect, it } from 'vitest';
import {
  availableEdges, canExplore, exploreSite, isNodeVisible, otherEnd,
  startExpedition, startFreeExpedition, visibleNodes,
} from '../src/game/expedition.js';
import { ASH_BELT_REGION, SALT_PASS_REGION, WORLD_ATLAS } from '../src/data/world.js';

describe('descubrimiento: partes del mapa que exigen explorar', () => {
  it('un nodo oculto no se ve ni se viaja hasta descubrirlo', () => {
    const cripta = SALT_PASS_REGION.nodes.find((n) => n.id === 'cripta-de-sal')!;
    expect(cripta.hidden).toBe(true);
    expect(isNodeVisible(cripta, [])).toBe(false);
    expect(isNodeVisible(cripta, ['cripta-de-sal'])).toBe(true);
    expect(visibleNodes(SALT_PASS_REGION, []).some((n) => n.id === 'cripta-de-sal')).toBe(false);

    const exp = { ...startFreeExpedition(SALT_PASS_REGION, 'v'), at: 'ruinas-de-helio' };
    const before = availableEdges(exp, SALT_PASS_REGION, []).map((e) => otherEnd(e, 'ruinas-de-helio'));
    expect(before).not.toContain('cripta-de-sal'); // el tramo está latente
    const after = availableEdges(exp, SALT_PASS_REGION, ['cripta-de-sal']).map((e) => otherEnd(e, 'ruinas-de-helio'));
    expect(after).toContain('cripta-de-sal'); // descubierta: el tramo despierta
  });

  it('explorar las Ruinas de Helio descubre la Cripta de Sal (y no dos veces)', () => {
    const exp = { ...startFreeExpedition(SALT_PASS_REGION, 'd'), at: 'ruinas-de-helio' };
    const r = exploreSite(exp, SALT_PASS_REGION, []);
    expect(r.discovered).toEqual(['cripta-de-sal']);
    // Ya descubierta: volver a explorarla no la re-descubre.
    const again = exploreSite(exp, SALT_PASS_REGION, ['cripta-de-sal']);
    expect(again.discovered).toBeUndefined();
  });

  it('un paraje con secretos se puede registrar; uno pelado no', () => {
    const foso = { ...startFreeExpedition(ASH_BELT_REGION, 'p'), at: 'foso-vidrio' };
    expect(canExplore(foso, ASH_BELT_REGION, [])).toBe(true);            // tiene reveals
    expect(canExplore(foso, ASH_BELT_REGION, ['jardin-obsidiana'])).toBe(false); // ya revelado
    const caldera = { ...startFreeExpedition(ASH_BELT_REGION, 'p'), at: 'caldera-muerta' };
    expect(canExplore(caldera, ASH_BELT_REGION, [])).toBe(false);        // paso pelado, sin nada
  });

  it('las ruinas SECRETAS pagan más que las normales', () => {
    const secret = new Set<number>();
    const normal = new Set<number>();
    for (let i = 0; i < 60; i++) {
      const s = exploreSite({ ...startFreeExpedition(ASH_BELT_REGION, `s${i}`), at: 'sima-primeros' }, ASH_BELT_REGION);
      if (s.cargo) secret.add(s.cargo.value);
      const n = exploreSite({ ...startFreeExpedition(SALT_PASS_REGION, `n${i}`), at: 'ruinas-de-helio' }, SALT_PASS_REGION);
      if (n.cargo) normal.add(n.cargo.value);
    }
    expect(secret.size).toBeGreaterThan(0);
    expect(normal.size).toBeGreaterThan(0);
    expect(Math.min(...secret)).toBeGreaterThan(Math.max(...normal));
  });

  it('ningún contrato apunta jamás a un nodo oculto', () => {
    for (const region of WORLD_ATLAS.regions) {
      const hidden = new Set(region.nodes.filter((n) => n.hidden).map((n) => n.id));
      if (hidden.size === 0) continue;
      for (let i = 0; i < 40; i++) {
        for (const tier of ['escolta', 'asalto', 'caza', 'incursion', 'defensa'] as const) {
          const exp = startExpedition(region, `k${i}-${tier}`, tier);
          expect(hidden.has(exp.targetNodeId)).toBe(false);
        }
      }
    }
  });
});
