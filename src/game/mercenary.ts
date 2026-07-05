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
export interface OwnedZoid {
  unitTypeId: string;
  /** HP actual; el maxHp lo calcula el motor según el montaje. */
  hp: number;
  destroyed: boolean;
  weapons: string[];
  slots: Record<string, string>;
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
  tier: 'escolta' | 'asalto' | 'caza';
  /** unitTypeIds del equipo enemigo (4). */
  enemySquad: string[];
  reward: number;
  salvagePerKill: number;
}

// ── Estado inicial ───────────────────────────────────────────────────────

export function newCampaign(
  economy: EconomyTable,
  factoryLoadout: (unitTypeId: string) => { weapons: string[]; slots: Record<string, string> },
): CampaignState {
  const armory: Record<string, number> = {};
  const roster = economy.starterRoster.map((unitTypeId) => {
    const loadout = factoryLoadout(unitTypeId);
    for (const weaponId of loadout.weapons) {
      armory[weaponId] = (armory[weaponId] ?? 0) + 1;
    }
    return { unitTypeId, hp: FULL_HP, destroyed: false, ...loadout };
  });
  return { credits: economy.startingCredits, roster, armory, contractsDone: 0, supplies: economy.startingSupplies, cargo: [], moduleBlueprints: [] };
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
];

/**
 * Las tres ofertas de contrato del ciclo actual. Deterministas: mismas
 * ofertas para el mismo (contractsDone, seed de campaña implícita).
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
    (i === slot ? { ...z, hp: maxHp, destroyed: false } : z));
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

/** Reparación en taller ajeno: coste/HP y tope de reparación propios. */
export function cityRepair(
  state: CampaignState,
  slot: number,
  maxHp: number,
  costPerHp: number,
  capRatio: number,
): CampaignState {
  const zoid = state.roster[slot];
  if (!zoid || zoid.destroyed) return state;
  const cap = Math.round(maxHp * capRatio);
  const target = Math.max(Math.min(zoid.hp, maxHp), cap);
  const healed = target - Math.min(zoid.hp, maxHp);
  const cost = Math.round(healed * costPerHp);
  if (healed <= 0 || state.credits < cost) return state;
  const roster = state.roster.map((z, i) => (i === slot ? { ...z, hp: target } : z));
  return { ...state, roster, credits: state.credits - cost };
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
