/**
 * Taller de contenido: el editor del director. Personajes (pilotos),
 * habilidades propias y contratos de campaña creados a mano, guardados
 * aparte del contenido de fábrica y SUPERPUESTOS a los catálogos al
 * arrancar. Es lógica pura (validación y fábricas): el cliente pinta el
 * editor y persiste donde quiera; el motor nunca sabe qué contenido es
 * de fábrica y cuál del taller — le llega todo por el mismo catálogo.
 */
import type { AbilityDefinition, AbilityEffect, StatusId, TargetShape, DamageType } from '../core/types.js';
import type { Contract } from './mercenary.js';

/** Contenido del taller: habilidades propias (id tx-*), a quién se
 *  otorgan al desplegar, y contratos propios (id txc-*). */
export interface TallerState {
  abilities: Record<string, AbilityDefinition>;
  /** abilityId → huecos de piloto (0-3) que la llevan al desplegar. */
  grants: Record<string, number[]>;
  contracts: Contract[];
}

export function emptyTaller(): TallerState {
  return { abilities: {}, grants: {}, contracts: [] };
}

const SHAPES: TargetShape[] = ['single', 'cross', 'line'];
const DAMAGE_TYPES: DamageType[] = ['physical', 'energy'];
const STATUSES: StatusId[] = ['overheat', 'armor-up', 'evasion-up', 'stunned', 'suprimido'];
const CONTRACT_TIERS: Contract['tier'][] = ['escolta', 'asalto', 'caza', 'incursion', 'defensa'];

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
}

function cleanText(raw: unknown, fallback: string, maxLen: number): string {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, maxLen) : fallback;
}

/** Valida un efecto suelto; devuelve undefined si no se puede rescatar. */
function sanitizeEffect(raw: unknown): AbilityEffect | undefined {
  const e = raw as Partial<AbilityEffect> & { kind?: string };
  switch (e?.kind) {
    case 'damage': {
      const damageType = DAMAGE_TYPES.includes((e as { damageType?: DamageType }).damageType!)
        ? (e as { damageType: DamageType }).damageType : 'physical';
      return { kind: 'damage', power: clamp((e as { power?: number }).power, 1, 200, 20), damageType };
    }
    case 'heal':
      return { kind: 'heal', power: clamp((e as { power?: number }).power, 1, 200, 25) };
    case 'status': {
      const status = STATUSES.includes((e as { status?: StatusId }).status!)
        ? (e as { status: StatusId }).status : undefined;
      if (!status) return undefined;
      return {
        kind: 'status', status,
        duration: clamp((e as { duration?: number }).duration, 1, 9, 2),
        chance: clamp((e as { chance?: number }).chance, 5, 100, 100),
      };
    }
    case 'heat':
      return { kind: 'heat', amount: clamp((e as { amount?: number }).amount, 1, 60, 15) };
    default:
      return undefined;
  }
}

/**
 * Valida una habilidad del taller contra los límites del motor. Fuerza el
 * prefijo tx- (el taller nunca pisa contenido de fábrica) y garantiza al
 * menos un efecto (una habilidad sin efectos no existe).
 */
export function sanitizeAbility(raw: unknown, fallbackId: string): AbilityDefinition {
  const a = (raw ?? {}) as Partial<AbilityDefinition>;
  const id = typeof a.id === 'string' && /^tx-[a-z0-9-]{1,24}$/.test(a.id) ? a.id : fallbackId;
  const effects = (Array.isArray(a.effects) ? a.effects : [])
    .map(sanitizeEffect)
    .filter((e): e is AbilityEffect => e !== undefined)
    .slice(0, 3);
  if (effects.length === 0) effects.push({ kind: 'damage', power: 20, damageType: 'physical' });
  const range = clamp(a.range, 1, 12, 3);
  return {
    id,
    name: cleanText(a.name, 'Prototipo del taller', 28),
    description: cleanText(a.description, 'Salida del taller de la compañía.', 120),
    range,
    minRange: clamp(a.minRange, 0, range, 0),
    shape: SHAPES.includes(a.shape!) ? a.shape! : 'single',
    aoeRadius: clamp(a.aoeRadius, 0, 3, 0),
    accuracy: clamp(a.accuracy, 10, 100, 80),
    targetsAllies: a.targetsAllies === true,
    ...(clamp(a.usesPerBattle, 0, 9, 0) > 0 ? { usesPerBattle: clamp(a.usesPerBattle, 1, 9, 1) } : {}),
    effects,
    ...(clamp(a.ignites, 0, 4, 0) > 0 ? { ignites: clamp(a.ignites, 1, 4, 1) } : {}),
    ...(clamp(a.ctCost, 0, 100, 0) > 0 ? { ctCost: clamp(a.ctCost, 10, 100, 40) } : {}),
  };
}

/** Valida un contrato del taller: tier legal, escuadra de chasis EXISTENTES
 *  (1-4; lo desconocido se descarta) y números con suelo. */
export function sanitizeContract(
  raw: unknown, fallbackId: string, knownUnits: ReadonlySet<string>,
): Contract | undefined {
  const c = (raw ?? {}) as Partial<Contract>;
  const enemySquad = (Array.isArray(c.enemySquad) ? c.enemySquad : [])
    .filter((u): u is string => typeof u === 'string' && knownUnits.has(u))
    .slice(0, 4);
  if (enemySquad.length === 0) return undefined;
  return {
    id: typeof c.id === 'string' && /^txc-[a-z0-9-]{1,24}$/.test(c.id) ? c.id : fallbackId,
    name: cleanText(c.name, 'Encargo del taller', 36),
    tier: CONTRACT_TIERS.includes(c.tier!) ? c.tier! : 'caza',
    enemySquad,
    reward: clamp(c.reward, 50, 20000, 900),
    salvagePerKill: clamp(c.salvagePerKill, 0, 500, 50),
  };
}

/** Valida el taller completo (guardado o importado): lo irrescatable se
 *  descarta en silencio, lo demás queda dentro de límites. */
export function sanitizeTaller(raw: unknown, knownUnits: ReadonlySet<string>): TallerState {
  const t = (raw ?? {}) as Partial<TallerState>;
  const out = emptyTaller();
  let n = 0;
  for (const value of Object.values(t.abilities ?? {})) {
    const ability = sanitizeAbility(value, `tx-${++n}`);
    out.abilities[ability.id] = ability;
  }
  for (const [abilityId, slots] of Object.entries(t.grants ?? {})) {
    if (!out.abilities[abilityId] || !Array.isArray(slots)) continue;
    const clean = [...new Set(slots.filter((s) => Number.isInteger(s) && s >= 0 && s <= 3))];
    if (clean.length > 0) out.grants[abilityId] = clean.sort((a, b) => a - b);
  }
  let m = 0;
  for (const value of t.contracts ?? []) {
    const contract = sanitizeContract(value, `txc-${++m}`, knownUnits);
    if (contract) out.contracts.push(contract);
  }
  return out;
}

/** Ids de habilidad del taller otorgadas al hueco de piloto dado. */
export function tallerGrantIds(taller: TallerState, slot: number): string[] {
  return Object.entries(taller.grants)
    .filter(([id, slots]) => taller.abilities[id] && slots.includes(slot))
    .map(([id]) => id);
}

/** Id libre para una habilidad nueva (tx-1, tx-2, ...). */
export function nextAbilityId(taller: TallerState): string {
  for (let i = 1; ; i++) {
    if (!taller.abilities[`tx-${i}`]) return `tx-${i}`;
  }
}

/** Id libre para un contrato nuevo (txc-1, txc-2, ...). */
export function nextContractId(taller: TallerState): string {
  for (let i = 1; ; i++) {
    if (!taller.contracts.some((c) => c.id === `txc-${i}`)) return `txc-${i}`;
  }
}
