/**
 * Los hitos del territorio: qué ES cada elemento del camino y qué pasa
 * al visitarlo. Duermen bajo la niebla del overworld (src/game/
 * overworld.ts los siembra); aquí viven su carta de presentación, sus
 * opciones (con la consecuencia ANUNCIADA en el botón, como manda la
 * casa) y su resolución — decisiones que mueven facciones o combates.
 *
 * Capa pura y determinista: sin motor, sin DOM. Textos PROVISIONALES
 * (la dirección repoblará con la biblia de docs/LORE.md).
 */
import type { CargoItem } from './expedition.js';
import type { Landmark, LandmarkKind } from './overworld.js';

export interface LandmarkOption {
  id: string;
  label: string;
  /** Consecuencia anunciada: se decide informado, sin letra pequeña. */
  detail: string;
}

export interface LandmarkSpec {
  kind: LandmarkKind;
  icon: string;
  name: string;
  prompt: string;
  options: LandmarkOption[];
}

export interface LandmarkOutcome {
  /** Horas que consume la opción (el reloj no espera). */
  hours: number;
  supplyDelta: number;
  stressDelta: number;
  cargo?: CargoItem;
  reputation?: Array<{ factionId: string; delta: number }>;
  /**
   * COMBATE del hito: el cliente lo lanza; al vencer paga `reward` y el
   * hito queda resuelto (al perder, sigue ahí — se puede volver).
   */
  battle?: { squad: string[]; aiSkill: number; reward: number };
  /** ¿El hito queda RESUELTO ya (sin combate por medio)? */
  done: boolean;
  text: string;
}

// PROVISIONAL: cada hito habla el idioma del mundo (Prathama sin
// nombrarla, clanes, colonos) pero sin cerrar lore. Facciones reales:
// colonos / gremio / chatarreros.
const SPECS: Record<LandmarkKind, LandmarkSpec> = {
  pecio: {
    kind: 'pecio', icon: '🦴', name: 'Pecio de guerra',
    prompt: 'El casco de una máquina de otra década, medio tragado por el terreno. Los clanes marcan estos huesos como suyos.',
    options: [
      { id: 'desguazar', label: '⛏ Desguazar el pecio', detail: '+2 h; restos a la bodega (⌾260); Chatarreros −6 (es SU chatarra)' },
      { id: 'avisar', label: '📻 Marcar y avisar a los clanes', detail: 'Chatarreros +8; lo caído es suyo' },
      { id: 'seguir', label: '→ Dejarlo dormir', detail: 'sin coste' },
    ],
  },
  campamento: {
    kind: 'campamento', icon: '⛺', name: 'Campamento de asaltantes',
    prompt: 'Humo bajo, mallas de camuflaje y cascos apilados: desde aquí salen las partidas que sangran los caminos.',
    options: [
      { id: 'asaltar', label: '⚔ Asaltar el campamento', detail: 'COMBATE; al vencer, botín ⌾420 y Colonos +8 (los caminos respiran)' },
      { id: 'seguir', label: '→ Rodear sin ruido', detail: 'sin coste; ellos tampoco te vieron' },
    ],
  },
  antena: {
    kind: 'antena', icon: '📡', name: 'Antena de los Primeros',
    prompt: 'Una aguja de metal sin óxido emerge del suelo. Zumba. Lleva zumbando más tiempo del que nadie recuerda.',
    options: [
      { id: 'registrar', label: '🔦 Registrar la base de la aguja', detail: '+2 h; banco de datos a la bodega (⌾340); estrés +6 (hay cosas que zumban)' },
      { id: 'informar', label: '📜 Vender las coordenadas al Gremio', detail: 'Gremio +8; los archiveros pagan discreción' },
      { id: 'seguir', label: '→ No tocar lo que zumba', detail: 'sin coste' },
    ],
  },
  caravana: {
    kind: 'caravana', icon: '🆘', name: 'Caravana asediada',
    prompt: 'Una caravana de colonos en círculo defensivo, bengala roja arriba. Los asaltantes ya cortan la distancia.',
    options: [
      { id: 'intervenir', label: '⚔ Intervenir', detail: 'COMBATE; al vencer, gratitud ⌾200 y Colonos +10' },
      { id: 'ignorar', label: '→ No es tu bengala', detail: 'Colonos −5; estas cosas se saben' },
    ],
  },
  santuario: {
    kind: 'santuario', icon: '🕯', name: 'Santuario del camino',
    prompt: 'Un altar de piedra y chapa con ofrendas de viajeros: celdas gastadas, placas con nombres, agua a la sombra.',
    options: [
      { id: 'velar', label: '🕯 Velar un rato', detail: '+2 h; la tripulación respira: estrés −8' },
      { id: 'saquear', label: '☠ Vaciar las ofrendas', detail: 'botín ⌾300; Colonos −8; estrés +6 (hay cosas que pesan)' },
      { id: 'seguir', label: '→ Seguir de largo', detail: 'sin coste' },
    ],
  },
};

export function landmarkSpec(kind: LandmarkKind): LandmarkSpec {
  return SPECS[kind];
}

/** mulberry32 + FNV locales (capa pura sin motor, como sus hermanas). */
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

/** Escuadra determinista de un hito con combate. */
function landmarkSquad(id: string, pool: string[], count: number): string[] {
  const rand = mulberry32(hashString(`poi-squad|${id}`));
  return Array.from({ length: count }, () => pool[Math.floor(rand() * pool.length)]!);
}

/**
 * Resuelve la opción elegida en un hito. Determinista: sin dados
 * escondidos — todo lo que pasa estaba anunciado en el botón.
 */
export function resolveLandmark(landmark: Landmark, optionId: string): LandmarkOutcome {
  const none: LandmarkOutcome = {
    hours: 0, supplyDelta: 0, stressDelta: 0, done: false,
    text: 'Seguimos camino.',
  };
  switch (`${landmark.kind}|${optionId}`) {
    case 'pecio|desguazar':
      return {
        hours: 2, supplyDelta: 0, stressDelta: 0, done: true,
        cargo: { name: 'Restos del pecio de guerra', value: 260 },
        reputation: [{ factionId: 'chatarreros', delta: -6 }],
        text: 'Dos horas de soplete. El pecio viaja en la bodega (⌾260). Los clanes toman nota: Chatarreros −6.',
      };
    case 'pecio|avisar':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 0, done: true,
        reputation: [{ factionId: 'chatarreros', delta: 8 }],
        text: 'Marcamos el pecio y avisamos por radio. Chatarreros +8: lo caído es suyo, y lo saben.',
      };
    case 'campamento|asaltar':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 0, done: false,
        battle: {
          squad: landmarkSquad(landmark.id, ['guysak', 'rev-raptor', 'command-wolf'], 3),
          aiSkill: 0.45,
          reward: 420,
        },
        reputation: [{ factionId: 'colonos', delta: 8 }],
        text: 'Motores a tope contra el campamento. Los caminos van a respirar: Colonos +8.',
      };
    case 'antena|registrar':
      return {
        hours: 2, supplyDelta: 0, stressDelta: 6, done: true,
        cargo: { name: 'Banco de datos de la aguja', value: 340 },
        text: 'La base de la aguja cede. Un banco de datos intacto (⌾340) — y un zumbido que nadie comenta (estrés +6).',
      };
    case 'antena|informar':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 0, done: true,
        reputation: [{ factionId: 'gremio', delta: 8 }],
        text: 'Las coordenadas viajan cifradas al Gremio. Gremio +8: los archiveros pagan discreción.',
      };
    case 'caravana|intervenir':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 0, done: false,
        battle: {
          squad: landmarkSquad(landmark.id, ['molga', 'guysak', 'rev-raptor'], 3),
          aiSkill: 0.3,
          reward: 200,
        },
        reputation: [{ factionId: 'colonos', delta: 10 }],
        text: 'Nos metemos entre la caravana y los asaltantes. Colonos +10: esto también se sabe.',
      };
    case 'caravana|ignorar':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 0, done: true,
        reputation: [{ factionId: 'colonos', delta: -5 }],
        text: 'La bengala roja se apaga en el retrovisor. Colonos −5: estas cosas se saben.',
      };
    case 'santuario|velar':
      return {
        hours: 2, supplyDelta: 0, stressDelta: -8, done: true,
        text: 'Dos horas al fresco del altar. Nadie habla. Nadie necesita hablar (estrés −8).',
      };
    case 'santuario|saquear':
      return {
        hours: 0, supplyDelta: 0, stressDelta: 6, done: true,
        cargo: { name: 'Ofrendas del santuario', value: 300 },
        reputation: [{ factionId: 'colonos', delta: -8 }],
        text: 'Las ofrendas caben en dos cajas (⌾300). Colonos −8, y un silencio que pesa (estrés +6).',
      };
    default:
      return none;
  }
}
