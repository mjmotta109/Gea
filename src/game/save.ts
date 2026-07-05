/**
 * Sistema de guardado: la partida completa como un único documento
 * versionado, serializable a archivo (mentalidad de juego de PC: las
 * ranuras del navegador son cómodas, el archivo exportado es TUYO —
 * sobrevive a limpiezas del navegador y viaja entre máquinas).
 *
 * Lógica pura: crear, validar, migrar y resumir partidas. Dónde se
 * guardan (localStorage, disco, nube) es cosa del cliente.
 */
import type { PilotState } from '../core/progression.js';
import type { ExpeditionState } from './expedition.js';
import type { CampaignState } from './mercenary.js';

/** Versión del formato; las migraciones viven en validateSave. */
export const SAVE_VERSION = 1;

export interface SaveGame {
  version: number;
  /** Momento del guardado (ISO 8601). */
  savedAt: string;
  /** Nombre libre de la partida (el jugador puede renombrar). */
  name: string;
  pilots: Record<string, PilotState>;
  campaign: CampaignState | null;
  expedition: ExpeditionState | null;
  /**
   * Secciones del cliente (garaje, mapas del editor, selección de mapa):
   * la capa de guardado las transporta sin interpretarlas; el cliente
   * las valida al aplicarlas, igual que hace con su localStorage.
   */
  client: Record<string, unknown>;
}

export interface SavePayload {
  name: string;
  pilots: Record<string, PilotState>;
  campaign: CampaignState | null;
  expedition: ExpeditionState | null;
  client: Record<string, unknown>;
}

export function createSave(payload: SavePayload, now: Date = new Date()): SaveGame {
  return {
    version: SAVE_VERSION,
    savedAt: now.toISOString(),
    name: payload.name,
    pilots: payload.pilots,
    campaign: payload.campaign,
    expedition: payload.expedition,
    client: payload.client,
  };
}

export function serializeSave(save: SaveGame): string {
  return JSON.stringify(save, null, 2);
}

/**
 * Valida (y migra, cuando haya versiones viejas) un guardado crudo.
 * Devuelve null si no es una partida de Gea reconocible — nunca lanza.
 */
export function validateSave(raw: unknown): SaveGame | null {
  try {
    const save = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<SaveGame>;
    if (!save || typeof save !== 'object') return null;
    if (typeof save.version !== 'number' || save.version < 1 || save.version > SAVE_VERSION) return null;
    if (typeof save.savedAt !== 'string' || Number.isNaN(Date.parse(save.savedAt))) return null;
    if (!save.pilots || typeof save.pilots !== 'object') return null;
    // Migraciones futuras: if (save.version === 1) { ... save.version = 2; }
    return {
      version: SAVE_VERSION,
      savedAt: save.savedAt,
      name: typeof save.name === 'string' && save.name.trim() ? save.name : 'Partida',
      pilots: save.pilots as Record<string, PilotState>,
      campaign: (save.campaign ?? null) as CampaignState | null,
      expedition: (save.expedition ?? null) as ExpeditionState | null,
      client: (save.client && typeof save.client === 'object' ? save.client : {}) as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export interface SaveSummary {
  name: string;
  savedAt: string;
  credits?: number;
  contractsDone?: number;
  /** Día de la expedición en curso, si la hay. */
  expeditionDay?: number;
  pilotNames: string[];
  /** Suma de niveles de pista de todos los pilotos (progreso a ojo). */
  totalPilotLevels: number;
}

/** Resumen legible para la lista de ranuras (sin cargar la partida). */
export function describeSave(save: SaveGame, trackLevel: (xp: number) => number): SaveSummary {
  const pilots = Object.values(save.pilots ?? {});
  return {
    name: save.name,
    savedAt: save.savedAt,
    credits: save.campaign?.credits,
    contractsDone: save.campaign?.contractsDone,
    expeditionDay: save.expedition?.day,
    pilotNames: pilots.map((p) => p.name),
    totalPilotLevels: pilots.reduce(
      (n, p) => n + Object.values(p.tracks ?? {}).reduce((m, xp) => m + trackLevel(xp), 0), 0),
  };
}
