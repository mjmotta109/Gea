/*
 * Facciones y adscripción de ciudades — RELLENO PROVISIONAL.
 *
 * El sistema de reputación (src/game/reputation.ts) es definitivo; estos
 * nombres, lemas y adscripciones son de trabajo hasta que la dirección
 * del juego cree sus facciones. Rebautizar aquí no toca ninguna regla.
 */

export interface FactionDef {
  id: string;
  name: string;
  /** Quiénes son, en una línea (aparece en el cuartel). */
  blurb: string;
}

export const FACTIONS: FactionDef[] = [
  {
    id: 'gremio',
    name: 'Gremio de Mercenarios',
    blurb: 'Los contratos, las reglas y la lista negra. Tu licencia es suya.',
  },
  {
    id: 'colonos',
    name: 'Liga de Colonos',
    blurb: 'Ciudades, caravanas y pozos. Pagan poco y no olvidan nada.',
  },
  {
    id: 'chatarreros',
    name: 'Clanes Chatarreros',
    blurb: 'Todo lo caído les pertenece. Saben dónde duermen los restos.',
  },
];

/**
 * A qué facción responde cada lugar habitado. Los lugares sin entrada
 * son tierra de nadie. La dirección del juego rellenará esto al crear
 * el mapa político.
 */
export const PLACE_FACTIONS: Record<string, string> = {
  'base-arcadia': 'gremio',
  'puesto-cardo': 'colonos',
  'villa-brasa': 'colonos',
  'porto-azul': 'colonos',
};
