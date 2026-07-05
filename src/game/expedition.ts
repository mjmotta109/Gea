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
  kind: 'taller' | 'paraje' | 'ruinas' | 'paso' | 'nido' | 'puesto' | 'ciudad';
  description: string;
  /** Posición en el mapa del cliente (0-100, solo presentación). */
  x: number;
  y: number;
  /** Servicios urbanos, si el lugar es (o tiene) una ciudad. */
  city?: CitySpec;
}

export interface CitySpec {
  /** Nivel 1 (aldea) a 3 (capital): mejor servicio, mayor precio. */
  level: 1 | 2 | 3;
  /** Fábrica local: catálogo con descuento y exclusivas. */
  factory?: 'armas' | 'piezas';
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
  /** Lugares ya explorados en esta expedición (una vez por sitio). */
  explored?: string[];
  /** Ciudades cuyo trabajo de taberna ya se hizo en esta expedición. */
  tavernJobsDone?: string[];
}

/**
 * Sin suministros, la tripulación solo acepta moverse HACIA la
 * civilización: tramos que reducen la distancia a la ciudad (o taller)
 * más cercana.
 */
export function edgesTowardCivilization(
  expedition: ExpeditionState,
  region: WorldRegion,
): WorldEdge[] {
  const civilized = new Set(
    region.nodes.filter((n) => n.city || n.id === region.hq).map((n) => n.id));
  const distToCiv = (from: string): number => {
    const dist = distancesFrom(region, from);
    return Math.min(...[...civilized].map((id) => dist[id] ?? 99));
  };
  const here = distToCiv(expedition.at);
  return availableEdges(expedition, region)
    .filter((edge) => distToCiv(otherEnd(edge, expedition.at)) < here);
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

// ── Exploración de sitios (ruinas): riesgo y recompensa ──────────────────

export interface ExploreResult {
  expedition: ExpeditionState;
  outcome: 'find' | 'dust' | 'scare';
  eventText: string;
  cargo?: CargoItem;
  /** Estrés que el susto añade a TODOS los pilotos (0 si no hubo). */
  stressDelta: number;
}

const RUIN_FINDS: CargoItem[] = [
  { name: 'Reliquia de antes de la guerra', value: 420 },
  { name: 'Banco de memoria corrupto', value: 300 },
  { name: 'Aleación irrepetible', value: 360 },
  { name: 'Sello de una casa extinta', value: 500 },
];

/** ¿El lugar admite exploración (y aún no se exploró en este viaje)? */
export function canExplore(expedition: ExpeditionState, region: WorldRegion): boolean {
  const node = region.nodes.find((n) => n.id === expedition.at);
  return node?.kind === 'ruinas' && !(expedition.explored ?? []).includes(node.id);
}

/**
 * Explorar las ruinas: cuesta un día, y lo que pase es determinista por
 * (contrato, lugar). Nadie vuelve con las manos vacías... casi nadie.
 */
export function exploreSite(expedition: ExpeditionState, region: WorldRegion): ExploreResult {
  const node = region.nodes.find((n) => n.id === expedition.at)!;
  const rand = mulberry32(hashString(`${expedition.contractId}|explore|${node.id}`));
  const roll = rand();
  const day = expedition.day + 1;
  const explored = [...(expedition.explored ?? []), node.id];

  let outcome: ExploreResult['outcome'];
  let eventText: string;
  let cargo: CargoItem | undefined;
  let stressDelta = 0;

  if (roll < 0.45) {
    outcome = 'find';
    cargo = RUIN_FINDS[Math.floor(rand() * RUIN_FINDS.length)]!;
    eventText = `Bajo los escombros: ${cargo.name} (⌾${cargo.value}).`;
  } else if (roll < 0.7) {
    outcome = 'dust';
    eventText = 'Solo polvo y ecos. Alguien llegó antes.';
  } else {
    outcome = 'scare';
    stressDelta = 12;
    eventText = 'Algo se movió entre las vigas. Nadie lo vio bien. Nadie quiere volver a mirar.';
    if (rand() < 0.5) {
      cargo = RUIN_FINDS[Math.floor(rand() * RUIN_FINDS.length)]!;
      eventText += ` Aun así, salió con ${cargo.name} (⌾${cargo.value}).`;
    }
  }

  return {
    expedition: {
      ...expedition,
      day,
      explored,
      log: [...expedition.log, `Día ${day} — Exploramos ${node.name}. ${eventText}`],
    },
    outcome,
    eventText,
    cargo,
    stressDelta,
  };
}
