/**
 * Modo mercenario: la capa de CAMPAÑA sobre el motor. Contratos →
 * batalla → créditos → tienda/reparaciones, con daño persistente.
 *
 * Es lógica pura y determinista: no importa nada del motor ni del DOM.
 * El cliente le pasa los datos que necesita (resultado de la batalla,
 * maxHp calculado por el motor) y persiste el estado donde quiera.
 * Vive en src/game/ — ni motor (src/core) ni cliente (src/web): la capa
 * de juego que el motor no debe conocer.
 */
import type { StatModifier } from '../core/types.js';

/**
 * Refuerzo de blindaje: un búnker de placas que se monta en el taller. Da
 * aguante (absorbe daño antes que el casco) a cambio de velocidad. Se gasta
 * en batalla y se repara en el taller.
 */
export interface ReinforcementSpec {
  /** Puntos de blindaje que aporta el refuerzo. */
  armor: number;
  /** Coste de montar el refuerzo. */
  fitCost: number;
  /** Coste de reparar cada punto de blindaje gastado. */
  repairPerPoint: number;
  /** Casillas de movimiento que resta (más lento). */
  movePenalty: number;
  /** CT que resta (carga más despacio). */
  speedPenalty: number;
}

export interface EconomyTable {
  startingCredits: number;
  /** Refuerzo de blindaje montable en el taller. */
  reinforcement: ReinforcementSpec;
  /** unitTypeIds del hangar inicial (orden = huecos de despliegue). */
  starterRoster: string[];
  repairCostPerHp: number;
  /** Reconstruir un Zoid destruido cuesta precio × factor. */
  rebuildFactor: number;
  /** Vender (chasis o arma) devuelve precio × factor. */
  sellFactor: number;
  /** Precio de una unidad de suministros (una jornada de marcha). */
  supplyPrice: number;
  /** Suministros con los que arranca la campaña. */
  startingSupplies: number;
  zoidPrices: Record<string, number>;
  weaponPrices: Record<string, number>;
}

/** Un Zoid en propiedad, con su daño y su montaje persistentes. */
/**
 * Hoja de servicio de UNA máquina: la unidad no gana experiencia (ley
 * del diseño), pero sí HISTORIA. Se graba al liquidar cada batalla y
 * en el taller; las cicatrices cosméticas de la silueta salen de aquí.
 */
export interface ZoidRecord {
  battles: number;
  kills: number;
  rebuilds: number;
  ejections: number;
  retreats: number;
}

export interface OwnedZoid {
  unitTypeId: string;
  /** HP actual; el maxHp lo calcula el motor según el montaje. */
  hp: number;
  destroyed: boolean;
  weapons: string[];
  slots: Record<string, string>;
  /** Hoja de servicio (ausente en guardados viejos = a estrenar). */
  record?: ZoidRecord;
  /** Refuerzo de blindaje montado (búnker de placas). Ausente = sin refuerzo. */
  reinforced?: boolean;
  /** Blindaje de refuerzo ACTUAL: se gasta en batalla, se repara en el taller. */
  armor?: number;
  /**
   * CONTINUIDAD expedición↔combate: cómo salió el reactor/arsenal de la última
   * batalla — calor y energía residuales, munición en cargador. Se ARRASTRA a
   * la siguiente batalla (entras caliente, con el cargador a medias) hasta que
   * una jornada de descanso hace refit (el reactor se enfría, se reabastece).
   * Ausentes = a estrenar. Golden/campañas viejas: sin estos campos, todo igual.
   */
  residualHeat?: number;
  residualEnergy?: number;
  ammo?: Record<string, number>;
}

/** Hoja de servicio con huecos a cero (guardados viejos incluidos). */
export function zoidRecord(zoid: OwnedZoid): ZoidRecord {
  return {
    battles: zoid.record?.battles ?? 0,
    kills: zoid.record?.kills ?? 0,
    rebuilds: zoid.record?.rebuilds ?? 0,
    ejections: zoid.record?.ejections ?? 0,
    retreats: zoid.record?.retreats ?? 0,
  };
}

/** Acumula sucesos en la hoja de servicio. Sin mutar. */
export function updateZoidRecord(zoid: OwnedZoid, delta: Partial<ZoidRecord>): OwnedZoid {
  const record = zoidRecord(zoid);
  return {
    ...zoid,
    record: {
      battles: record.battles + (delta.battles ?? 0),
      kills: record.kills + (delta.kills ?? 0),
      rebuilds: record.rebuilds + (delta.rebuilds ?? 0),
      ejections: record.ejections + (delta.ejections ?? 0),
      retreats: record.retreats + (delta.retreats ?? 0),
    },
  };
}

/** Tramos de veteranía del chasis, por batallas servidas. */
export const SERVICE_TIERS = [
  { id: 'a-estrenar', label: 'a estrenar', min: 0 },
  { id: 'curtido', label: 'curtido', min: 3 },
  { id: 'veterano', label: 'veterano', min: 8 },
  { id: 'leyenda', label: 'leyenda del taller', min: 15 },
] as const;

export function serviceTier(record: ZoidRecord): (typeof SERVICE_TIERS)[number] {
  return [...SERVICE_TIERS].reverse().find((t) => record.battles >= t.min) ?? SERVICE_TIERS[0];
}

/**
 * Cicatrices visibles de la silueta (0-4): una por cada 4 batallas y
 * una por reconstrucción. El metal cuenta lo vivido sin decir palabra.
 */
export function scarLevel(record: ZoidRecord): number {
  return Math.min(4, Math.floor(record.battles / 4) + record.rebuilds);
}

export interface CampaignState {
  credits: number;
  /** Huecos de despliegue (longitud fija). */
  roster: OwnedZoid[];
  /** Arsenal en propiedad: weaponId → unidades poseídas. */
  armory: Record<string, number>;
  contractsDone: number;
  /** Suministros de expedición: cada jornada de viaje consume. */
  supplies: number;
  /** Bodega: hallazgos de ruta que se venden al volver al taller. */
  cargo: Array<{ name: string; value: number }>;
  /** Planos de módulos comprados en fábricas (desbloquean el montaje). */
  moduleBlueprints: string[];
  /**
   * La biografía de la COMPAÑERA (el hueco 1 del roster): marcas,
   * memoria y compenetración. La gestiona src/game/companion.ts.
   */
  companion: { markIds: string[]; memory: Record<string, number>; rapport: number };
  /** Reputación con cada facción (id → −100..+100; ausente = 0). */
  reputation: Record<string, number>;
  /** Diario de la compañía: la historia escrita desde los hechos. */
  chronicle: string[];
  /**
   * Región donde está la base de operaciones: el último taller donde
   * se cerró expedición. El contenido (ids) vive en src/data/world.
   */
  homeRegionId?: string;
  /** Destacamentos en curso (src/game/assignment.ts). */
  assignments?: import('./assignment.js').ActiveAssignment[];
  /**
   * Nodos OCULTOS ya descubiertos (ruinas secretas, parajes velados). Es
   * PERSISTENTE entre expediciones: un secreto hallado se queda en el mapa.
   * Ausente = nada descubierto (migración de partidas viejas).
   */
  discovered?: string[];
  /**
   * Dificultad elegida al fundar la compañía. Fija el DESGASTE de combate
   * (no infla HP: el determinismo es ley). Ausente = 'mercenario' (partidas
   * viejas y migración).
   */
  difficulty?: string;
  /**
   * DOSIER de la facción enemiga: lo que ha visto de tu estilo a lo largo de
   * los contratos. No es aprendizaje automático (rompería el determinismo): son
   * conteos que sesgan la composición de las próximas escuadras hacia contras.
   * Ausente = aún no te han fichado (partidas viejas y primeras batallas).
   */
  dossier?: Dossier;
}

/** Lo que la facción enemiga ha observado del estilo del jugador. */
export interface Dossier {
  /** Golpes del jugador a corta distancia (alcance ≤1). */
  meleeHits: number;
  /** Golpes del jugador a distancia (alcance ≥3). */
  rangedHits: number;
  /** Veces que el jugador ENGANCHÓ la sobrecarga del reactor. */
  overclocks: number;
  /** Batallas observadas (para exigir muestra antes de adaptarse). */
  battles: number;
}

/**
 * Centinela de "HP a tope" para chasis recién comprados/estrenados: el
 * cliente no conoce el maxHp real (depende del montaje y lo calcula el
 * motor), así que se guarda este valor y el motor lo acota al desplegar.
 * MAX_SAFE_INTEGER sobrevive a JSON (Infinity no).
 */
export const FULL_HP = Number.MAX_SAFE_INTEGER;

export interface Contract {
  id: string;
  name: string;
  /**
   * Tipo de encargo — cada uno se JUEGA distinto: escolta protege al
   * carguero, asalto aguanta refuerzos enemigos, caza derriba al
   * cabecilla, incursión planta una máquina en la zona marcada y
   * defensa resiste las rondas del asedio.
   */
  tier: 'escolta' | 'asalto' | 'caza' | 'incursion' | 'defensa';
  /** unitTypeIds del equipo enemigo (4). */
  enemySquad: string[];
  reward: number;
  salvagePerKill: number;
}

// ── Estado inicial ───────────────────────────────────────────────────────

export interface NewCampaignConfig {
  /** Créditos y suministros iniciales (dificultad). */
  credits?: number;
  supplies?: number;
  /** Roster inicial (la posición 1 es la compañera). */
  starterRoster?: string[];
  /** Dificultad elegida: fija el desgaste de combate. */
  difficulty?: string;
}

export function newCampaign(
  economy: EconomyTable,
  factoryLoadout: (unitTypeId: string) => { weapons: string[]; slots: Record<string, string> },
  config: NewCampaignConfig = {},
): CampaignState {
  const armory: Record<string, number> = {};
  const roster = (config.starterRoster ?? economy.starterRoster).map((unitTypeId) => {
    const loadout = factoryLoadout(unitTypeId);
    for (const weaponId of loadout.weapons) {
      armory[weaponId] = (armory[weaponId] ?? 0) + 1;
    }
    return { unitTypeId, hp: FULL_HP, destroyed: false, ...loadout };
  });
  return {
    credits: config.credits ?? economy.startingCredits,
    roster, armory, contractsDone: 0,
    supplies: config.supplies ?? economy.startingSupplies,
    cargo: [], moduleBlueprints: [],
    companion: { markIds: [], memory: {}, rapport: 0 },
    reputation: {},
    chronicle: [],
    ...(config.difficulty ? { difficulty: config.difficulty } : {}),
  };
}

// ── Contratos deterministas ──────────────────────────────────────────────

/** mulberry32: mismo generador que usa el motor, replicado aquí para no
 *  importar src/core (la capa de juego no depende del motor). */
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

const TIERS: Array<{ tier: Contract['tier']; budget: number; reward: number; salvage: number; names: string[] }> = [
  {
    tier: 'escolta', budget: 3400, reward: 700, salvage: 60,
    names: ['Escoltar el convoy de Rómeo', 'Patrulla del paso seco', 'Defensa del puesto 9', 'Caravana minera'],
  },
  {
    tier: 'asalto', budget: 5200, reward: 1200, salvage: 70,
    names: ['Asalto al depósito imperial', 'Romper la línea del río', 'Toma del repetidor', 'Golpe al hangar avanzado'],
  },
  {
    tier: 'caza', budget: 7200, reward: 1900, salvage: 80,
    names: ['Caza del lobo blanco', 'Eliminar a la manada de élite', 'Emboscada en el cañón', 'Cabeza del comandante'],
  },
  // PROVISIONAL: nombres de primera pasada; la dirección repoblará.
  {
    // Incursión: paga bien y la chatarra poco — no vas allí a derribar.
    tier: 'incursion', budget: 5600, reward: 1500, salvage: 40,
    names: ['Incursión al archivo sellado', 'Robo del prototipo', 'Sabotaje del repetidor', 'Los planos del dique'],
  },
  {
    // Defensa: contra el asedio (4 iniciales + oleada), chatarra digna.
    tier: 'defensa', budget: 5800, reward: 1600, salvage: 65,
    names: ['Aguantar el puesto del vado', 'Asedio a la muralla vieja', 'La noche de las bengalas', 'Última línea del silo'],
  },
];

/**
 * Las ofertas de contrato del ciclo actual (una por tipo de encargo).
 * Deterministas: mismas ofertas para el mismo contractsDone. El cliente
 * decide cuántas enseñar (reputación) y en qué orden (rotación).
 */
/** Suma al dosier lo observado en una batalla (función pura, no muta). */
export function updateDossier(
  prev: Dossier | undefined,
  seen: { melee: number; ranged: number; overclocks: number },
): Dossier {
  const d = prev ?? { meleeHits: 0, rangedHits: 0, overclocks: 0, battles: 0 };
  return {
    meleeHits: d.meleeHits + seen.melee,
    rangedHits: d.rangedHits + seen.ranged,
    overclocks: d.overclocks + seen.overclocks,
    battles: d.battles + 1,
  };
}

/** Estilo dominante del jugador según el dosier. */
export type PlayerStyle = 'melee' | 'ranged' | 'reactor' | 'balanced';

/**
 * Lee el estilo dominante. Exige muestra (≥2 batallas y ≥4 golpes clasificados,
 * o sobrecarga recurrente) antes de decidir: sin datos, no se adapta.
 */
export function readStyle(d: Dossier | undefined): PlayerStyle {
  if (!d || d.battles < 2) return 'balanced';
  if (d.overclocks >= d.battles) return 'reactor'; // sobrecarga ~1+ por batalla
  const total = d.meleeHits + d.rangedHits;
  if (total >= 4) {
    if (d.meleeHits / total >= 0.62) return 'melee';
    if (d.rangedHits / total >= 0.62) return 'ranged';
  }
  return 'balanced';
}

/** Roles enemigos que CONTRARRESTAN el estilo del jugador. */
export function counterRoles(style: PlayerStyle): string[] {
  switch (style) {
    case 'melee': return ['sniper', 'flyer'];         // kiters que castigan el rush
    case 'ranged': return ['assault', 'skirmisher'];  // cerradores rápidos
    case 'reactor': return ['assault', 'skirmisher']; // presión antes de que el reactor pague
    case 'balanced': return [];
  }
}

/**
 * Armas que la facción monta para contrarrestarte a nivel de ARMA (loadouts
 * enemigos), no solo de chasis. Son de la biblioteca (sin mountSlot: caben en
 * cualquier chasis). Vacío = sin contra por arma.
 */
export function counterWeapons(style: PlayerStyle): string[] {
  switch (style) {
    case 'reactor': return ['lib-w-plasma-flamer', 'lib-w-incendiary-mortar']; // cuecen tu reactor
    case 'melee': return ['lib-w-suppressor'];    // te FIJAN al cargar (sin contra ni vigilancia)
    case 'ranged': return ['lib-w-smoke-mortar'];  // humo para sobrevivir tu hostigamiento
    case 'balanced': return [];
  }
}

/** Frase de inteligencia para el parte de contrato (o nada si no adapta). */
export function adaptationHint(style: PlayerStyle): string | undefined {
  switch (style) {
    case 'melee': return 'Inteligencia: te han fichado peleando de cerca — traen fuego a distancia y supresores para fijarte.';
    case 'ranged': return 'Inteligencia: saben que hostigas desde lejos — mandan cerradores rápidos con cortinas de humo.';
    case 'reactor': return 'Inteligencia: se han hartado de tus reactores forzados — vienen con LANZALLAMAS para cocerte.';
    case 'balanced': return undefined;
  }
}

/**
 * FUERZA de la oposición según el progreso: el presupuesto de la escuadra
 * enemiga arranca FLOJO (grunts baratos, para aprender el oficio) y sube SUAVE
 * y SIN MESETA para que el final apriete de verdad aun con roster de élite. Es
 * una GLIDE ancha: ~0.55 al empezar, ~1.0 (nominal) hacia el contrato ~20 y
 * hasta 1.6 en el tramo final. Es el eje de STRENGTH de la curva de dificultad
 * (la inteligencia la lleva aiSkill; esto es el MÚSCULO). 1 = presupuesto base.
 */
export function campaignStrength(contractsDone: number): number {
  return Math.min(1.6, 0.55 + contractsDone / 45); // 0.55 → 1.0 (~c20) → 1.6 (~c47)
}

/** Elige un id proporcional a su peso (determinista dado `r` en [0,1)). */
function weightedPick(ids: string[], r: number, weightOf?: (id: string) => number): string {
  if (!weightOf) return ids[Math.floor(r * ids.length)]!;
  const weights = ids.map((id) => Math.max(0.0001, weightOf(id)));
  const total = weights.reduce((a, b) => a + b, 0);
  let x = r * total;
  for (let i = 0; i < ids.length; i++) {
    x -= weights[i]!;
    if (x < 0) return ids[i]!;
  }
  return ids[ids.length - 1]!;
}

/**
 * Rellena una escuadra de `slots` GASTANDO el presupuesto: por hueco elige entre
 * lo que cabe, favoreciendo unidades que aprovechan el hueco (afinidad ∝ (precio/
 * hueco)²) para que un contrato RICO traiga chasis caros en vez de malgastarse en
 * chatarra — es lo que hace que la FUERZA importe pasado el presupuesto base. El
 * sesgo de composición `weightOf` (adaptación de facción) sigue multiplicando.
 * Determinista dado `rand`; una tirada por hueco. El líder (más caro) va primero.
 */
function fillSquad(
  enemyPool: string[],
  economy: EconomyTable,
  slots: number,
  budget: number,
  rand: () => number,
  weightOf?: (id: string) => number,
  affordCap = 1.35,
): string[] {
  const squad: string[] = [];
  let remaining = budget;
  for (let i = 0; i < slots; i++) {
    const slotBudget = remaining / (slots - i);
    const affordable = enemyPool.filter((id) => (economy.zoidPrices[id] ?? 0) <= slotBudget * affordCap);
    const spendWeight = (id: string) => {
      const ratio = (economy.zoidPrices[id] ?? 0) / Math.max(1, slotBudget);
      return ratio * ratio; // favorece gastar el hueco (élites en contratos ricos)
    };
    const weight = (id: string) => Math.max(0.0001, weightOf?.(id) ?? 1) * spendWeight(id);
    const pick = affordable.length > 0
      ? weightedPick(affordable, rand(), weight)
      : enemyPool.reduce((a, b) => ((economy.zoidPrices[a] ?? 0) <= (economy.zoidPrices[b] ?? 0) ? a : b));
    squad.push(pick);
    remaining -= economy.zoidPrices[pick] ?? 0;
  }
  // El más caro lidera (comandante) — orden estable para el cliente.
  squad.sort((a, b) => (economy.zoidPrices[b] ?? 0) - (economy.zoidPrices[a] ?? 0));
  return squad;
}

export function contractOffers(
  contractsDone: number,
  economy: EconomyTable,
  enemyPool: string[],
  /** Sesgo de composición (adaptación de facción). Ausente = uniforme, igual que antes. */
  weightOf?: (id: string) => number,
  /** Multiplicador de FUERZA (curva de dificultad). Ausente = 1 (presupuesto base). */
  strength = 1,
): Contract[] {
  return TIERS.map((spec, tierIndex) => {
    const rand = mulberry32((contractsDone * 3 + tierIndex + 1) * 0x9e3779b1);
    const squad = fillSquad(enemyPool, economy, 4, spec.budget * strength, rand, weightOf);
    const name = spec.names[(contractsDone + tierIndex) % spec.names.length]!;
    return {
      id: `c${contractsDone}-${spec.tier}`,
      name,
      tier: spec.tier,
      enemySquad: squad,
      reward: spec.reward,
      salvagePerKill: spec.salvage,
    };
  });
}

// ── Resolución de una batalla de contrato ────────────────────────────────

export interface ContractOutcome {
  winner: 'player' | 'enemy' | undefined;
  /** HP final de cada hueco del roster que se desplegó (índice = hueco). */
  finalHp: Array<number | undefined>;
  /** Blindaje de refuerzo restante de cada hueco (se gasta en batalla). */
  finalArmor?: Array<number | undefined>;
  /** Continuidad: estado residual del reactor/arsenal de cada superviviente. */
  finalHeat?: Array<number | undefined>;
  finalEnergy?: Array<number | undefined>;
  finalAmmo?: Array<Record<string, number> | undefined>;
  enemiesDestroyed: number;
}

export interface ContractReport {
  creditsEarned: number;
  rewardPaid: boolean;
  salvage: number;
  lost: string[]; // unitTypeIds destruidos en la batalla
}

/** Aplica el resultado: daño persistente, bajas y pago. No muta. */
export function resolveContract(
  state: CampaignState,
  contract: Contract,
  outcome: ContractOutcome,
): { state: CampaignState; report: ContractReport } {
  const lost: string[] = [];
  const roster = state.roster.map((zoid, i) => {
    const hp = outcome.finalHp[i];
    if (hp === undefined) return zoid; // no se desplegó (ya destruido)
    if (hp <= 0) {
      lost.push(zoid.unitTypeId);
      return { ...zoid, hp: 0, destroyed: true };
    }
    // El blindaje de refuerzo gastado persiste: se repara en el taller.
    const armor = zoid.reinforced ? outcome.finalArmor?.[i] : undefined;
    const next: OwnedZoid = { ...zoid, hp };
    if (armor !== undefined) next.armor = armor;
    // Continuidad: el reactor sale como quedó (calor/energía residual, cargador
    // a medias). Se sobrescribe el residual viejo con el de ESTA batalla (o se
    // borra si esta máquina no lo tiene) para no arrastrar estado fantasma.
    next.residualHeat = outcome.finalHeat?.[i];
    next.residualEnergy = outcome.finalEnergy?.[i];
    next.ammo = outcome.finalAmmo?.[i];
    return next;
  });
  const rewardPaid = outcome.winner === 'player';
  const salvage = outcome.enemiesDestroyed * contract.salvagePerKill;
  const creditsEarned = (rewardPaid ? contract.reward : 0) + salvage;
  return {
    state: {
      ...state,
      roster,
      credits: state.credits + creditsEarned,
      contractsDone: state.contractsDone + 1,
    },
    report: { creditsEarned, rewardPaid, salvage, lost },
  };
}

/**
 * Refit de una jornada de descanso/taller: el reactor se enfría y el arsenal
 * se reabastece. Limpia el estado residual de continuidad (calor, energía,
 * munición) para que la máquina despliegue a estrenar la próxima vez. No toca
 * HP ni blindaje (tienen su propia reparación). Es lo que evita la "espiral de
 * la muerte": cualquier jornada de descanso deja el reactor fresco.
 */
export function refitZoid(zoid: OwnedZoid): OwnedZoid {
  if (zoid.residualHeat === undefined && zoid.residualEnergy === undefined && zoid.ammo === undefined) {
    return zoid; // ya está a estrenar: sin cambios
  }
  const { residualHeat: _h, residualEnergy: _e, ammo: _a, ...refit } = zoid;
  return refit;
}

// ── Taller y tienda (todo sin mutar; si no se puede pagar, sin cambios) ──

export function repairCost(zoid: OwnedZoid, maxHp: number, economy: EconomyTable): number {
  if (zoid.destroyed) return 0;
  return Math.max(0, Math.round((maxHp - Math.min(zoid.hp, maxHp)) * economy.repairCostPerHp));
}

export function repairZoid(
  state: CampaignState, slot: number, maxHp: number, economy: EconomyTable,
): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || zoid.destroyed) return state;
  const cost = repairCost(zoid, maxHp, economy);
  if (cost === 0 || state.credits < cost) return state;
  const roster = state.roster.map((z, i) => (i === slot ? { ...z, hp: maxHp } : z));
  return { ...state, roster, credits: state.credits - cost };
}

// ── Refuerzo de blindaje: aguante extra a cambio de velocidad ───────────

/** Tope de blindaje de refuerzo de una máquina (0 si no está reforzada). */
export function armorMax(zoid: OwnedZoid, economy: EconomyTable): number {
  return zoid.reinforced ? economy.reinforcement.armor : 0;
}

/**
 * Modificadores del refuerzo al desplegar: la máquina va más lenta (menos
 * movimiento y CT). Los aplica el cliente como spawnModifiers junto al
 * blindaje (UnitSpawn.armor). El aguante lo da el búnker, no estos números.
 */
export function reinforcementModifiers(economy: EconomyTable): StatModifier[] {
  const r = economy.reinforcement;
  return [
    { source: 'refuerzo:blindaje', stat: 'move', add: -r.movePenalty },
    { source: 'refuerzo:blindaje', stat: 'speed', add: -r.speedPenalty },
  ];
}

/**
 * Monta el refuerzo de blindaje en el taller: sale a tope de placas. Cuesta
 * créditos y, al desplegar, la máquina irá más lenta. Sin mutar si no se
 * puede (destruida, ya reforzada, o sin fondos).
 */
export function reinforceArmor(state: CampaignState, slot: number, economy: EconomyTable): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || zoid.destroyed || zoid.reinforced) return state;
  const cost = economy.reinforcement.fitCost;
  if (state.credits < cost) return state;
  const roster = state.roster.map((z, i) =>
    (i === slot ? { ...z, reinforced: true, armor: economy.reinforcement.armor } : z));
  return { ...state, roster, credits: state.credits - cost };
}

/** Desmonta el refuerzo (recupera velocidad; no reembolsa). */
export function stripReinforcement(state: CampaignState, slot: number): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || !zoid.reinforced) return state;
  const roster = state.roster.map((z, i) =>
    (i === slot ? { ...z, reinforced: false, armor: 0 } : z));
  return { ...state, roster };
}

/** Coste de reparar el blindaje de refuerzo gastado (0 si no hay refuerzo o está a tope). */
export function armorRepairCost(zoid: OwnedZoid, economy: EconomyTable): number {
  if (!zoid.reinforced) return 0;
  const max = economy.reinforcement.armor;
  const missing = max - Math.max(0, Math.min(zoid.armor ?? 0, max));
  return Math.max(0, Math.round(missing * economy.reinforcement.repairPerPoint));
}

/** Repara el blindaje de refuerzo a tope, si hay con qué pagar. */
export function repairArmor(state: CampaignState, slot: number, economy: EconomyTable): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || !zoid.reinforced) return state;
  const cost = armorRepairCost(zoid, economy);
  if (cost === 0 || state.credits < cost) return state;
  const roster = state.roster.map((z, i) =>
    (i === slot ? { ...z, armor: economy.reinforcement.armor } : z));
  return { ...state, roster, credits: state.credits - cost };
}

export function rebuildCost(zoid: OwnedZoid, economy: EconomyTable): number {
  return Math.round((economy.zoidPrices[zoid.unitTypeId] ?? 0) * economy.rebuildFactor);
}

export function rebuildZoid(
  state: CampaignState, slot: number, maxHp: number, economy: EconomyTable,
): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || !zoid.destroyed) return state;
  const cost = rebuildCost(zoid, economy);
  if (state.credits < cost) return state;
  const roster = state.roster.map((z, i) =>
    (i === slot ? updateZoidRecord({ ...z, hp: maxHp, destroyed: false }, { rebuilds: 1 }) : z));
  return { ...state, roster, credits: state.credits - cost };
}

/** Valor de retoma de un chasis al cambiarlo por otro. */
export function tradeInValue(zoid: OwnedZoid, maxHp: number, economy: EconomyTable): number {
  const price = economy.zoidPrices[zoid.unitTypeId] ?? 0;
  if (zoid.destroyed) return Math.round(price * 0.15);
  const condition = Math.max(0, Math.min(1, zoid.hp / maxHp));
  return Math.round(price * economy.sellFactor * condition);
}

/**
 * Compra un chasis nuevo para un hueco, entregando el actual como parte
 * de pago. Las armas montadas vuelven al arsenal (siguen en propiedad).
 */
export function buyZoid(
  state: CampaignState,
  slot: number,
  unitTypeId: string,
  currentMaxHp: number,
  economy: EconomyTable,
  factoryLoadout: (unitTypeId: string) => { weapons: string[]; slots: Record<string, string> },
): CampaignState {
  const current = state.roster[slot];
  const price = economy.zoidPrices[unitTypeId];
  if (!current || price === undefined) return state;
  const net = price - tradeInValue(current, currentMaxHp, economy);
  if (state.credits < net) return state;
  // El chasis nuevo sale de fábrica pero SIN armas de regalo: se montan
  // del arsenal propio (la fábrica solo pone el metal).
  const loadout = factoryLoadout(unitTypeId);
  const roster = state.roster.map((z, i) => (i === slot
    ? { unitTypeId, hp: FULL_HP, destroyed: false, weapons: [], slots: loadout.slots }
    : z));
  return { ...state, roster, credits: state.credits - net };
}

export function buyWeapon(state: CampaignState, weaponId: string, economy: EconomyTable): CampaignState {
  const price = economy.weaponPrices[weaponId];
  if (price === undefined || state.credits < price) return state;
  return {
    ...state,
    credits: state.credits - price,
    armory: { ...state.armory, [weaponId]: (state.armory[weaponId] ?? 0) + 1 },
  };
}

/** Unidades de un arma actualmente montadas en el roster. */
export function mountedCount(state: CampaignState, weaponId: string): number {
  return state.roster.reduce((n, z) => n + z.weapons.filter((w) => w === weaponId).length, 0);
}

/** Vende una unidad LIBRE (no montada) de un arma. */
export function sellWeapon(state: CampaignState, weaponId: string, economy: EconomyTable): CampaignState {
  const owned = state.armory[weaponId] ?? 0;
  const price = economy.weaponPrices[weaponId];
  if (price === undefined || owned <= mountedCount(state, weaponId) || owned === 0) return state;
  return {
    ...state,
    credits: state.credits + Math.round(price * economy.sellFactor),
    armory: { ...state.armory, [weaponId]: owned - 1 },
  };
}

/**
 * Cambia el montaje de armas de un hueco, validando propiedad: no se
 * puede montar más unidades de un arma de las que hay en el arsenal.
 */
export function setMountedWeapons(state: CampaignState, slot: number, weapons: string[]): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid) return state;
  const roster = state.roster.map((z, i) => (i === slot ? { ...z, weapons } : z));
  const candidate = { ...state, roster };
  for (const weaponId of new Set(weapons)) {
    if (mountedCount(candidate, weaponId) > (state.armory[weaponId] ?? 0)) return state;
  }
  return candidate;
}

// ── Expedición: suministros y bodega ─────────────────────────────────────

export function buySupplies(state: CampaignState, count: number, economy: EconomyTable, unitPrice?: number): CampaignState {
  const cost = count * (unitPrice ?? economy.supplyPrice);
  if (count <= 0 || state.credits < cost) return state;
  return { ...state, credits: state.credits - cost, supplies: state.supplies + count };
}

/**
 * Consume suministros de un tramo de viaje. Si no alcanzan, el déficit
 * vuelve como `shortage`: la marcha forzada castiga a las máquinas (el
 * cliente aplica el daño, que conoce los maxHp reales).
 */
export function consumeSupplies(state: CampaignState, amount: number): { state: CampaignState; shortage: number } {
  const available = Math.min(state.supplies, amount);
  return {
    state: { ...state, supplies: state.supplies - available },
    shortage: amount - available,
  };
}

export function stashCargo(state: CampaignState, item: { name: string; value: number }, capacity: number): CampaignState {
  if (state.cargo.length >= capacity) return state;
  return { ...state, cargo: [...state.cargo, item] };
}

/** Vender toda la bodega (la tasa depende de dónde: taller = 1). */
export function sellCargo(state: CampaignState, rate = 1): { state: CampaignState; earned: number } {
  const earned = Math.round(state.cargo.reduce((n, c) => n + c.value, 0) * rate);
  return { state: { ...state, credits: state.credits + earned, cargo: [] }, earned };
}

/**
 * Reparación en taller ajeno: coste/HP y tope propios, y el cliente
 * elige CUÁNTO gastar (fraction 0-1 de lo reparable hasta el tope).
 */
export function cityRepair(
  state: CampaignState,
  slot: number,
  maxHp: number,
  costPerHp: number,
  capRatio: number,
  fraction = 1,
): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || zoid.destroyed) return state;
  const cap = Math.round(maxHp * capRatio);
  const current = Math.min(zoid.hp, maxHp);
  const healable = Math.max(0, cap - current);
  const healed = Math.max(0, Math.round(healable * Math.max(0, Math.min(1, fraction))));
  const cost = Math.round(healed * costPerHp);
  if (healed <= 0 || state.credits < cost) return state;
  const roster = state.roster.map((z, i) => (i === slot ? { ...z, hp: current + healed } : z));
  return { ...state, roster, credits: state.credits - cost };
}

/**
 * Trabajo de taberna: el encargo NO oficial de una ciudad — un combate
 * local por dinero rápido. Determinista por (ciudad, ciclo); más pobre
 * que un contrato del gremio y sin chatarra garantizada.
 */
export function tavernJob(
  nodeId: string,
  cityLevel: number,
  cycle: number,
  economy: EconomyTable,
  enemyPool: string[],
  /** Sesgo de composición (adaptación de facción). Ausente = uniforme. */
  weightOf?: (id: string) => number,
  /** Multiplicador de fuerza (curva de dificultad). Ausente = 1. */
  strength = 1,
): Contract {
  const rand = mulberry32(hashStr(`${nodeId}|tab|${cycle}`));
  const budget = (2200 + cityLevel * 900) * strength;
  const squad = fillSquad(enemyPool, economy, 3, budget, rand, weightOf, 1.3);
  const names = ['Deuda de juego ajena', 'Espantar a los recaudadores', 'El silo en disputa', 'Un rival del tabernero'];
  return {
    id: `tav-${nodeId}-${cycle}`,
    name: names[cycle % names.length]!,
    tier: 'escolta',
    enemySquad: squad,
    reward: 350 + cityLevel * 120,
    salvagePerKill: 45,
  };
}

/** hash FNV local para semillas de texto. */
function hashStr(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Comprar el plano de un módulo (una sola vez; desbloquea montarlo). */
export function buyBlueprint(state: CampaignState, moduleId: string, price: number): CampaignState {
  if (state.moduleBlueprints.includes(moduleId) || state.credits < price) return state;
  return {
    ...state,
    credits: state.credits - price,
    moduleBlueprints: [...state.moduleBlueprints, moduleId],
  };
}
