import type { CompanionTable } from '../game/companion.js';

/**
 * Las marcas del núcleo de la compañera y los tramos de compenetración.
 * Regla de diseño (GAME-DESIGN §1.2): números modestos — la biografía
 * da carácter, no poder; el techo evita compañeras infinitas.
 */
export const COMPANION_TABLE: CompanionTable = {
  markCap: 6,
  marks: {
    'forjada-en-el-desierto': {
      id: 'forjada-en-el-desierto', name: 'Forjada en el desierto',
      description: 'Dos batallas dentro de la tormenta y el núcleo aprendió a respirar arena.',
      counter: 'tormentas', threshold: 2,
      modifiers: [{ source: 'mark:forjada-en-el-desierto', stat: 'energyDef', add: 4 }],
    },
    'corazon-de-hierro': {
      id: 'corazon-de-hierro', name: 'Corazón de hierro',
      description: 'Se apagó ardiendo dos veces. Dos veces volvió a encenderse.',
      counter: 'apagados', threshold: 2,
      modifiers: [{ source: 'mark:corazon-de-hierro', stat: 'maxHp', add: 10 }],
    },
    'diente-mellado': {
      id: 'diente-mellado', name: 'Diente mellado',
      description: 'Diez bajas confirmadas. El rugido ya no es amenaza: es historial.',
      counter: 'bajas', threshold: 10,
      modifiers: [{ source: 'mark:diente-mellado', stat: 'atk', add: 3 }],
    },
    'cazadora-de-reyes': {
      id: 'cazadora-de-reyes', name: 'Cazadora de reyes',
      description: 'Dos comandantes enemigos cayeron bajo sus garras. Los demás la esquivan.',
      counter: 'cazas', threshold: 2,
      modifiers: [{ source: 'mark:cazadora-de-reyes', stat: 'accuracy', add: 3 }],
    },
    'la-que-vuelve': {
      id: 'la-que-vuelve', name: 'La que vuelve',
      description: 'Tres veces la dieron por perdida. Tres veces cruzó la puerta del taller.',
      counter: 'roces', threshold: 3,
      modifiers: [{ source: 'mark:la-que-vuelve', stat: 'evade', add: 4 }],
    },
    'cicatriz-del-taller': {
      id: 'cicatriz-del-taller', name: 'Cicatriz del taller',
      description: 'La reconstruyeron desde el núcleo. Quedó más dura... y más lenta. La cicatriz se ve.',
      counter: 'reconstrucciones', threshold: 1,
      modifiers: [
        { source: 'mark:cicatriz-del-taller', stat: 'def', add: 4 },
        { source: 'mark:cicatriz-del-taller', stat: 'speed', add: -1 },
      ],
    },
    'vieja-guardia': {
      id: 'vieja-guardia', name: 'Vieja guardia',
      description: 'Quince batallas juntos. Ya no hace falta decirle a dónde mirar.',
      counter: 'batallas', threshold: 15,
      modifiers: [
        { source: 'mark:vieja-guardia', stat: 'def', add: 2 },
        { source: 'mark:vieja-guardia', stat: 'evade', add: 2 },
      ],
    },
  },
  rapportCap: 12,
  rapportTiers: [
    {
      min: 4, label: 'Se entienden',
      modifiers: [{ source: 'rapport:se-entienden', stat: 'accuracy', add: 2 }],
    },
    {
      min: 8, label: 'Una sola pieza',
      modifiers: [
        { source: 'rapport:una-sola-pieza', stat: 'accuracy', add: 3 },
        { source: 'rapport:una-sola-pieza', stat: 'evade', add: 2 },
      ],
    },
    {
      min: 12, label: 'Leyenda del taller',
      modifiers: [
        { source: 'rapport:leyenda', stat: 'accuracy', add: 4 },
        { source: 'rapport:leyenda', stat: 'evade', add: 3 },
        { source: 'rapport:leyenda', stat: 'speed', add: 1 },
      ],
    },
  ],
};

/**
 * Núcleo de las DEMÁS máquinas del roster: TODO Zoid está vivo y graba
 * lo vivido, pero el vínculo del viaje es único — menos espacios de
 * marca y techo de compenetración más bajo que la compañera. Los tramos
 * altos ('Una sola pieza', 'Leyenda del taller') son solo suyos.
 */
export const CORE_TABLE: CompanionTable = {
  ...COMPANION_TABLE,
  markCap: 3,
  rapportCap: 6,
  rapportTiers: COMPANION_TABLE.rapportTiers.filter((tier) => tier.min <= 6),
};
