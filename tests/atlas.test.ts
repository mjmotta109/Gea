import { describe, expect, it } from 'vitest';
import {
  linkDestination, linksFrom, regionOf, startExpedition, startFreeExpedition, travel, useLink,
} from '../src/game/expedition.js';
import { WORLD_ATLAS } from '../src/data/world.js';

describe('el atlas: continentes, regiones y transportes', () => {
  it('toda región pertenece a un continente que existe y tiene taller', () => {
    const continents = new Set(WORLD_ATLAS.continents.map((c) => c.id));
    for (const region of WORLD_ATLAS.regions) {
      expect(continents.has(region.continentId), region.id).toBe(true);
      expect(region.nodes.some((n) => n.id === region.hq), region.id).toBe(true);
    }
  });

  it('los ids de lugar son únicos en todo el mundo', () => {
    const all = WORLD_ATLAS.regions.flatMap((r) => r.nodes.map((n) => n.id));
    expect(new Set(all).size).toBe(all.length);
  });

  it('cada región es transitable por dentro (grafo conexo)', () => {
    for (const region of WORLD_ATLAS.regions) {
      const seen = new Set<string>([region.hq]);
      const queue = [region.hq];
      while (queue.length > 0) {
        const at = queue.pop()!;
        for (const edge of region.edges) {
          const other = edge.a === at ? edge.b : edge.b === at ? edge.a : null;
          if (other && !seen.has(other)) { seen.add(other); queue.push(other); }
        }
      }
      expect(seen.size, region.id).toBe(region.nodes.length);
    }
  });

  it('todo enlace une lugares reales y el ferry cruza continentes', () => {
    for (const link of WORLD_ATLAS.links) {
      for (const end of [link.a, link.b]) {
        const region = regionOf(WORLD_ATLAS, end.regionId);
        expect(region.nodes.some((n) => n.id === end.nodeId), link.id).toBe(true);
      }
    }
    const ferry = WORLD_ATLAS.links.find((l) => l.kind === 'ferry')!;
    expect(regionOf(WORLD_ATLAS, ferry.a.regionId).continentId)
      .not.toBe(regionOf(WORLD_ATLAS, ferry.b.regionId).continentId);
    const shuttle = WORLD_ATLAS.links.find((l) => l.kind === 'lanzadera')!;
    expect(shuttle.fare).toBeGreaterThan(ferry.fare); // rápido = caro
    expect(shuttle.days).toBeLessThan(ferry.days);
  });

  it('useLink cruza, cobra jornadas y no consume suministros a bordo', () => {
    const ferry = WORLD_ATLAS.links.find((l) => l.kind === 'ferry')!;
    const origin = regionOf(WORLD_ATLAS, ferry.a.regionId);
    const exp = { ...startFreeExpedition(origin, 'ferry-test'), at: ferry.a.nodeId };
    const result = useLink(exp, WORLD_ATLAS, ferry);
    expect(result.expedition.regionId).toBe(ferry.b.regionId);
    expect(result.expedition.at).toBe(ferry.b.nodeId);
    expect(result.expedition.day).toBe(exp.day + ferry.days);
    expect(result.supplyCost).toBe(0); // el pasaje incluye el rancho
    // Determinista y simétrico: la vuelta te deja donde empezaste.
    const back = useLink(result.expedition, WORLD_ATLAS, ferry);
    expect(back.expedition.at).toBe(ferry.a.nodeId);
    expect(useLink(exp, WORLD_ATLAS, ferry)).toEqual(result);
  });

  it('el camino de tierra sí consume suministros por jornada', () => {
    const road = WORLD_ATLAS.links.find((l) => l.kind === 'camino')!;
    const origin = regionOf(WORLD_ATLAS, road.a.regionId);
    const exp = { ...startFreeExpedition(origin, 'road-test'), at: road.a.nodeId };
    const result = useLink(exp, WORLD_ATLAS, road);
    expect(result.supplyCost).toBe(road.days);
    expect(road.fare).toBe(0); // la tierra no cobra pasaje
  });

  it('linksFrom y linkDestination se corresponden', () => {
    for (const link of WORLD_ATLAS.links) {
      const from = linksFrom(WORLD_ATLAS, link.a.regionId, link.a.nodeId);
      expect(from).toContainEqual(link);
      const dest = linkDestination(link, link.a.regionId, link.a.nodeId);
      expect(dest).toEqual(link.b);
    }
  });
});

describe('la vida en cada continente', () => {
  it('la chatarra solo aflora en El Hierro; Arcadia no la conoce', () => {
    const kindsOn = (regionId: string): Set<string> => {
      const region = regionOf(WORLD_ATLAS, regionId);
      const kinds = new Set<string>();
      for (let i = 0; i < 300; i++) {
        for (const edge of region.edges) {
          const probe = { ...startFreeExpedition(region, `cont-${i}`), at: edge.a };
          const result = travel(probe, region, edge);
          if (result.encounter) kinds.add(result.encounter.kind);
        }
      }
      return kinds;
    };
    expect(kindsOn('meseta-hierro').has('chatarra')).toBe(true);
    expect(kindsOn('paso-de-sal').has('chatarra')).toBe(false);
    expect(kindsOn('costa-esmeralda').has('chatarra')).toBe(false);
  });

  it('los contratos apuntan dentro de la región base, sea cual sea', () => {
    for (const region of WORLD_ATLAS.regions) {
      const exp = startExpedition(region, 'c-regional', 'asalto');
      expect(exp.regionId).toBe(region.id);
      expect(region.nodes.some((n) => n.id === exp.targetNodeId)).toBe(true);
      expect(exp.at).toBe(region.hq);
    }
  });
});
