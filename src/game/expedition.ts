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
  /**
   * OCULTO en el mapa hasta descubrirlo: no se dibuja ni se puede viajar
   * a él mientras no esté en la lista de descubiertos de la campaña. Sus
   * tramos quedan latentes. Es el "hay partes del mapa que exigen explorar".
   */
  hidden?: boolean;
  /**
   * RUINA SECRETA: oculta por defecto y con botín más rico (y peor susto)
   * al explorarla. El pago de llegar tan lejos.
   */
  secret?: boolean;
  /**
   * Al EXPLORAR/registrar este lugar se revelan estos nodos ocultos
   * (rumores, mapas viejos, un sendero entre los escombros). Determinista.
   */
  reveals?: string[];
}

export interface CitySpec {
  /** Nivel 1 (aldea) a 3 (capital): mejor servicio, mayor precio. */
  level: 1 | 2 | 3;
  /** Fábrica local: catálogo con descuento y exclusivas. */
  factory?: 'armas' | 'piezas';
}

export type EdgeBiome = 'vega' | 'dunas' | 'sierra';

export interface WorldEdge {
  a: string;
  b: string;
  /** Jornadas de viaje = suministros que cuesta el tramo. */
  days: number;
  /** Sabor del tramo, para el diario y los eventos. */
  flavor: string;
  /** Bioma del tramo: sesga qué clase de encuentro puede salir aquí. */
  biome?: EdgeBiome;
}

export interface WorldRegion {
  id: string;
  name: string;
  /** Continente al que pertenece (WorldAtlas). */
  continentId: string;
  hq: string;
  nodes: WorldNode[];
  edges: WorldEdge[];
  /**
   * Perfil de clima de la región: pesos relativos de cada cielo. El
   * clima es variable, pero cada región tiene el suyo — la costa llueve,
   * las dunas tragan arena. Sin perfil: mayormente despejado.
   */
  weather?: { clear: number; rain: number; sandstorm: number };
}

/** Perfil por defecto: cielos mayormente amables. */
const DEFAULT_WEATHER = { clear: 6, rain: 2, sandstorm: 2 };

/**
 * El cielo de una región en una jornada concreta. Determinista por
 * (región, día): recargar no cambia el tiempo, viajar sí. El clima
 * PESA: en batalla ya resta (lluvia disipa calor, la arena ciega a
 * distancia) y la tormenta cobra suministros extra en ruta.
 */
export function weatherFor(region: WorldRegion, day: number): 'clear' | 'rain' | 'sandstorm' {
  const profile = region.weather ?? DEFAULT_WEATHER;
  const rand = mulberry32(hashString(`${region.id}|clima|${day}`))();
  const total = profile.clear + profile.rain + profile.sandstorm;
  const roll = rand * total;
  if (roll < profile.clear) return 'clear';
  if (roll < profile.clear + profile.rain) return 'rain';
  return 'sandstorm';
}

// ── El atlas: continentes, regiones y los transportes que los unen ──────

export interface WorldContinent {
  id: string;
  name: string;
  blurb: string;
}

/** Camino de tierra entre regiones, o travesía con horario y pasaje. */
export type LinkKind = 'camino' | 'ferry' | 'lanzadera';

export interface WorldLink {
  id: string;
  kind: LinkKind;
  a: { regionId: string; nodeId: string };
  b: { regionId: string; nodeId: string };
  /** Jornadas de viaje. Ferry y lanzadera van con horario: sin eventos. */
  days: number;
  /** Pasaje en créditos (0 = camino de tierra). */
  fare: number;
  flavor: string;
}

export interface WorldAtlas {
  continents: WorldContinent[];
  regions: WorldRegion[];
  links: WorldLink[];
}

export function regionOf(atlas: WorldAtlas, regionId: string): WorldRegion {
  const region = atlas.regions.find((r) => r.id === regionId);
  if (!region) throw new Error(`Región desconocida: ${regionId}`);
  return region;
}

// ── Descubrimiento: partes del mapa que exigen explorar ─────────────────

/**
 * ¿Es visible este nodo? Los ocultos solo si ya se descubrieron. El
 * conjunto `discovered` es persistente (vive en la campaña, no en la
 * expedición): una ruina secreta descubierta se queda en el mapa.
 */
export function isNodeVisible(node: WorldNode, discovered: string[] = []): boolean {
  return !node.hidden || discovered.includes(node.id);
}

/** Los nodos que se dibujan en el mapa: los visibles. */
export function visibleNodes(region: WorldRegion, discovered: string[] = []): WorldNode[] {
  return region.nodes.filter((n) => isNodeVisible(n, discovered));
}

/** Un tramo solo se ve/usa si sus DOS extremos son visibles. */
export function isEdgeVisible(region: WorldRegion, edge: WorldEdge, discovered: string[] = []): boolean {
  const a = region.nodes.find((n) => n.id === edge.a);
  const b = region.nodes.find((n) => n.id === edge.b);
  return !!a && !!b && isNodeVisible(a, discovered) && isNodeVisible(b, discovered);
}

/** Transportes disponibles desde un lugar concreto. */
export function linksFrom(atlas: WorldAtlas, regionId: string, nodeId: string): WorldLink[] {
  return atlas.links.filter((l) =>
    (l.a.regionId === regionId && l.a.nodeId === nodeId) ||
    (l.b.regionId === regionId && l.b.nodeId === nodeId));
}

/** El otro extremo de un enlace visto desde una orilla. */
export function linkDestination(link: WorldLink, regionId: string, nodeId: string): { regionId: string; nodeId: string } {
  return link.a.regionId === regionId && link.a.nodeId === nodeId ? link.b : link.a;
}

/**
 * Tomar un transporte interregional. Ferry y lanzadera viajan con
 * horario: cuestan pasaje (lo cobra quien llama) pero no consumen
 * suministros ni tiran eventos. El camino de tierra es marcha normal:
 * consume suministros por jornada.
 */
export function useLink(
  expedition: ExpeditionState,
  atlas: WorldAtlas,
  link: WorldLink,
): { expedition: ExpeditionState; supplyCost: number } {
  const to = linkDestination(link, expedition.regionId, expedition.at);
  const target = regionOf(atlas, to.regionId).nodes.find((n) => n.id === to.nodeId)!;
  const day = expedition.day + link.days;
  const verb = link.kind === 'ferry' ? 'El ferry cruza' : link.kind === 'lanzadera' ? 'La lanzadera salta' : 'La marcha sigue';
  return {
    expedition: {
      ...expedition,
      regionId: to.regionId,
      at: to.nodeId,
      day,
      forcedWeather: undefined,
      log: [...expedition.log, `Día ${day} — ${link.flavor}: ${verb} hasta ${target.name}.`],
    },
    supplyCost: link.kind === 'camino' ? link.days : 0,
  };
}

export type TravelEventKind = 'bridge' | 'find' | 'storm' | 'encounter' | 'calm';

export interface CargoItem {
  name: string;
  value: number;
}

export interface ExpeditionState {
  contractId: string;
  /** Región del atlas donde está la expedición. */
  regionId: string;
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
  /**
   * FORMACIÓN de salida: huecos del roster que VAN en esta expedición.
   * Se elige al partir y solo se reorganiza en ciudad. Ausente = todos
   * (expediciones de antes de la regla).
   */
  party?: number[];
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
  // Distancias sobre el grafo REAL: los puentes rotos no cuentan.
  const distToCiv = (from: string): number => {
    const dist = distancesFromAvoiding(region, from, expedition.blockedEdges);
    return Math.min(...[...civilized].map((id) => dist[id] ?? 999));
  };
  const here = distToCiv(expedition.at);
  // Los puentes rotos se pueden VADEAR (+1 jornada): cuentan como salida.
  const options = neighbors(region, expedition.at);
  const closer = options.filter((edge) => distToCiv(otherEnd(edge, expedition.at)) < here);
  if (closer.length > 0) return closer;
  // Red de seguridad: si ningún tramo estricto acerca (meseta o cerco de
  // puentes rotos), se permite lo que MENOS aleje — nunca cero salidas.
  let best = Infinity;
  for (const edge of options) best = Math.min(best, distToCiv(otherEnd(edge, expedition.at)));
  return options.filter((edge) => distToCiv(otherEnd(edge, expedition.at)) === best);
}

/** Dijkstra que respeta los tramos bloqueados de la expedición. */
export function distancesFromAvoiding(
  region: WorldRegion,
  start: string,
  blockedEdges: string[],
): Record<string, number> {
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
      if (blockedEdges.includes(edgeKey(edge.a, edge.b))) continue;
      const next = otherEnd(edge, best);
      const candidate = dist[best]! + edge.days;
      if (dist[next] === undefined || candidate < dist[next]!) dist[next] = candidate;
    }
  }
  return dist;
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
  tier: 'escolta' | 'asalto' | 'caza' | 'incursion' | 'defensa',
): string {
  const dist = distancesFrom(region, region.hq);
  const range = tier === 'escolta' || tier === 'defensa' ? [1, 2]
    : tier === 'asalto' ? [2, 3]
    : [3, 99]; // caza e incursión: lo hondo del mapa
  // Los contratos NUNCA apuntan a nodos ocultos: no se puede ir a lo que
  // aún no está en el mapa. Los secretos se ganan explorando, no por encargo.
  const reachable = region.nodes.filter((n) => n.id !== region.hq && !n.hidden);
  const candidates = reachable
    .filter((n) => (dist[n.id] ?? 99) >= range[0]! && (dist[n.id] ?? 99) <= range[1]!)
    .map((n) => n.id)
    .sort();
  const pool = candidates.length > 0
    ? candidates
    : reachable.map((n) => n.id).sort();
  const rand = mulberry32(hashString(contractId));
  return pool[Math.floor(rand() * pool.length)]!;
}

export function startExpedition(
  region: WorldRegion,
  contractId: string,
  tier: 'escolta' | 'asalto' | 'caza' | 'incursion' | 'defensa',
): ExpeditionState {
  const targetNodeId = assignTarget(region, contractId, tier);
  const target = region.nodes.find((n) => n.id === targetNodeId)!;
  return {
    contractId,
    regionId: region.id,
    targetNodeId,
    at: region.hq,
    day: 0,
    missionDone: false,
    blockedEdges: [],
    log: [`Día 0 — Partimos hacia ${target.name}.`],
  };
}

/**
 * Expedición LIBRE: sin contrato ni objetivo. Se sale a recorrer la
 * región por cuenta propia — ruinas, ciudades, trabajos de taberna —
 * y se cierra volviendo al taller. `key` siembra los eventos de ruta
 * y queda grabado en el estado: a partir de ahí todo es determinista.
 */
export function startFreeExpedition(region: WorldRegion, key: string): ExpeditionState {
  return {
    contractId: `libre|${key}`,
    regionId: region.id,
    targetNodeId: region.hq,
    at: region.hq,
    day: 0,
    // Sin misión pendiente: volver al taller cierra la expedición sin
    // abandonar nada.
    missionDone: true,
    blockedEdges: [],
    log: ['Día 0 — Salimos a recorrer la región por cuenta propia, sin contrato.'],
  };
}

// ── Encrucijadas: la ruta pregunta y el jugador responde ────────────────

export interface EncounterOption {
  id: string;
  /** Texto del botón. */
  label: string;
  /** Consecuencia anunciada: se decide informado, sin letra pequeña. */
  detail: string;
}

export interface Encounter {
  /** Clave determinista (contrato|tramo|día): rehacer no cambia nada. */
  id: string;
  kind: 'caravana' | 'manada' | 'perdido' | 'peaje' | 'chatarra';
  prompt: string;
  options: EncounterOption[];
}

export interface EncounterOutcome {
  expedition: ExpeditionState;
  /** Cambio de suministros (+ gana, − entrega). */
  supplyDelta: number;
  /** Estrés aplicado a toda la tripulación (+ carga, − alivia). */
  stressDelta: number;
  cargo?: CargoItem;
  /** Quién se entera y qué le parece (facción → delta de reputación). */
  reputation?: Array<{ factionId: string; delta: number }>;
  text: string;
}

const ENCOUNTERS: Record<Encounter['kind'], { prompt: string; options: EncounterOption[] }> = {
  caravana: {
    prompt: 'Una caravana varada bloquea el paso: su Gustav de carga ha volcado y el sol no perdona.',
    options: [
      { id: 'ayudar', label: '⚙ Echar una mano', detail: '+1 jornada; pagan al llegar (bodega); Colonos +8' },
      { id: 'seguir', label: '→ Seguir de largo', detail: 'sin coste; el camino no espera' },
      { id: 'saquear', label: '☠ Quedarse la carga', detail: 'botín ⌾300; Colonos −12, Gremio −6; estrés +10' },
    ],
  },
  chatarra: {
    prompt: 'Un derrumbe reciente ha destapado una veta de chatarra antigua. El metal aún huele a tormenta.',
    options: [
      { id: 'excavar', label: '⛏ Excavar por tu cuenta', detail: '+1 jornada; veta a la bodega (⌾240)' },
      { id: 'avisar', label: '📻 Marcar y avisar a los clanes', detail: 'lo suyo es suyo: Chatarreros +8' },
      { id: 'pasar', label: '→ Ni tocarlo', detail: 'sin coste; hay vetas que traen mala sombra' },
    ],
  },
  peaje: {
    prompt: 'Tres máquinas chatarreras cortan el desfiladero. El de delante golpea el casco de su Molga: peaje.',
    options: [
      { id: 'pagar', label: '📦 Pagar el peaje', detail: 'suministros −2; Chatarreros +6' },
      { id: 'plantarse', label: '🛡 Plantarse sin ceder', detail: 'estrés +8; Chatarreros −8, Colonos +4' },
      { id: 'unirse', label: '☠ Unirse al expolio de hoy', detail: 'botín ⌾260; Colonos −15, Chatarreros +10; estrés +8' },
      { id: 'rodear', label: '↩ Dar el rodeo largo', detail: '+1 jornada; nadie cobra, nadie sangra' },
    ],
  },
  manada: {
    prompt: 'Una manada de zoids salvajes cruza el valle en silencio. Nadie los guía. Nadie los ha domado.',
    options: [
      { id: 'observar', label: '👁 Apagar motores y mirar', detail: 'la tripulación respira: estrés −6' },
      { id: 'cazar', label: '🎯 Cazar una pieza', detail: 'suministros +2; sucio y ruidoso: estrés +6' },
    ],
  },
  perdido: {
    prompt: 'Un piloto medio deshidratado hace señas junto a un cráter. Su máquina es chatarra desde hace días.',
    options: [
      { id: 'llevar', label: '🤝 Subirlo a bordo', detail: '+1 jornada; su gremio paga rescates (bodega); Gremio +8' },
      { id: 'agua', label: '🥤 Dejarle agua y señas', detail: 'suministros −1; se duerme mejor: estrés −4' },
      { id: 'nada', label: '→ No es asunto nuestro', detail: 'sin coste; el desierto decide' },
    ],
  },
};

/**
 * El territorio dicta a quién te cruzas: en la vega mandan caravanas y
 * manadas, en las dunas los perdidos, en la sierra los peajes. Sin
 * bioma, reparto uniforme.
 */
const BIOME_ENCOUNTERS: Record<EdgeBiome, Encounter['kind'][]> = {
  vega: ['caravana', 'caravana', 'manada', 'perdido'],
  dunas: ['perdido', 'perdido', 'manada', 'caravana'],
  sierra: ['peaje', 'peaje', 'perdido', 'caravana'],
};

function pickEncounterKind(
  biome: EdgeBiome | undefined,
  continentId: string,
  rand: () => number,
): Encounter['kind'] {
  const base = biome ? BIOME_ENCOUNTERS[biome] : (Object.keys(ENCOUNTERS) as Encounter['kind'][]);
  // En El Hierro la chatarra aflora por todas partes: entra al reparto.
  const pool = continentId === 'hierro' ? [...base, 'chatarra', 'chatarra'] as Encounter['kind'][] : base;
  return pool[Math.floor(rand() * pool.length)]!;
}

/** Resuelve la opción elegida. Determinista: sin dados escondidos. */
export function resolveEncounter(
  expedition: ExpeditionState,
  encounter: Encounter,
  optionId: string,
): EncounterOutcome {
  const stamp = (days: number, text: string): ExpeditionState => ({
    ...expedition,
    day: expedition.day + days,
    log: [...expedition.log, `Día ${expedition.day + days} — ${text}`],
  });
  switch (`${encounter.kind}|${optionId}`) {
    case 'caravana|ayudar':
      return {
        expedition: stamp(1, 'Enderezamos el Gustav de la caravana. Pagan sin regatear.'),
        supplyDelta: 0, stressDelta: 0,
        cargo: { name: 'Pago de la caravana', value: 220 },
        reputation: [{ factionId: 'colonos', delta: 8 }],
        text: 'Un día de grúa y sudor. La caravana paga ⌾220 y corre la voz: Colonos +8.',
      };
    case 'caravana|saquear':
      return {
        expedition: stamp(0, 'Nos quedamos la carga de la caravana. Nadie dispara. Nadie olvida.'),
        supplyDelta: 0, stressDelta: 10,
        cargo: { name: 'Botín de la caravana', value: 300 },
        reputation: [{ factionId: 'colonos', delta: -12 }, { factionId: 'gremio', delta: -6 }],
        text: 'Botín ⌾300. Colonos −12, Gremio −6. El silencio en cabina pesa (estrés +10).',
      };
    case 'chatarra|excavar':
      return {
        expedition: stamp(1, 'Un día de pala y cabrestante: la veta viaja en la bodega.'),
        supplyDelta: 0, stressDelta: 0,
        cargo: { name: 'Veta de chatarra antigua', value: 240 },
        text: 'Metal viejo y bueno: ⌾240 a la bodega. En tierra de clanes, mejor no presumir.',
      };
    case 'chatarra|avisar':
      return {
        expedition: stamp(0, 'Marcamos la veta y avisamos por radio. Los clanes no olvidan un gesto así.'),
        supplyDelta: 0, stressDelta: 0,
        reputation: [{ factionId: 'chatarreros', delta: 8 }],
        text: 'Lo caído es suyo, y lo saben: Chatarreros +8.',
      };
    case 'peaje|pagar':
      return {
        expedition: stamp(0, 'Pagamos el peaje de los chatarreros. Negocios son negocios.'),
        supplyDelta: -2, stressDelta: 0,
        reputation: [{ factionId: 'chatarreros', delta: 6 }],
        text: 'Suministros −2. Los clanes toman nota: Chatarreros +6.',
      };
    case 'peaje|plantarse':
      return {
        expedition: stamp(0, 'Nadie cede el paso. Los chatarreros escupen al suelo y abren el desfiladero.'),
        supplyDelta: 0, stressDelta: 8,
        reputation: [{ factionId: 'chatarreros', delta: -8 }, { factionId: 'colonos', delta: 4 }],
        text: 'El pulso se gana sin disparar (estrés +8). Chatarreros −8; la comarca respira: Colonos +4.',
      };
    case 'peaje|unirse':
      return {
        expedition: stamp(0, 'Hoy cobramos peaje con ellos. La carga de otros pasa por nuestras manos.'),
        supplyDelta: 0, stressDelta: 8,
        cargo: { name: 'Parte del expolio', value: 260 },
        reputation: [{ factionId: 'colonos', delta: -15 }, { factionId: 'chatarreros', delta: 10 }],
        text: 'Parte del expolio: ⌾260. Colonos −15, Chatarreros +10. Hay cosas que no se lavan (estrés +8).',
      };
    case 'peaje|rodear':
      return {
        expedition: stamp(1, 'Damos el rodeo largo. El desfiladero queda a nuestra espalda, con sus dueños.'),
        supplyDelta: 0, stressDelta: 0,
        text: 'Una jornada más de polvo. Nadie cobra, nadie sangra.',
      };
    case 'manada|observar':
      return {
        expedition: stamp(0, 'Motores apagados: la manada pasa de largo. Nadie habla un rato.'),
        supplyDelta: 0, stressDelta: -6,
        text: 'Verlos libres descansa algo que el taller no repara (estrés −6).',
      };
    case 'manada|cazar':
      return {
        expedition: stamp(0, 'Cazamos una pieza de la manada. Carne y celdas para la despensa; nadie mira atrás.'),
        supplyDelta: 2, stressDelta: 6,
        text: 'Suministros +2. El ruido y la sangre se quedan en la cabeza (estrés +6).',
      };
    case 'perdido|llevar':
      return {
        expedition: stamp(1, 'Subimos al piloto perdido. Duerme dos jornadas seguidas.'),
        supplyDelta: 0, stressDelta: 0,
        cargo: { name: 'Recompensa del rescate', value: 180 },
        reputation: [{ factionId: 'gremio', delta: 8 }],
        text: 'El Gremio paga rescates (⌾180) y apunta el gesto: Gremio +8.',
      };
    case 'perdido|agua':
      return {
        expedition: stamp(0, 'Le dejamos agua y las señas del siguiente pozo. Se pierde en el reflejo del sol.'),
        supplyDelta: -1, stressDelta: -4,
        text: 'Suministros −1. Esta noche se duerme mejor (estrés −4).',
      };
    default:
      return {
        expedition: stamp(0, 'Seguimos camino sin mirar atrás.'),
        supplyDelta: 0, stressDelta: 0,
        text: 'El camino sigue.',
      };
  }
}

export interface TravelResult {
  expedition: ExpeditionState;
  /** Suministros consumidos por el tramo (0 si el tramo se frustró). */
  supplyCost: number;
  event: TravelEventKind;
  eventText: string;
  /** Botín encontrado en ruta, si lo hubo. */
  cargo?: CargoItem;
  /** Encrucijada pendiente: la UI pregunta y aplica resolveEncounter. */
  encounter?: Encounter;
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

  // Tramo roto: se vadea — lento, penoso y sin sorpresas.
  if (expedition.blockedEdges.includes(key)) {
    const fordDay = expedition.day + edge.days + 1;
    const toName = region.nodes.find((n) => n.id === to)!.name;
    return {
      expedition: {
        ...expedition,
        at: to,
        day: fordDay,
        log: [...expedition.log, `Día ${fordDay} — ${edge.flavor}: vadeamos los restos del puente. Lento y penoso, pero llegamos a ${toName}.`],
      },
      supplyCost: edge.days + 1,
      event: 'calm',
      eventText: `Vadeamos los restos del puente hacia ${toName} (+1 jornada).`,
    };
  }

  const day = expedition.day + edge.days;
  const rand = mulberry32(hashString(`${expedition.contractId}|${key}|${expedition.day}`));
  const roll = rand();

  // Puente roto: solo una vez por tramo, y nunca en el último salto a
  // un objetivo sin alternativa (no bloquear la misión por completo).
  const blocked = [...expedition.blockedEdges];
  const usableFromHere = neighbors(region, from)
    .filter((e) => !blocked.includes(edgeKey(e.a, e.b))).length;
  if (roll < 0.18 && !blocked.includes(key) && usableFromHere > 1) {
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
  let encounter: Encounter | undefined;
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
  } else if (roll >= 0.52 && roll < 0.64) {
    // Encrucijada: la ruta pregunta. La clase se elige aquí (determinista)
    // y las consecuencias viven en resolveEncounter, sin dados escondidos.
    event = 'encounter';
    const kind = pickEncounterKind(edge.biome, region.continentId, rand);
    encounter = {
      id: `${expedition.contractId}|${key}|${expedition.day}`,
      kind,
      prompt: ENCOUNTERS[kind].prompt,
      options: ENCOUNTERS[kind].options,
    };
    eventText = encounter.prompt;
  }

  const next: ExpeditionState = {
    ...expedition,
    at: to,
    day,
    forcedWeather,
    log: [...expedition.log, `Día ${day} — ${edge.flavor}. ${eventText}`],
  };
  return { expedition: next, supplyCost: edge.days, event, eventText, cargo, encounter };
}

/**
 * Tramos transitables desde la posición actual: ni rotos, ni hacia lugares
 * aún ocultos (los secretos no aparecen hasta descubrirlos).
 */
export function availableEdges(
  expedition: ExpeditionState,
  region: WorldRegion,
  discovered: string[] = [],
): WorldEdge[] {
  return neighbors(region, expedition.at)
    .filter((e) => !expedition.blockedEdges.includes(edgeKey(e.a, e.b)))
    .filter((e) => {
      const dest = region.nodes.find((n) => n.id === otherEnd(e, expedition.at));
      return !!dest && isNodeVisible(dest, discovered);
    });
}

// ── Exploración de sitios (ruinas): riesgo y recompensa ──────────────────

export interface ExploreResult {
  expedition: ExpeditionState;
  outcome: 'find' | 'dust' | 'scare';
  eventText: string;
  cargo?: CargoItem;
  /** Estrés que el susto añade a TODOS los pilotos (0 si no hubo). */
  stressDelta: number;
  /**
   * Nodos OCULTOS que la exploración sacó a la luz. El cliente los añade a
   * la lista persistente de descubiertos de la campaña (no a la expedición:
   * un secreto hallado se queda en el mapa para siempre).
   */
  discovered?: string[];
}

const RUIN_FINDS: CargoItem[] = [
  { name: 'Reliquia de antes de la guerra', value: 420 },
  { name: 'Banco de memoria corrupto', value: 300 },
  { name: 'Aleación irrepetible', value: 360 },
  { name: 'Sello de una casa extinta', value: 500 },
];

/** Botín de las ruinas SECRETAS: el que llega tan lejos, cobra distinto. */
const SECRET_RUIN_FINDS: CargoItem[] = [
  { name: 'Núcleo prohibido intacto', value: 780 },
  { name: 'Códice de una guerra olvidada', value: 640 },
  { name: 'Aleación de estrella caída', value: 900 },
  { name: 'Corona de datos de los Primeros', value: 720 },
];

/**
 * ¿El lugar admite exploración (y aún no se exploró en este viaje)? Se
 * explora una RUINA (por botín) o cualquier lugar con secretos por revelar
 * (por descubrimiento). Un paraje pelado no tiene nada que registrar.
 */
export function canExplore(
  expedition: ExpeditionState,
  region: WorldRegion,
  discovered: string[] = [],
): boolean {
  const node = region.nodes.find((n) => n.id === expedition.at);
  if (!node || (expedition.explored ?? []).includes(node.id)) return false;
  const isRuin = node.kind === 'ruinas';
  const hasSecretsToReveal = (node.reveals ?? []).some((id) => !discovered.includes(id));
  return isRuin || hasSecretsToReveal;
}

/**
 * Explorar un lugar: cuesta un día, y lo que pase es determinista por
 * (contrato, lugar). Las ruinas pagan botín (las secretas, más rico); y la
 * exploración a fondo REVELA los caminos ocultos que el lugar escondía.
 * Nadie vuelve con las manos vacías... casi nadie.
 */
export function exploreSite(
  expedition: ExpeditionState,
  region: WorldRegion,
  discovered: string[] = [],
): ExploreResult {
  const node = region.nodes.find((n) => n.id === expedition.at)!;
  const rand = mulberry32(hashString(`${expedition.contractId}|explore|${node.id}`));
  const roll = rand();
  const day = expedition.day + 1;
  const explored = [...(expedition.explored ?? []), node.id];
  const newlyRevealed = (node.reveals ?? []).filter((id) => !discovered.includes(id));

  const isRuin = node.kind === 'ruinas';
  const finds = node.secret ? SECRET_RUIN_FINDS : RUIN_FINDS;
  // Las secretas: mejores probabilidades de hallazgo, pero el susto muerde más.
  const findCut = node.secret ? 0.7 : 0.45;
  const dustCut = node.secret ? 0.85 : 0.7;
  const scareLoot = node.secret ? 0.7 : 0.5;

  let outcome: ExploreResult['outcome'];
  let eventText: string;
  let cargo: CargoItem | undefined;
  let stressDelta = 0;

  if (!isRuin) {
    // Registrar un paraje: no hay botín, pero puede sacar secretos a la luz.
    outcome = 'dust';
    eventText = newlyRevealed.length > 0
      ? 'Peinamos el lugar palmo a palmo.'
      : 'Nada que rascar aquí.';
  } else if (roll < findCut) {
    outcome = 'find';
    cargo = finds[Math.floor(rand() * finds.length)]!;
    eventText = `Bajo los escombros: ${cargo.name} (⌾${cargo.value}).`;
  } else if (roll < dustCut) {
    outcome = 'dust';
    eventText = 'Solo polvo y ecos. Alguien llegó antes.';
  } else {
    outcome = 'scare';
    stressDelta = node.secret ? 16 : 12;
    eventText = 'Algo se movió entre las vigas. Nadie lo vio bien. Nadie quiere volver a mirar.';
    if (rand() < scareLoot) {
      cargo = finds[Math.floor(rand() * finds.length)]!;
      eventText += ` Aun así, salió con ${cargo.name} (⌾${cargo.value}).`;
    }
  }

  // El descubrimiento: la exploración a fondo cambia el mapa.
  let revealText = '';
  if (newlyRevealed.length > 0) {
    const names = newlyRevealed.map((id) => region.nodes.find((n) => n.id === id)?.name ?? id);
    revealText = ` Entre lo hallado, un rastro cambia el mapa: ${names.join(', ')} sale de las sombras.`;
  }

  return {
    expedition: {
      ...expedition,
      day,
      explored,
      log: [...expedition.log, `Día ${day} — Exploramos ${node.name}. ${eventText}${revealText}`],
    },
    outcome,
    eventText: eventText + revealText,
    cargo,
    stressDelta,
    ...(newlyRevealed.length > 0 ? { discovered: newlyRevealed } : {}),
  };
}
