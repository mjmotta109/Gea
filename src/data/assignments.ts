/*
 * Destacamentos: encargos que la compañía acepta y delega en UN piloto
 * con su máquina. Contenido de primera pasada — la dirección lo
 * repoblará; el sistema vive en src/game/assignment.ts.
 */

export interface AssignmentCallOption {
  id: string;
  label: string;
  /** Consecuencia anunciada: sin letra pequeña. */
  detail: string;
  /** Ajuste a la puntuación de éxito final. */
  scoreDelta: number;
  /** Multiplicador de la paga final. */
  rewardMult: number;
  /** Jornadas extra que añade (0 = ninguna). */
  extraDays: number;
}

export interface AssignmentCall {
  /** En qué fracción del encargo suena el teléfono (0-1). */
  at: number;
  prompt: string;
  options: AssignmentCallOption[];
}

export interface AssignmentSpec {
  id: string;
  name: string;
  blurb: string;
  days: number;
  /** Dificultad base: resta puntuación (la experiencia la compensa). */
  difficulty: number;
  /** Paga base al completarse. */
  reward: number;
  /** XP por pista al piloto destacado (menor que en batalla, pero real). */
  xp: Partial<Record<'assault' | 'sniper' | 'support' | 'defense', number>>;
  /** Reputación al completarse con éxito. */
  reputation?: Array<{ factionId: string; delta: number }>;
  calls: AssignmentCall[];
}

export const ASSIGNMENT_SPECS: AssignmentSpec[] = [
  {
    id: 'escolta-local',
    name: 'Escolta de caravana local',
    blurb: 'Tres jornadas de polvo al paso de los bueyes de carga. Trabajo tranquilo… casi siempre.',
    days: 3,
    difficulty: 10,
    reward: 160,
    xp: { defense: 22, assault: 10 },
    reputation: [{ factionId: 'colonos', delta: 4 }],
    calls: [
      {
        at: 0.5,
        prompt: 'Llamada del destacamento: la caravana quiere desviarse por el paso corto. Ahorra un día, pero es tierra de nadie.',
        options: [
          { id: 'corto', label: '⚡ Autorizar el paso corto', detail: '−1 jornada; más riesgo (éxito −12)', scoreDelta: -12, rewardMult: 1, extraDays: -1 },
          { id: 'seguro', label: '🛡 Ruta segura, como se pactó', detail: 'sin cambios', scoreDelta: 0, rewardMult: 1, extraDays: 0 },
        ],
      },
    ],
  },
  {
    id: 'prospeccion',
    name: 'Prospección de ruinas menores',
    blurb: 'Catalogar restos y traer lo que valga. Paga por lo que aparezca — y aparece de todo.',
    days: 4,
    difficulty: 22,
    reward: 240,
    xp: { support: 22, sniper: 12 },
    calls: [
      {
        at: 0.5,
        prompt: 'Llamada del destacamento: bajo los restos hay una galería intacta. Entrar es botín seguro… si el techo aguanta.',
        options: [
          { id: 'entrar', label: '⛏ Entrar a la galería', detail: '+1 jornada; paga ×1.5; éxito −10', scoreDelta: -10, rewardMult: 1.5, extraDays: 1 },
          { id: 'sellar', label: '📷 Fotografiar y sellar', detail: 'sin cambios; los mapas también pagan', scoreDelta: 5, rewardMult: 1, extraDays: 0 },
          { id: 'volver', label: '↩ Volver con lo catalogado', detail: '−1 jornada; paga ×0.7; éxito +15', scoreDelta: 15, rewardMult: 0.7, extraDays: -1 },
        ],
      },
    ],
  },
  {
    id: 'rastreo-gremio',
    name: 'Rastreo para el Gremio',
    blurb: 'Seguir la pista de una máquina fugada y marcar su madriguera. Sin enfrentarse: solo ojos.',
    days: 5,
    difficulty: 34,
    reward: 340,
    xp: { sniper: 26, assault: 12 },
    reputation: [{ factionId: 'gremio', delta: 6 }],
    calls: [
      {
        at: 0.4,
        prompt: 'Llamada del destacamento: la pista se bifurca — el rastro fresco cruza territorio chatarrero.',
        options: [
          { id: 'cruzar', label: '🌒 Cruzar de noche', detail: 'éxito −8; Chatarreros −4 si sale mal', scoreDelta: -8, rewardMult: 1, extraDays: 0 },
          { id: 'rodear', label: '↩ Rodear el territorio', detail: '+1 jornada; éxito +8', scoreDelta: 8, rewardMult: 1, extraDays: 1 },
        ],
      },
      {
        at: 0.8,
        prompt: 'Llamada del destacamento: madriguera localizada. Puede acercarse a confirmar el chasis… o marcarla desde lejos.',
        options: [
          { id: 'acercarse', label: '🔍 Confirmar de cerca', detail: 'paga ×1.4; éxito −14', scoreDelta: -14, rewardMult: 1.4, extraDays: 0 },
          { id: 'lejos', label: '📡 Marcar desde lejos', detail: 'sin cambios', scoreDelta: 0, rewardMult: 1, extraDays: 0 },
        ],
      },
    ],
  },
];
