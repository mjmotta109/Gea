import type { PerkTable } from '../core/progression.js';

/**
 * Tabla de perks por pista de especialización del piloto. Cada nivel
 * aplica su fila de modificadores ACUMULATIVAMENTE (nivel 3 = filas 1-3).
 * Números modestos a propósito: el posicionamiento debe seguir importando
 * más que el nivel (GAME-DESIGN §4).
 */
export const PERKS: PerkTable = {
  perks: {
    assault: [
      [{ source: 'pilot:assault-1', stat: 'atk', add: 3 }, { source: 'pilot:assault-1', stat: 'energyAtk', add: 3 }],
      [{ source: 'pilot:assault-2', stat: 'move', add: 1 }],
      [{ source: 'pilot:assault-3', stat: 'atk', add: 4 }, { source: 'pilot:assault-3', stat: 'energyAtk', add: 4 }],
      [{ source: 'pilot:assault-4', stat: 'speed', add: 1 }],
      [{ source: 'pilot:assault-5', stat: 'atk', add: 5 }, { source: 'pilot:assault-5', stat: 'energyAtk', add: 5 }],
    ],
    sniper: [
      [{ source: 'pilot:sniper-1', stat: 'accuracy', add: 4 }],
      [{ source: 'pilot:sniper-2', stat: 'evade', add: 4 }],
      [{ source: 'pilot:sniper-3', stat: 'accuracy', add: 5 }],
      [{ source: 'pilot:sniper-4', stat: 'atk', add: 4 }],
      [{ source: 'pilot:sniper-5', stat: 'accuracy', add: 6 }],
    ],
    support: [
      [{ source: 'pilot:support-1', stat: 'energyDef', add: 4 }],
      [{ source: 'pilot:support-2', stat: 'speed', add: 1 }],
      [{ source: 'pilot:support-3', stat: 'def', add: 4 }],
      [{ source: 'pilot:support-4', stat: 'move', add: 1 }],
      [{ source: 'pilot:support-5', stat: 'maxHp', add: 10 }],
    ],
    defense: [
      [{ source: 'pilot:defense-1', stat: 'def', add: 3 }, { source: 'pilot:defense-1', stat: 'energyDef', add: 3 }],
      [{ source: 'pilot:defense-2', stat: 'maxHp', add: 8 }],
      [{ source: 'pilot:defense-3', stat: 'def', add: 4 }, { source: 'pilot:defense-3', stat: 'energyDef', add: 4 }],
      [{ source: 'pilot:defense-4', stat: 'evade', add: 4 }],
      [{ source: 'pilot:defense-5', stat: 'maxHp', add: 14 }],
    ],
  },
  // Nombres del árbol visual (misma longitud que cada pista de perks).
  perkNames: {
    assault: [
      { name: 'Instinto agresivo', description: 'Golpear primero, preguntar después. +3 ATQ, +3 ATQ.E' },
      { name: 'Zancada', description: 'Cerrar la distancia es un arte. +1 MOV' },
      { name: 'Ferocidad', description: 'Los golpes llevan intención. +4 ATQ, +4 ATQ.E' },
      { name: 'Reflejos de caza', description: 'El turno llega antes. +1 VEL' },
      { name: 'Depredador', description: 'Lo que persigue, cae. +5 ATQ, +5 ATQ.E' },
    ],
    sniper: [
      { name: 'Ojo calibrado', description: 'La distancia es un número. +4 PUNT' },
      { name: 'Paso fantasma', description: 'Nunca donde apuntan. +4 EVA' },
      { name: 'Pulso firme', description: 'Respirar, apretar. +5 PUNT' },
      { name: 'Munición artesanal', description: 'Cada bala, afinada a mano. +4 ATQ' },
      { name: 'Un disparo', description: 'Casi nunca hace falta el segundo. +6 PUNT' },
    ],
    support: [
      { name: 'Escudos afinados', description: 'La pantalla rinde más. +4 DEF.E' },
      { name: 'Logística ágil', description: 'Todo listo antes de que lo pidan. +1 VEL' },
      { name: 'Blindaje de campaña', description: 'Placas extra bien puestas. +4 DEF' },
      { name: 'Rutas seguras', description: 'Conoce el terreno que pisa. +1 MOV' },
      { name: 'Reservas ocultas', description: 'Siempre queda algo en el tanque. +10 HP' },
    ],
    defense: [
      { name: 'Piel de acero', description: 'Encajar es un oficio. +3 DEF, +3 DEF.E' },
      { name: 'Aguante', description: 'Sigue en pie por costumbre. +8 HP' },
      { name: 'Muralla', description: 'Por aquí no pasan. +4 DEF, +4 DEF.E' },
      { name: 'Esquiva defensiva', description: 'Recibir el golpe que no duele. +4 EVA' },
      { name: 'Inquebrantable', description: 'La máquina cede antes que el piloto. +14 HP' },
    ],
  },
  // Sinergia piloto↔máquina: cada pieza montada que casa con la pista
  // dominante refuerza su estilo (máx. 2 piezas).
  synergy: {
    assault: { source: 'synergy:assault', stat: 'atk', add: 3 },
    sniper: { source: 'synergy:sniper', stat: 'accuracy', add: 3 },
    support: { source: 'synergy:support', stat: 'speed', add: 1 },
    defense: { source: 'synergy:defense', stat: 'def', add: 3 },
  },
  synergyCap: 2,
  // ── Estrés: temporal, se descansa en las ciudades. Solo aplica el
  //    tramo más alto alcanzado; a 95+ el piloto está para pocas guerras.
  stressTiers: [
    {
      min: 50, label: 'Tenso',
      modifiers: [{ source: 'stress:tenso', stat: 'accuracy', add: -2 }],
    },
    {
      min: 75, label: 'Al límite',
      modifiers: [
        { source: 'stress:al-limite', stat: 'accuracy', add: -4 },
        { source: 'stress:al-limite', stat: 'evade', add: -3 },
      ],
    },
    {
      min: 95, label: 'Quebrado',
      modifiers: [
        { source: 'stress:quebrado', stat: 'accuracy', add: -6 },
        { source: 'stress:quebrado', stat: 'evade', add: -5 },
        { source: 'stress:quebrado', stat: 'move', add: -1 },
      ],
    },
  ],
  // ── Manías: lo vivido deja huella (bendiciones, cicatrices o ambas).
  //    Números modestos: son personalidad, no poder.
  quirkCap: 4,
  quirks: {
    'curtido': {
      id: 'curtido', name: 'Curtido',
      description: 'Tres veces volvió oliendo a humo. Ya nada le tiembla.',
      counter: 'roces', threshold: 3,
      modifiers: [{ source: 'quirk:curtido', stat: 'def', add: 3 }],
    },
    'miedo-al-calor': {
      id: 'miedo-al-calor', name: 'Miedo al calor',
      description: 'El olor a refrigerante quemado no se olvida. Apunta peor, pero no se queda quieto.',
      counter: 'apagados', threshold: 2,
      modifiers: [
        { source: 'quirk:miedo-al-calor', stat: 'accuracy', add: -3 },
        { source: 'quirk:miedo-al-calor', stat: 'evade', add: 4 },
      ],
    },
    'gatillo-facil': {
      id: 'gatillo-facil', name: 'Gatillo fácil',
      description: 'Una docena de bajas y las ganas de más. Dispara fuerte, apunta rápido.',
      counter: 'bajas', threshold: 12,
      modifiers: [
        { source: 'quirk:gatillo-facil', stat: 'atk', add: 3 },
        { source: 'quirk:gatillo-facil', stat: 'accuracy', add: -2 },
      ],
    },
    'ojo-de-halcon': {
      id: 'ojo-de-halcon', name: 'Ojo de halcón',
      description: 'Ha visto venir tantos disparos que ya los espera.',
      counter: 'esquivas', threshold: 8,
      modifiers: [{ source: 'quirk:ojo-de-halcon', stat: 'evade', add: 3 }],
    },
    'veterano': {
      id: 'veterano', name: 'Veterano',
      description: 'Diez batallas. Las cuenta por las marcas del asiento.',
      counter: 'batallas', threshold: 10,
      modifiers: [
        { source: 'quirk:veterano', stat: 'atk', add: 2 },
        { source: 'quirk:veterano', stat: 'def', add: 2 },
      ],
    },
    'manos-de-santo': {
      id: 'manos-de-santo', name: 'Manos de santo',
      description: 'Ha devuelto a la vida más acero del que ha roto.',
      counter: 'reparaciones', threshold: 250,
      modifiers: [{ source: 'quirk:manos-de-santo', stat: 'speed', add: 1 }],
    },
    'paranoia': {
      id: 'paranoia', name: 'Paranoia',
      description: 'Tanto castigo encajado deja secuelas: no deja de mirar los retrovisores.',
      counter: 'castigo', threshold: 900,
      modifiers: [
        { source: 'quirk:paranoia', stat: 'evade', add: 4 },
        { source: 'quirk:paranoia', stat: 'move', add: -1 },
      ],
    },
    'sangre-fria': {
      id: 'sangre-fria', name: 'Sangre fría',
      description: 'Encajó una paliza histórica y siguió dando órdenes con voz plana.',
      counter: 'castigo', threshold: 1800,
      modifiers: [{ source: 'quirk:sangre-fria', stat: 'accuracy', add: 3 }],
    },
  },
};
