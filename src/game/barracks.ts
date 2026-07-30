/**
 * El cuartel de pilotos: la compañía deja de ser cuatro sillas fijas.
 * Se recluta gente por cuatro vías — la TABERNA (baratos, sin verificar),
 * la AGENCIA estatal de colocación (caros, con expediente), los RESCATES
 * en ruta (gratis: te deben la vida, y a más riesgo mejor piloto) y los
 * ASPIRANTES que llaman a la puerta cuando la compañía suena.
 *
 * Capa pura y determinista, como mercenary.ts: sin motor, sin DOM. El
 * cliente decide dónde persiste el banquillo y quién tripula cada hueco.
 */
import { newPilot, TRACK_LEVEL_THRESHOLDS, type PilotState, type SpecializationId } from '../core/progression.js';

/** Techo de plantilla: sillas de máquina + banquillo. */
export const MAX_PILOTS = 8;

export type RecruitOrigin = 'taberna' | 'agencia' | 'rescate' | 'aspirante';

/** Calidad 0-3: cuánta guerra trae encima al firmar. */
export const QUALITY_LABELS = ['novato', 'curtido', 'veterano', 'as'] as const;

export interface RecruitOffer {
  /** Id del piloto si firma (prefijo rec-: nunca pisa a los fundadores). */
  id: string;
  name: string;
  origin: RecruitOrigin;
  /** 0 novato · 1 curtido · 2 veterano · 3 as. */
  quality: number;
  /** Inclinación de escuela con la que llega (los novatos aún no tienen). */
  spec?: SpecializationId;
  /** Prima de contratación en créditos (0 en rescates y aspirantes). */
  fee: number;
  /** Una línea de carácter para la carta. */
  blurb: string;
}

// PROVISIONAL: nombres y frases de primera pasada — la dirección repoblará
// con la biblia del universo (docs/LORE.md). Sin IP ajena.
const FIRST_NAMES = [
  'Sela', 'Bruno', 'Ivo', 'Renata', 'Tomás', 'Ada', 'Kaspar', 'Nuria',
  'Otto', 'Vera', 'Milo', 'Petra', 'Elias', 'Zaida', 'Roque', 'Lena',
  'Aldo', 'Mara', 'Ciro', 'Olga', 'Darío', 'Ines', 'Simón', 'Talia',
];
const CALLSIGNS = [
  'Chispa', 'Yunque', 'Niebla', 'Grava', 'Faro', 'Sierra', 'Brasa',
  'Cierzo', 'Remache', 'Salitre', 'Púa', 'Vendaval',
];
const BLURBS: Record<RecruitOrigin, string[]> = {
  taberna: [
    'Dice que pilotó en la última guerra. No dice de qué lado.',
    'Paga sus deudas con horas de cabina. Tiene muchas deudas.',
    'El tabernero responde por su puntería, no por su puntualidad.',
    'Aprendió a pilotar antes que a leer. Se le nota en ambas cosas.',
  ],
  agencia: [
    'Expediente sellado por el Estado: apto, leal, sin preguntas.',
    'Formación oficial completa. Certificado de lealtad en regla.',
    'Transferido de la milicia territorial. El papeleo llegó antes que él.',
    'La Oficina lo recomienda "sin reservas". Nadie recuerda su cara.',
  ],
  rescate: [
    'Te debe la máquina y el pellejo. Piensa pagarlo en batalla.',
    'Salió de la cabina por su propio pie y pidió alistarse.',
    'No tiene adónde volver: su columna quedó en el cráter.',
  ],
  aspirante: [
    'Apareció al alba con un petate y el casco bajo el brazo.',
    'Dice que la compañía suena en las tabernas. Quiere sonar con ella.',
    'Trae una carta de recomendación escrita a mano. Ilegible.',
  ],
};

/** mulberry32 local (misma razón que mercenary.ts: capa pura sin motor). */
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

const SPECS: SpecializationId[] = ['assault', 'sniper', 'support', 'defense'];

/** Prima base por calidad; el origen la modula. */
const FEE_BY_QUALITY = [150, 450, 950, 1700];

function makeOffer(key: string, origin: RecruitOrigin, quality: number, rand: () => number): RecruitOffer {
  const q = Math.max(0, Math.min(3, Math.round(quality)));
  const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
  const name = q >= 2
    ? `${first} «${CALLSIGNS[Math.floor(rand() * CALLSIGNS.length)]!}»`
    : first;
  const blurbs = BLURBS[origin];
  const spec = q >= 1 ? SPECS[Math.floor(rand() * SPECS.length)]! : undefined;
  // La agencia cobra el papeleo; rescates y aspirantes no cobran prima.
  const fee = origin === 'rescate' || origin === 'aspirante' ? 0
    : Math.round(FEE_BY_QUALITY[q]! * (origin === 'agencia' ? 1.6 : 1));
  return {
    id: `rec-${hashString(`${key}|${name}`).toString(36)}`,
    name,
    origin,
    quality: q,
    ...(spec ? { spec } : {}),
    fee,
    blurb: blurbs[Math.floor(rand() * blurbs.length)]!,
  };
}

/**
 * XP con la que firma cada calidad: por debajo del umbral del nivel
 * siguiente de TRACK_LEVEL_THRESHOLDS para que el recluta llegue hecho
 * pero le quede carrera. Un as trae nivel 3 en su escuela; un novato, nada.
 */
export function seedXp(quality: number): { basics: number; track: number } {
  switch (Math.max(0, Math.min(3, Math.round(quality)))) {
    case 1: return { basics: TRACK_LEVEL_THRESHOLDS[0]! + 20, track: TRACK_LEVEL_THRESHOLDS[0]! + 60 };
    case 2: return { basics: TRACK_LEVEL_THRESHOLDS[1]! + 40, track: TRACK_LEVEL_THRESHOLDS[1]! + 120 };
    case 3: return { basics: TRACK_LEVEL_THRESHOLDS[2]! + 50, track: TRACK_LEVEL_THRESHOLDS[2]! + 200 };
    default: return { basics: 0, track: 0 };
  }
}

/** Convierte una oferta firmada en un piloto de plantilla. */
export function recruitPilot(offer: RecruitOffer): PilotState {
  const pilot = newPilot(offer.id, offer.name);
  const xp = seedXp(offer.quality);
  pilot.basics = xp.basics;
  if (offer.spec) {
    pilot.tracks[offer.spec] = xp.track;
    // Llega con su escuela ELEGIDA: es su oficio, no una promesa.
    pilot.mainSpec = offer.spec;
  }
  return pilot;
}

/**
 * Ofertas de la TABERNA de una ciudad: gente sin verificar, barata y
 * determinista por (ciudad, ciclo). Las aldeas apenas tienen a nadie;
 * la capital siempre tiene a alguien con horas de cabina.
 */
export function tavernRecruits(nodeId: string, cityLevel: number, cycle: number): RecruitOffer[] {
  const rand = mulberry32(hashString(`recl|tab|${nodeId}|${cycle}`));
  const count = cityLevel <= 1 ? (rand() < 0.5 ? 1 : 0) : rand() < 0.55 ? 2 : 1;
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < count; i++) {
    // Mayormente novatos y curtidos; en la capital asoma algún veterano.
    const roll = rand();
    const quality = roll < 0.5 ? 0 : roll < 0.85 || cityLevel < 3 ? 1 : 2;
    offers.push(makeOffer(`tab|${nodeId}|${cycle}|${i}`, 'taberna', quality, rand));
  }
  return offers;
}

/**
 * Ofertas de la AGENCIA estatal de colocación (ciudades nivel 2+): pilotos
 * con expediente — caros, formados, y con la sensación de que el Estado
 * sabe exactamente dónde están en todo momento. La capital coloca ases.
 */
export function agencyRecruits(nodeId: string, cityLevel: number, cycle: number): RecruitOffer[] {
  if (cityLevel < 2) return [];
  const rand = mulberry32(hashString(`recl|agc|${nodeId}|${cycle}`));
  const count = cityLevel >= 3 ? 2 : 1;
  const offers: RecruitOffer[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rand();
    const quality = cityLevel >= 3
      ? (roll < 0.45 ? 2 : roll < 0.85 ? 1 : 3)
      : (roll < 0.6 ? 1 : 2);
    offers.push(makeOffer(`agc|${nodeId}|${cycle}|${i}`, 'agencia', quality, rand));
  }
  return offers;
}

/**
 * ASPIRANTE espontáneo: tras cerrar contratos, a veces alguien llama a la
 * puerta del cuartel. Determinista por ciclo; la fama (contratos hechos)
 * sube la probabilidad y, con ella, la calidad de quien se molesta en venir.
 */
export function walkInApplicant(contractsDone: number): RecruitOffer | null {
  const rand = mulberry32(hashString(`recl|asp|${contractsDone}`));
  const chance = Math.min(0.5, 0.12 + contractsDone * 0.02);
  if (rand() >= chance) return null;
  const quality = contractsDone >= 10 && rand() < 0.35 ? 1 : 0;
  return makeOffer(`asp|${contractsDone}`, 'aspirante', quality, rand);
}

/**
 * Piloto RESCATADO en un evento de ruta: firma gratis (te debe la vida) y
 * su calidad es EXACTAMENTE el riesgo que corriste — tier 1 (chusma) trae
 * un curtido, tier 2 (combate duro) un veterano, tier 3 (muy duro) un as.
 */
export function rescuePilot(key: string, tier: 1 | 2 | 3): RecruitOffer {
  const rand = mulberry32(hashString(`recl|res|${key}`));
  return makeOffer(`res|${key}`, 'rescate', tier, rand);
}

/**
 * La oposición de cada rescate: a quién hay que quitarle al piloto.
 * PROVISIONAL: chusma → escuadra media → veteranos con colmillos. El
 * aiSkill acompaña (el riesgo anunciado es riesgo real).
 */
export const RESCUE_TIERS: Record<1 | 2 | 3, {
  pool: string[]; count: number; aiSkill: number; label: string;
}> = {
  1: { pool: ['molga', 'guysak', 'rev-raptor'], count: 3, aiSkill: 0.3, label: 'chusma de bandidos' },
  2: { pool: ['command-wolf', 'rev-raptor', 'gun-sniper', 'guysak'], count: 3, aiSkill: 0.55, label: 'partida de guerra' },
  3: { pool: ['zaber-fang', 'command-wolf', 'gun-sniper-naomi', 'redler'], count: 4, aiSkill: 0.8, label: 'veteranos a sueldo' },
};

/** Escuadra concreta de un rescate, determinista por clave. */
export function rescueOpposition(key: string, tier: 1 | 2 | 3): { squad: string[]; aiSkill: number } {
  const spec = RESCUE_TIERS[tier];
  const rand = mulberry32(hashString(`recl|resq|${key}`));
  const squad = Array.from({ length: spec.count },
    () => spec.pool[Math.floor(rand() * spec.pool.length)]!);
  return { squad, aiSkill: spec.aiSkill };
}

/** Recompensa si el rescatado no cabe en plantilla: su gremio salda la deuda. */
export function rescueBounty(tier: 1 | 2 | 3): number {
  return tier * 350;
}
