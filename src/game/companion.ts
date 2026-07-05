/**
 * La compañera: la máquina del hueco 1 de la campaña. No gana
 * experiencia — ACUMULA HISTORIA, con techo (GAME-DESIGN §1.2):
 *
 *  - MARCAS: rasgos permanentes grabados por eventos vividos (batallas
 *    en tormenta, apagados sobrevividos, comandantes cazados...). Techo
 *    de espacios de núcleo; llena, la máquina ya es quien es.
 *  - COMPENETRACIÓN: expediciones completadas juntos, con techo; da
 *    bonos pequeños de manejo por tramos.
 *  - Cambiar de chasis borra la biografía: la nueva llega verde.
 *
 * Lógica pura y determinista, como el resto de src/game.
 */
import type { StatModifier } from '../core/types.js';
import type { BattleEvent } from '../core/types.js';

export interface CompanionState {
  /** Marcas grabadas (ids de la tabla), en orden de adquisición. */
  markIds: string[];
  /** Memoria de la máquina: contadores de lo vivido. */
  memory: Record<string, number>;
  /** Expediciones completadas juntos (compenetración). */
  rapport: number;
}

export function newCompanion(): CompanionState {
  return { markIds: [], memory: {}, rapport: 0 };
}

export interface MarkDefinition {
  id: string;
  name: string;
  description: string;
  counter: string;
  threshold: number;
  modifiers: StatModifier[];
}

export interface CompanionTable {
  marks: Record<string, MarkDefinition>;
  /** Espacios de núcleo: marcas máximas (llena = ya es quien es). */
  markCap: number;
  /** Bonos de compenetración por tramos (aplica el más alto). */
  rapportTiers: Array<{ min: number; label: string; modifiers: StatModifier[] }>;
  /** Techo de compenetración. */
  rapportCap: number;
}

export interface CompanionObservation {
  events: BattleEvent[];
  /** Unidad que fue la compañera en esta batalla. */
  unitId: string;
  finalHpRatio: number;
  /** Clima de la batalla (las tormentas forjan). */
  weather: string;
}

/**
 * Registra la batalla en la memoria de la máquina y graba las marcas
 * cuyos umbrales se crucen. Contadores: batallas, tormentas (combatir
 * bajo lluvia/arena), apagados, bajas, cazas (comandantes derribados
 * por ella), roces (sobrevivir ≤20%).
 */
export function observeCompanionBattle(
  companion: CompanionState,
  observation: CompanionObservation,
  table: CompanionTable,
): { companion: CompanionState; gained: MarkDefinition[] } {
  const memory = { ...companion.memory };
  const add = (counter: string, amount: number): void => {
    if (amount > 0) memory[counter] = (memory[counter] ?? 0) + amount;
  };

  add('batallas', 1);
  if (observation.weather !== 'clear') add('tormentas', 1);
  let lastAttacker: string | undefined;
  let lastDestroyed: string | undefined;
  for (const event of observation.events) {
    switch (event.type) {
      case 'ability-used':
      case 'damage-dealt':
        lastAttacker = event.unitId;
        break;
      case 'unit-shutdown':
        if (event.unitId === observation.unitId) add('apagados', 1);
        break;
      case 'unit-destroyed':
        lastDestroyed = event.unitId;
        if (lastAttacker === observation.unitId && event.unitId !== observation.unitId) add('bajas', 1);
        break;
      case 'command-link-lost':
        // El evento sigue a la caída del comandante: si la última baja
        // fue obra de la compañera, es una cabeza de manada.
        if (lastAttacker === observation.unitId && lastDestroyed !== observation.unitId) add('cazas', 1);
        break;
      default:
        break;
    }
  }
  if (observation.finalHpRatio > 0 && observation.finalHpRatio <= 0.2) add('roces', 1);

  const markIds = [...companion.markIds];
  const gained: MarkDefinition[] = [];
  for (const mark of Object.values(table.marks).sort((a, b) => a.id.localeCompare(b.id))) {
    if (markIds.length >= table.markCap) break;
    if (markIds.includes(mark.id)) continue;
    if ((memory[mark.counter] ?? 0) >= mark.threshold) {
      markIds.push(mark.id);
      gained.push(mark);
    }
  }

  return { companion: { ...companion, memory, markIds }, gained };
}

/** Marca un evento de campaña fuera de batalla (p. ej. reconstrucción). */
export function recordCompanionEvent(
  companion: CompanionState,
  counter: string,
  table: CompanionTable,
): { companion: CompanionState; gained: MarkDefinition[] } {
  const memory = { ...companion.memory, [counter]: (companion.memory[counter] ?? 0) + 1 };
  const markIds = [...companion.markIds];
  const gained: MarkDefinition[] = [];
  for (const mark of Object.values(table.marks).sort((a, b) => a.id.localeCompare(b.id))) {
    if (markIds.length >= table.markCap) break;
    if (markIds.includes(mark.id)) continue;
    if ((memory[mark.counter] ?? 0) >= mark.threshold) {
      markIds.push(mark.id);
      gained.push(mark);
    }
  }
  return { companion: { ...companion, memory, markIds }, gained };
}

/** Una expedición completada juntos (acotada al techo). */
export function bondExpedition(companion: CompanionState, table: CompanionTable): CompanionState {
  return { ...companion, rapport: Math.min(table.rapportCap, companion.rapport + 1) };
}

/** Modificadores que la biografía aporta al desplegar la compañera. */
export function companionModifiers(companion: CompanionState, table: CompanionTable): StatModifier[] {
  const mods: StatModifier[] = [];
  for (const markId of companion.markIds) {
    const mark = table.marks[markId];
    if (mark) mods.push(...mark.modifiers);
  }
  const tier = [...table.rapportTiers].sort((a, b) => b.min - a.min)
    .find((t) => companion.rapport >= t.min);
  if (tier) mods.push(...tier.modifiers);
  return mods;
}
