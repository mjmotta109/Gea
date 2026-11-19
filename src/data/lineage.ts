/**
 * El LINAJE de cada yantra: de qué Tradición Mecánica sale y cómo lo
 * matricula el Sarvatantra. Es dato de universo (docs/LORE.md §6), por
 * eso vive aquí y no en el motor: src/core no sabe qué es una tradición.
 *
 * Dos registros conviven en cada ficha, a propósito (LORE P5): la
 * DESIGNACIÓN del Estado (fría, con número de serie) y el APODO de
 * taller con el que todo el mundo llama a la máquina (el `name` del
 * catálogo). La tensión burocracia/calle se lee en el hangar sin un
 * solo texto de más.
 */

export type TraditionId = 'albion' | 'yamato' | 'argos' | 'remiendo';

export interface Tradition {
  id: TraditionId;
  /** Nombre tal como aparece grabado en las placas de forja. */
  name: string;
  /** Prefijo de matrícula del Sarvatantra. */
  prefix: string;
  /** Una línea de carácter: cómo se reconoce una máquina de esta escuela. */
  motto: string;
}

export const TRADITIONS: Record<TraditionId, Tradition> = {
  albion: {
    id: 'albion', name: 'Albion', prefix: 'ALB',
    motto: 'Placa sobre placa. Lo que Albion forja, aguanta.',
  },
  yamato: {
    id: 'yamato', name: 'Yamato', prefix: 'YMT',
    motto: 'Articulación limpia y gesto exacto: el golpe justo, no el más fuerte.',
  },
  argos: {
    id: 'argos', name: 'Argos', prefix: 'ARG',
    motto: 'Cien ojos y ninguno cerrado: ver primero es ganar primero.',
  },
  remiendo: {
    id: 'remiendo', name: 'Remiendo', prefix: 's/l',
    motto: 'Sin linaje y sin licencia: piezas de tres escuelas soldadas a ojo.',
  },
};

export interface Lineage {
  tradition: TraditionId;
  /** Matrícula estatal completa (p. ej. «ALB-90»). */
  designation: string;
}

/** Linaje de cada chasis del catálogo (id → tradición + matrícula). */
export const LINEAGE: Record<string, Lineage> = {
  // ── Albion: blindaje, placas estructurales, siluetas de peso ──
  baluarte: { tradition: 'albion', designation: 'ALB-90' },
  martinete: { tradition: 'albion', designation: 'ALB-72' },
  bombarda: { tradition: 'albion', designation: 'ALB-66' },
  torreon: { tradition: 'albion', designation: 'ALB-80' },
  rodela: { tradition: 'albion', designation: 'ALB-54' },
  mula: { tradition: 'albion', designation: 'ALB-22' },
  'gran-brontes': { tradition: 'albion', designation: 'ALB-00' },
  'carguero-colono': { tradition: 'albion', designation: 'ALB-C3' },
  // ── Yamato: siluetas estilizadas, extremidades articuladas ──
  centella: { tradition: 'yamato', designation: 'YMT-3' },
  'centella-m': { tradition: 'yamato', designation: 'YMT-3M' },
  tizona: { tradition: 'yamato', designation: 'YMT-7' },
  cizalla: { tradition: 'yamato', designation: 'YMT-5' },
  vencejo: { tradition: 'yamato', designation: 'YMT-9V' },
  saeta: { tradition: 'yamato', designation: 'YMT-1V' },
  // ── Argos: sensores, antenas, sistemas ópticos a la vista ──
  prisma: { tradition: 'argos', designation: 'ARG-12' },
  'prisma-m': { tradition: 'argos', designation: 'ARG-12M' },
  rastreador: { tradition: 'argos', designation: 'ARG-4' },
  reticula: { tradition: 'argos', designation: 'ARG-6' },
  visor: { tradition: 'argos', designation: 'ARG-2' },
  'visor-c': { tradition: 'argos', designation: 'ARG-2C' },
  cometa: { tradition: 'argos', designation: 'ARG-8V' },
  faro: { tradition: 'argos', designation: 'ARG-15' },
  // ── Remiendos de clan: lo que ruge en los caminos sin papeles ──
  navaja: { tradition: 'remiendo', designation: 's/l' },
  barrena: { tradition: 'remiendo', designation: 's/l' },
  tornillo: { tradition: 'remiendo', designation: 's/l' },
};

/** Linaje de un chasis (los del taller de contenido no tienen: undefined). */
export function lineageOf(unitTypeId: string): (Lineage & { traditionData: Tradition }) | undefined {
  const lineage = LINEAGE[unitTypeId];
  return lineage ? { ...lineage, traditionData: TRADITIONS[lineage.tradition] } : undefined;
}
