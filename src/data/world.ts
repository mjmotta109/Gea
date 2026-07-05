import type { WorldRegion } from '../game/expedition.js';

/**
 * La primera región del mundo: el Paso de Sal. Dibujada a mano — siete
 * lugares y los tramos que los unen. Las batallas en un lugar usan el
 * mapa personalizado del editor cuyo nombre coincida con el del nodo
 * (si existe); si no, el mapa seleccionado en la cabecera.
 */
export const SALT_PASS_REGION: WorldRegion = {
  id: 'paso-de-sal',
  name: 'Región del Paso de Sal',
  hq: 'base-arcadia',
  nodes: [
    {
      id: 'base-arcadia', name: 'Base Arcadia', kind: 'taller', x: 8, y: 55,
      description: 'El taller de la compañía. Aquí se repara, se compra y se firma.',
    },
    {
      id: 'cruce-del-rio', name: 'Cruce del Río', kind: 'paraje', x: 30, y: 38,
      description: 'Un puente viejo sobre agua lenta. Las caravanas lo evitan de noche.',
    },
    {
      id: 'dunas-rotas', name: 'Dunas Rotas', kind: 'paraje', x: 32, y: 72,
      description: 'Mar de arena con esqueletos de máquinas a medio enterrar.',
    },
    {
      id: 'paso-de-sal', name: 'Paso de Sal', kind: 'paso', x: 55, y: 50,
      description: 'La garganta blanca que une las dos mitades de la región. Tormentas traicioneras.',
    },
    {
      id: 'ruinas-de-helio', name: 'Ruinas de Helio', kind: 'ruinas', x: 62, y: 22,
      description: 'Una ciudad de antes de la guerra. Nadie vuelve con las manos vacías. Nadie vuelve entero.',
    },
    {
      id: 'puesto-cardo', name: 'Puesto Cardo', kind: 'puesto', x: 80, y: 68,
      description: 'Último puesto avanzado con bandera. Café malo, información buena.',
    },
    {
      id: 'nido-del-grande', name: 'Nido del Grande', kind: 'nido', x: 90, y: 35,
      description: 'Los huesos junto al camino vienen de aquí. Algo enorme vive dentro.',
    },
  ],
  edges: [
    { a: 'base-arcadia', b: 'cruce-del-rio', days: 1, flavor: 'La vega del río' },
    { a: 'base-arcadia', b: 'dunas-rotas', days: 1, flavor: 'El borde del mar de arena' },
    { a: 'cruce-del-rio', b: 'paso-de-sal', days: 1, flavor: 'La subida a la garganta' },
    { a: 'dunas-rotas', b: 'paso-de-sal', days: 1, flavor: 'El costado de las dunas' },
    { a: 'cruce-del-rio', b: 'ruinas-de-helio', days: 2, flavor: 'La carretera muerta del norte' },
    { a: 'paso-de-sal', b: 'ruinas-de-helio', days: 1, flavor: 'El desfiladero blanco' },
    { a: 'paso-de-sal', b: 'puesto-cardo', days: 1, flavor: 'La bajada oriental' },
    { a: 'ruinas-de-helio', b: 'nido-del-grande', days: 1, flavor: 'El sendero de huesos' },
    { a: 'puesto-cardo', b: 'nido-del-grande', days: 2, flavor: 'La cornisa del acantilado' },
  ],
};
