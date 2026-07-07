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
import { newCompanion, type CompanionState } from './companion.js';

export interface EconomyTable {
  startingCredits: number;
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
  /**
   * Núcleo de la máquina: TODO Zoid está vivo — también los que no son
   * la compañera graban marcas y estrechan compenetración (con los
   * techos más bajos de CORE_TABLE). Ausente = núcleo verde.
   */
  core?: CompanionState;
}

/** Núcleo con valores verdes para guardados viejos (sin migración). */
export function zoidCore(zoid: OwnedZoid): CompanionState {
  return zoid.core ?? newCompanion();
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
export function contractOffers(
  contractsDone: number,
  economy: EconomyTable,
  enemyPool: string[],
): Contract[] {
  return TIERS.map((spec, tierIndex) => {
    const rand = mulberry32((contractsDone * 3 + tierIndex + 1) * 0x9e3779b1);
    const squad: string[] = [];
    let remaining = spec.budget;
    for (let i = 0; i < 4; i++) {
      // Candidatos que caben en lo que queda de presupuesto (repartido
      // entre los huecos que faltan); si ninguno cabe, chatarra barata.
      const slotBudget = remaining / (4 - i);
      const affordable = enemyPool.filter((id) => (economy.zoidPrices[id] ?? 0) <= slotBudget * 1.35);
      const pick = affordable.length > 0
        ? affordable[Math.floor(rand() * affordable.length)]!
        : enemyPool.reduce((a, b) => (economy.zoidPrices[a] ?? 0) <= (economy.zoidPrices[b] ?? 0) ? a : b);
      squad.push(pick);
      remaining -= economy.zoidPrices[pick] ?? 0;
    }
    // El más caro lidera (comandante) — orden estable para el cliente.
    squad.sort((a, b) => (economy.zoidPrices[b] ?? 0) - (economy.zoidPrices[a] ?? 0));
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
    return { ...zoid, hp };
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
): Contract {
  const rand = mulberry32(hashStr(`${nodeId}|tab|${cycle}`));
  const budget = 2200 + cityLevel * 900;
  const squad: string[] = [];
  let remaining = budget;
  for (let i = 0; i < 3; i++) {
    const slotBudget = remaining / (3 - i);
    const affordable = enemyPool.filter((id) => (economy.zoidPrices[id] ?? 0) <= slotBudget * 1.3);
    const pick = affordable.length > 0
      ? affordable[Math.floor(rand() * affordable.length)]!
      : enemyPool.reduce((a, b) => ((economy.zoidPrices[a] ?? 0) <= (economy.zoidPrices[b] ?? 0) ? a : b));
    squad.push(pick);
    remaining -= economy.zoidPrices[pick] ?? 0;
  }
  squad.sort((a, b) => (economy.zoidPrices[b] ?? 0) - (economy.zoidPrices[a] ?? 0));
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
