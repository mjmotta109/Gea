/**
 * Migración de guardados al universo propio (el rebranding de 2026-11).
 *
 * Los guardados anteriores llevan ids y nombres de la etapa prototipo.
 * Para no volver a publicar esos términos dentro del juego, la tabla NO
 * los contiene: solo su huella FNV-1a de 32 bits → el valor nuevo. Se
 * sustituyen únicamente cadenas JSON EXACTAS (un id, un nombre de
 * fábrica); el texto libre (crónica, notas) se respeta tal cual.
 *
 * Capa pura: sin DOM. El cliente decide cuándo y sobre qué la aplica.
 */

/** FNV-1a de 32 bits sobre unidades UTF-16 (el mismo de toda la casa). */
export function legacyHash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** huella del término viejo → valor nuevo. */
const LEGACY = new Map<number, string>([
  [0x02711c45, 'navaja'],
  [0x04b06c4b, 'tizona'],
  [0x09221765, 'Retícula'],
  [0x0a9deb17, 'co-fuselaje'],
  [0x0d6676d6, 'Cometa'],
  [0x0e26e8b0, 'Martinete'],
  [0x0ff8641c, 'vi-nucleo'],
  [0x1005ef49, 'ba-nucleo'],
  [0x10bb95cf, 'tornillo'],
  [0x158eb26f, 'torreon'],
  [0x16fa9c2b, 'w-arc-claw'],
  [0x1aede762, 'ce-garras'],
  [0x1b645112, 'Centella'],
  [0x1df68cb9, 'prisma'],
  [0x205260d9, 'Torso y reactor'],
  [0x21be960c, 'faro'],
  [0x2438267a, 'Visor-C'],
  [0x24b21785, 'Cizalla'],
  [0x24fd91ea, 'pm-pierna-izq'],
  [0x26fd9510, 'pm-pierna-der'],
  [0x27ee493e, 'cañón de haz'],
  [0x2a1d0fbf, 'co-casco'],
  [0x2c06adf5, 'Bombarda'],
  [0x2d13e636, 'baluarte'],
  [0x2d454d3e, 'ma-nucleo'],
  [0x2e493173, 'ra-patas-del'],
  [0x31d9f965, 'centella-m'],
  [0x347b5d16, 'Retícula'],
  [0x3480f610, 'pr-cola'],
  [0x353511ea, 'ba-casco'],
  [0x3678bf3c, 'cm-tren-del'],
  [0x3957eeb6, 'cometa'],
  [0x3a9f6dfb, 'Centella-M'],
  [0x3ae1b00b, 'co-ala-izq'],
  [0x3d57d48b, 'ce-tren-del'],
  [0x41105f9a, 'Tizona'],
  [0x442fe559, 'Barrena'],
  [0x4521996e, 'cizalla'],
  [0x4a83bfe8, 'Tamsin'],
  [0x4b803014, 'Vencejo'],
  [0x4dffeddd, 'cm-cabeza'],
  [0x4f697921, 'ma-brazos'],
  [0x4ffe4a87, 'vi-patas'],
  [0x50667bc6, 'reticula'],
  [0x57a0342c, 'Faro'],
  [0x57dde769, 'centella'],
  [0x58fc5648, 'ra-patas-tras'],
  [0x59120be4, 'Garras de arco'],
  [0x5abe56f4, 'Noor'],
  [0x5ba22c8f, 'Torreón'],
  [0x5cce74ce, 'ma-piernas'],
  [0x622bb723, 'ce-lomo'],
  [0x6514b622, 'Basco'],
  [0x6522cd2a, 'co-ala-der'],
  [0x682f2e5e, 'Cañón de haz'],
  [0x688a81e2, 'Prisma'],
  [0x68b75767, 'saeta'],
  [0x70af1dd6, 'Baluarte'],
  [0x71981a07, 'prisma-m'],
  [0x76bc2091, 'mula'],
  [0x774bf124, 'vi-rifle'],
  [0x7b56c279, 'ba-coraza'],
  [0x81e87186, 'Cañón de choque'],
  [0x82332d23, 'ba-misiles'],
  [0x84a529ff, 'w-beam-cannon'],
  [0x8bc85db1, 'rastreador'],
  [0x8cbd99c3, 'vi-cola'],
  [0x8d764f27, 'pr-nucleo'],
  [0x90184fc3, 'Garras de arco'],
  [0x92465e86, 'Fuselaje y núcleo'],
  [0x92f9e0bd, 'Prisma-M'],
  [0x9409d10d, 'ma-mochila'],
  [0x94db5bf3, 'martinete'],
  [0x9b419a87, 'arc-claw'],
  [0x9ba1be40, 'ce-tren-tras'],
  [0x9dbd8f6e, 'rodela'],
  [0xa6cbea3c, 'vi-sensor'],
  [0xa80e03cc, 'Cañón de haz'],
  [0xa8119b9b, 'beam-cannon'],
  [0xa86fcc9c, 'ba-patas'],
  [0xa8eaecc2, 'Navaja'],
  [0xad4ecd92, 'cm-torso'],
  [0xae8b5d58, 'pm-torso'],
  [0xaecad187, 'Saeta'],
  [0xafe0de10, 'ra-nucleo'],
  [0xb20a7517, 'cm-tren-tras'],
  [0xb22a4754, 'Visor'],
  [0xb254248a, 'beam-intake'],
  [0xb4b70ae5, 'ra-casco'],
  [0xb9bc82b6, 'pr-patas'],
  [0xb9ff2bec, 'ce-nucleo'],
  [0xbccf9ab1, 'Mula'],
  [0xc4f879b5, 'vencejo'],
  [0xc549b5d0, 'pr-canon'],
  [0xcb8c9749, 'ce-casco'],
  [0xcbeb9e83, 'visor'],
  [0xcd1a9c77, 'pm-cabeza'],
  [0xd163af42, 'visor-c'],
  [0xdbf87308, 'pr-casco'],
  [0xe2b6186f, 'Tornillo'],
  [0xe43c6912, 'Garras de arco'],
  [0xe6bbda75, 'ra-canon'],
  [0xeabb04ac, 'cañón de haz'],
  [0xeb2bba55, 'bombarda'],
  [0xeec59757, 'Rodela'],
  [0xf5ee3e0a, 'arc-claws'],
  [0xf6888ee7, 'pm-cola'],
  [0xf8997f3b, 'ma-casco'],
  [0xf8b22542, 'Iria'],
  [0xfae5a4d5, 'co-cola'],
  [0xfb3ef7a4, 'Torso y núcleo'],
  [0xfbe7460a, 'Rastreador'],
  [0xfe1ad839, 'barrena'],
]);

/** ¿Cuántos términos sabe migrar? (para tests y diagnóstico) */
export const LEGACY_TERMS = LEGACY.size;

/**
 * Reescribe un JSON serializado: cada cadena exacta que sea un término
 * viejo pasa a su valor nuevo (claves de objeto incluidas). Idempotente:
 * aplicarla dos veces no cambia nada más.
 */
export function migrateLegacyJson(json: string): string {
  return json.replace(/"((?:[^"\\]|\\.){1,48})"/g, (whole, inner: string) => {
    const next = LEGACY.get(legacyHash(inner));
    return next === undefined ? whole : JSON.stringify(next);
  });
}
