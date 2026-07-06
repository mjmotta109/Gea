/*
 * Destacamentos: la compañía delega encargos en un piloto que se va
 * con su máquina y vuelve con experiencia, paga y una historia.
 *
 * Reglas de diseño:
 * - El tiempo del encargo son JORNADAS de expedición: solo avanza
 *   mientras la compañía vive (viaja, explora, descansa).
 * - El GRADO de éxito escala con los niveles del piloto: mandar
 *   novatos es barato pero arriesgado; rotar veteranos, rentable.
 * - Las LLAMADAS A BASE pausan el encargo hasta que se decide:
 *   seguir o volver, con las consecuencias anunciadas.
 * - Determinista por clave: sin dados escondidos.
 */

import type { AssignmentCall, AssignmentSpec } from '../data/assignments.js';

export interface ActiveAssignment {
  specId: string;
  /** Hueco del roster destacado (piloto + máquina fuera de servicio). */
  slot: number;
  /** Clave que siembra los rolls (grabada: recargar no cambia nada). */
  key: string;
  /** Jornadas avanzadas (no cuenta las pausas por llamada). */
  daysDone: number;
  /** Jornadas totales (las llamadas pueden alargar o acortar). */
  totalDays: number;
  /** Índice de la próxima llamada pendiente de sonar. */
  nextCall: number;
  /** Llamada esperando decisión en el cuartel (pausa el avance). */
  pendingCall?: AssignmentCall;
  /** Ajustes acumulados por decisiones. */
  scoreDelta: number;
  rewardMult: number;
  log: string[];
}

export type AssignmentGrade = 'brillante' | 'cumplido' | 'apurado' | 'fracaso';

export interface AssignmentReport {
  grade: AssignmentGrade;
  credits: number;
  /** XP por pista para el piloto destacado. */
  xp: Partial<Record<'assault' | 'sniper' | 'support' | 'defense', number>>;
  reputation: Array<{ factionId: string; delta: number }>;
  stressDelta: number;
  /** Jornadas de baja si volvió tocado (solo en fracaso). */
  injuryDays: number;
  line: string;
}

function hashString(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function startAssignment(spec: AssignmentSpec, slot: number, key: string): ActiveAssignment {
  return {
    specId: spec.id,
    slot,
    key,
    daysDone: 0,
    totalDays: spec.days,
    nextCall: 0,
    scoreDelta: 0,
    rewardMult: 1,
    log: [`El destacamento parte: ${spec.name}.`],
  };
}

/**
 * Avanza el encargo `days` jornadas. Si alcanza un punto de control,
 * se detiene ahí y deja la llamada sonando (pendingCall): el resto de
 * jornadas se pierden — el mundo no espera, pero el destacamento sí.
 */
export function advanceAssignment(
  assignment: ActiveAssignment,
  spec: AssignmentSpec,
  days: number,
): ActiveAssignment {
  if (assignment.pendingCall || days <= 0) return assignment;
  let daysDone = assignment.daysDone;
  let remaining = days;
  while (remaining > 0 && daysDone < assignment.totalDays) {
    daysDone++;
    remaining--;
    const call = spec.calls[assignment.nextCall];
    if (call && daysDone >= Math.max(1, Math.round(call.at * assignment.totalDays)) && daysDone < assignment.totalDays) {
      return {
        ...assignment,
        daysDone,
        pendingCall: call,
        log: [...assignment.log, `Día ${daysDone} — 📞 Llamada a base: esperando órdenes.`],
      };
    }
  }
  return { ...assignment, daysDone };
}

/** Resuelve una llamada con la opción elegida y reanuda la marcha. */
export function resolveAssignmentCall(
  assignment: ActiveAssignment,
  optionId: string,
): ActiveAssignment {
  const call = assignment.pendingCall;
  if (!call) return assignment;
  const option = call.options.find((o) => o.id === optionId) ?? call.options[0]!;
  // Acortar puede significar llegar HOY: nunca menos que lo ya andado.
  const totalDays = Math.max(assignment.daysDone, assignment.totalDays + option.extraDays);
  const { pendingCall: _drop, ...rest } = assignment;
  void _drop;
  return {
    ...rest,
    totalDays,
    nextCall: assignment.nextCall + 1,
    scoreDelta: assignment.scoreDelta + option.scoreDelta,
    rewardMult: assignment.rewardMult * option.rewardMult,
    log: [...assignment.log, `Órdenes dadas: ${option.label}.`],
  };
}

export function assignmentDone(assignment: ActiveAssignment): boolean {
  return !assignment.pendingCall && assignment.daysDone >= assignment.totalDays;
}

/**
 * Liquida el encargo terminado. `pilotLevels` = suma de niveles de
 * pista del piloto destacado: la experiencia SIEMPRE mejora el grado.
 */
export function finishAssignment(
  assignment: ActiveAssignment,
  spec: AssignmentSpec,
  pilotLevels: number,
): AssignmentReport {
  const roll = (hashString(`${assignment.key}|final`) % 41) - 20; // ±20, determinista
  const score = 55 - spec.difficulty + pilotLevels * 7 + assignment.scoreDelta + roll;
  const grade: AssignmentGrade =
    score >= 60 ? 'brillante' : score >= 35 ? 'cumplido' : score >= 15 ? 'apurado' : 'fracaso';
  const payFactor = grade === 'brillante' ? 1.3 : grade === 'cumplido' ? 1 : grade === 'apurado' ? 0.6 : 0;
  const xpFactor = grade === 'brillante' ? 1.25 : grade === 'fracaso' ? 0.5 : 1;
  const xp: AssignmentReport['xp'] = {};
  for (const [track, amount] of Object.entries(spec.xp)) {
    xp[track as keyof AssignmentReport['xp']] = Math.round(amount * xpFactor);
  }
  const credits = Math.round(spec.reward * assignment.rewardMult * payFactor);
  const gradeText = {
    brillante: 'impecable: hasta el Gremio pregunta quién fue',
    cumplido: 'cumplido sin más historias',
    apurado: 'a trompicones, pero de vuelta',
    fracaso: 'salió mal: vuelve con las manos vacías y un susto en el cuerpo',
  }[grade];
  return {
    grade,
    credits,
    xp,
    reputation: grade === 'fracaso' ? [] : (spec.reputation ?? []),
    stressDelta: grade === 'fracaso' ? 15 : grade === 'apurado' ? 8 : grade === 'brillante' ? -4 : 0,
    injuryDays: grade === 'fracaso' ? 2 : 0,
    line: `📡 ${spec.name}: ${gradeText}${credits > 0 ? ` (+⌾${credits})` : ''}.`,
  };
}
