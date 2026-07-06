/*
 * Siluetas de las bestias mecánicas: SVG inline, sin un solo archivo.
 *
 * Cada FAMILIA de chasis tiene una silueta lateral reconocible (morro a
 * la DERECHA); el bando la colorea vía currentColor y el facing la
 * voltea. Son siluetas de lectura, no ilustraciones: a 46px tienen que
 * distinguirse un felino, un lobo, un terópodo y una oruga de un
 * vistazo.
 */

type Family =
  | 'felino' | 'lobo' | 'raptor' | 'teropodo' | 'oruga' | 'tortuga'
  | 'volador' | 'gorila' | 'bisonte' | 'escorpion' | 'cuellilargo' | 'torreta';

/** Chasis → familia. Lo que no esté aquí cae a una silueta genérica. */
const FAMILIES: Record<string, Family> = {
  'liger-zero': 'felino',
  'liger-zero-cas': 'felino',
  'shield-liger': 'felino',
  'blade-liger': 'felino',
  'zaber-fang': 'felino',
  'command-wolf': 'lobo',
  'konig-wolf': 'lobo',
  'gun-sniper': 'raptor',
  'gun-sniper-naomi': 'raptor',
  'rev-raptor': 'raptor',
  'geno-saurer': 'teropodo',
  'geno-saurer-cp': 'teropodo',
  'gojulas': 'teropodo',
  'molga': 'oruga',
  'guysak': 'escorpion',
  'gustav': 'tortuga',
  'pteras': 'volador',
  'redler': 'volador',
  'storm-sworder': 'volador',
  'iron-kong': 'gorila',
  'gran-brontes': 'bisonte',
  'carguero-colono': 'tortuga',
  'dibison': 'bisonte',
  'gordos': 'torreta',
  'brachios': 'cuellilargo',
};

/*
 * Cada silueta vive en un viewBox 0 0 40 30, dibujada con paths de
 * relleno sólido (currentColor). Morro a la derecha, patas en y≈28.
 */
const SHAPES: Record<Family, string> = {
  felino: `
    <path d="M4 20 L7 12 L14 10 L22 9 L29 10 L33 7 L38 9 L37 13 L33 15 L30 17 L28 22 L26 28 L23 28 L24 21 L18 20 L14 22 L13 28 L10 28 L10 21 L6 24 Z"/>
    <path d="M33 7 L36 4 L38 6 L38 9 Z"/>`,
  lobo: `
    <path d="M3 22 L6 13 L13 11 L21 11 L28 12 L32 9 L38 11 L36 14 L31 16 L29 21 L27 28 L24 28 L25 21 L17 21 L13 22 L12 28 L9 28 L9 22 L5 25 Z"/>
    <path d="M32 9 L33 5 L36 8 Z"/>`,
  raptor: `
    <path d="M2 12 L10 16 L16 15 L22 13 L27 9 L33 8 L38 10 L36 13 L31 14 L28 18 L26 22 L27 28 L23 28 L23 22 L18 21 L15 28 L12 28 L14 20 L8 19 Z"/>
    <path d="M33 8 L36 5 L38 7 Z"/>`,
  teropodo: `
    <path d="M2 8 L8 12 L13 17 L18 16 L24 14 L28 10 L33 8 L38 11 L35 14 L30 16 L28 20 L29 28 L25 28 L24 21 L19 21 L17 28 L13 28 L14 19 L7 15 Z"/>
    <path d="M28 10 L30 4 L34 7 Z"/>`,
  oruga: `
    <path d="M4 22 Q6 14 14 14 L30 14 Q37 15 37 20 L36 24 Q30 28 20 28 Q8 28 4 24 Z"/>
    <circle cx="11" cy="25" r="2"/><circle cx="19" cy="26" r="2"/><circle cx="27" cy="26" r="2"/>`,
  tortuga: `
    <path d="M3 23 L6 15 Q10 8 19 8 Q28 8 31 14 L32 17 L35 15 L39 18 L38 21 L34 21 L32 23 L30 23 L29 28 L25 28 L25 23 L17 23 L16 28 L12 28 L11 23 L7 24 Z"/>
    <path d="M8 16 Q12 11 19 11 Q26 11 29 15 L27 17 Q20 13 11 18 Z" fill="rgba(0,0,0,0.3)"/>`,
  volador: `
    <path d="M3 14 L14 16 L22 15 L30 12 L38 13 L35 17 L26 19 L20 20 L14 24 L10 28 L12 21 L5 18 Z"/>
    <path d="M14 16 L8 6 L13 7 L20 14 Z"/>
    <path d="M20 20 L18 27 L22 22 Z"/>`,
  gorila: `
    <path d="M6 28 L8 16 L13 10 L22 8 L30 10 L34 15 L35 20 L33 28 L29 28 L30 20 L26 22 L25 28 L21 28 L21 22 L14 21 L12 28 Z"/>
    <path d="M30 10 L33 6 L36 10 L34 13 Z"/>`,
  bisonte: `
    <path d="M4 21 L7 13 L15 10 L24 9 L31 11 L36 10 L38 13 L34 15 L31 17 L29 28 L25 28 L26 20 L17 20 L14 28 L10 28 L11 21 L6 23 Z"/>
    <path d="M15 10 L13 4 L18 8 Z"/><path d="M24 9 L23 3 L27 8 Z"/>`,
  escorpion: `
    <path d="M4 10 Q2 16 6 18 L10 20 L14 24 L22 25 L30 23 L37 20 L38 24 L31 27 L20 28 L11 27 L5 23 Q0 17 2 10 Z"/>
    <path d="M10 20 Q9 14 13 12 L17 11 L19 14 L15 16 Q12 16 12 20 Z"/>
    <circle cx="33" cy="24" r="2"/>`,
  cuellilargo: `
    <path d="M4 22 L8 16 L16 14 L24 14 L28 12 L31 4 L35 4 L33 12 L30 16 L28 20 L27 28 L23 28 L23 21 L15 21 L13 28 L9 28 L9 22 Z"/>
    <path d="M31 4 L30 1 L34 1 L35 4 Z"/>`,
  torreta: `
    <path d="M4 22 L7 15 L14 12 L23 12 L30 14 L34 18 L33 22 L29 28 L25 28 L26 22 L16 22 L14 28 L10 28 L10 23 Z"/>
    <path d="M18 12 L20 5 L36 3 L36 6 L23 8 L23 12 Z"/>`,
};

const GENERIC = `
    <path d="M6 24 L9 14 L18 11 L28 12 L34 10 L38 13 L34 16 L30 18 L28 28 L24 28 L25 20 L16 20 L14 28 L10 28 L11 22 Z"/>`;

/** Cuerpo del dibujo (paths) de un chasis: el diorama lo hornea a imagen. */
export function spriteBody(unitTypeId: string): string {
  const family = FAMILIES[unitTypeId];
  return family ? SHAPES[family] : GENERIC;
}

/**
 * SVG completo de la unidad, morro hacia `facing` ('west' voltea; norte
 * y sur inclinan levemente para leerse sin brújula).
 */
export function unitSprite(unitTypeId: string, facing: 'north' | 'south' | 'east' | 'west'): string {
  const family = FAMILIES[unitTypeId];
  const shape = family ? SHAPES[family] : GENERIC;
  const flip = facing === 'west' ? 'scale(-1,1) translate(-40,0)' : '';
  const tilt = facing === 'north' ? 'rotate(-8 20 15)' : facing === 'south' ? 'rotate(8 20 15)' : '';
  return `<svg class="zsprite" viewBox="0 0 40 30" aria-hidden="true">` +
    `<g transform="${flip} ${tilt}" fill="currentColor">${shape}</g></svg>`;
}
