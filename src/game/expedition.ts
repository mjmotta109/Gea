/**
 * Capa de viaje: la expedición sobre el mapa de mundo (pilar 3).
 *
 * Un contrato ya no es "pulsar desplegar": asigna un LUGAR objetivo en
 * la región, y hay que viajar hasta él nodo a nodo. Cada tramo consume
 * suministros y puede traer eventos (el puente roto que obliga a rodear,
 * un hallazgo para la bodega, una tormenta que perseguirá la batalla).
 * EL combate inevitable ocurre al llegar; después, la decisión: seguir
 * explorando... o volver.
 *
 * Lógica pura y determinista, como mercenary.ts: sin motor, sin DOM.
 */

export interface WorldNode {
  id: string;
  name: string;
  kind: 'taller' | 'paraje' | 'ruinas' | 'paso' | 'nido' | 'puesto';
  description: string;
  /** Posición en el mapa del cliente (0-100, solo presentación). */
  x: number;
  y: number;
}

export interface WorldEdge {
  a: string;
  b: string;
  /** Jornadas de viaje = suministros que cuesta el tramo. */
  days: number;
  /** Sabor del tramo, para el diario y los eventos. */
  flavor: string;
}

export interface WorldRegion {
  id: string;
  name: string;
  hq: string;
  nodes: WorldNode[];
  edges: WorldEdge[];
}

export type TravelEventKind = 'bridge' | 'find' | 'storm' | 'calm';

export interface CargoItem {
  name: string;
  value: number;
}

export interface ExpeditionState {
  contractId: string;
  targetNodeId: string;
  at: string;
  day: number;
  missionDone: boolean;
  /** Tramos rotos por eventos (clave normalizada a-b). */
  blockedEdges: string[];
  /** Clima forzado para la próxima batalla (tormenta en ruta). */
  forcedWeather?: 'rain' | 'sandstorm';
  /** Diario de la expedición, línea a línea. */
  log: string[];
}

export function edgeKey(a: string, b: string): string {
  return [a, b].sort().join('~');
}

export function neighbors(region: WorldRegion, nodeId: string): WorldEdge[] {
  return region.edges.filter((e) => e.a === nodeId || e.b === nodeId);
}

export function otherEnd(edge: WorldEdge, from: string): string {
  return edge.a === from ? edge.b : edge.a;
}

/** Distancias en jornadas desde un nodo (Dijkstra pequeño y determinista). */
export function distancesFrom(region: WorldRegion, start: string): Record<string, number> {
  const dist: Record<string, number> = { [start]: 0 };
  const pending = new Set(region.nodes.map((n) => n.id));
  while (pending.size > 0) {
    let best: string | undefined;
    for (const id of [...pending].sort()) {
      if (dist[id] !== undefined && (best === undefined || dist[id]! < dist[best]!)) best = id;
    }
    if (best === undefined) break;
    pending.delete(best);
    for (const edge of neighbors(region, best)) {
      const next = otherEnd(edge, best);
      const candidate = dist[best]! + edge.days;
      if (dist[next] === undefined || candidate < dist[next]!) dist[next] = candidate;
    }
  }
  return dist;
}

/** mulberry32 local (misma razón que en mercenary.ts: capa sin motor). */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Asigna el nodo objetivo de un contrato según su dificultad: escolta
 * cerca del taller, caza en lo más profundo. Determinista por contrato.
 */
export function assignTarget(
  region: WorldRegion,
  contractId: string,
  tier: 'escolta' | 'asalto' | 'caza',
): string {
  const dist = distancesFrom(region, region.hq);
  const range = tier === 'escolta' ? [1, 2] : tier === 'asalto' ? [2, 3] : [3, 99];
  const candidates = region.nodes
    .filter((n) => n.id !== region.hq)
    .filter((n) => (dist[n.id] ?? 99) >= range[0]! && (dist[n.id] ?? 99) <= range[1]!)
    .map((n) => n.id)
    .sort();
  const pool = candidates.length > 0
    ? candidates
    : region.nodes.filter((n) => n.id !== region.hq).map((n) => n.id).sort();
  const rand = mulberry32(hashString(contractId));
  return pool[Math.floor(rand() * pool.length)]!;
}

export function startExpedition(
  region: WorldRegion,
  contractId: string,
  tier: 'escolta' | 'asalto' | 'caza',
): ExpeditionState {
  const targetNodeId = assignTarget(region, contractId, tier);
  const target = region.nodes.find((n) => n.id === targetNodeId)!;
  return {
    contractId,
    targetNodeId,
    at: region.hq,
    day: 0,
    missionDone: false,
    blockedEdges: [],
    log: [`Día 0 — Partimos hacia ${target.name}.`],
  };
}

export interface TravelResult {
  expedition: ExpeditionState;
  /** Suministros consumidos por el tramo (0 si el tramo se frustró). */
  supplyCost: number;
  event: TravelEventKind;
  eventText: string;
  /** Botín encontrado en ruta, si lo hubo. */
  cargo?: CargoItem;
}

const FINDS: CargoItem[] = [
  { name: 'Chatarra de calidad', value: 150 },
  { name: 'Núcleo de condensador intacto', value: 260 },
  { name: 'Caja de munición sellada', value: 180 },
  { name: 'Registro de datos antiguo', value: 320 },
];

/**
 * Viaja por un tramo. El evento del tramo es determinista por
 * (contrato, tramo, día): reintentar no cambia la suerte.
 */
export function travel(
  expedition: ExpeditionState,
  region: WorldRegion,
  edge: WorldEdge,
): TravelResult {
  const from = expedition.at;
  const to = otherEnd(edge, from);
  const key = edgeKey(edge.a, edge.b);
  const day = expedition.day + edge.days;
  const rand = mulberry32(hashString(`${expedition.contractId}|${key}|${expedition.day}`));
  const roll = rand();

  // Puente roto: solo una vez por tramo, y nunca en el último salto a
  // un objetivo sin alternativa (no bloquear la misión por completo).
  const blocked = [...expedition.blockedEdges];
  if (roll < 0.18 && !blocked.includes(key) && neighbors(region, from).length > 1) {
    blocked.push(key);
    const next: ExpeditionState = {
      ...expedition,
      day: expedition.day + 1,
      blockedEdges: blocked,
      log: [...expedition.log, `Día ${expedition.day + 1} — ${edge.flavor}: el puente está caído. Hay que rodear.`],
    };
    return {
      expedition: next,
      supplyCost: 1,
      event: 'bridge',
      eventText: 'El puente está caído: el tramo queda cortado y perdemos un día buscando paso.',
    };
  }

  const targetName = region.nodes.find((n) => n.id === to)!.name;
  let event: TravelEventKind = 'calm';
  let eventText = `Llegamos a ${targetName} sin incidentes.`;
  let cargo: CargoItem | undefined;
  let forcedWeather = expedition.forcedWeather;

  if (roll >= 0.18 && roll < 0.36) {
    event = 'find';
    cargo = FINDS[Math.floor(rand() * FINDS.length)]!;
    eventText = `Entre los restos del camino: ${cargo.name} (⌾${cargo.value}).`;
  } else if (roll >= 0.36 && roll < 0.52) {
    event = 'storm';
    forcedWeather = rand() < 0.5 ? 'sandstorm' : 'rain';
    eventText = forcedWeather === 'sandstorm'
      ? 'Una tormenta de arena nos persigue: si hay combate pronto, será dentro de ella.'
      : 'Frente de lluvia cerrado: si hay combate pronto, será bajo el aguacero.';
  }

  const next: ExpeditionState = {
    ...expedition,
    at: to,
    day,
    forcedWeather,
    log: [...expedition.log, `Día ${day} — ${edge.flavor}. ${eventText}`],
  };
  return { expedition: next, supplyCost: edge.days, event, eventText, cargo };
}

/** Tramos transitables desde la posición actual (los rotos no). */
export function availableEdges(expedition: ExpeditionState, region: WorldRegion): WorldEdge[] {
  return neighbors(region, expedition.at)
    .filter((e) => !expedition.blockedEdges.includes(edgeKey(e.a, e.b)));
}
