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
      id: 'puesto-cardo', name: 'Puesto Cardo', kind: 'ciudad', x: 80, y: 68,
      description: 'Último puesto con bandera. Café malo, información buena, y un taller de piezas que hace milagros baratos.',
      city: { level: 1, factory: 'piezas' },
    },
    {
      id: 'villa-brasa', name: 'Villa Brasa', kind: 'ciudad', x: 16, y: 84,
      description: 'Aldea minera al borde de las dunas. Catres duros, manos honradas, precios de pueblo.',
      city: { level: 1 },
    },
    {
      id: 'porto-azul', name: 'Porto Azul', kind: 'ciudad', x: 36, y: 10,
      description: 'La ciudad del río: armerías con vitrina, talleres certificados y camas que no crujen. Todo tiene precio.',
      city: { level: 2, factory: 'armas' },
    },
    {
      id: 'espejo-del-norte', name: 'Espejo del Norte', kind: 'ciudad', x: 72, y: 6,
      description: 'La capital de la comarca: espejos solares, gremios con alfombra y precios de capital.',
      city: { level: 3, factory: 'armas' },
    },
    {
      id: 'nido-del-grande', name: 'Nido del Grande', kind: 'nido', x: 90, y: 35,
      description: 'Los huesos junto al camino vienen de aquí. Algo enorme vive dentro.',
    },
  ],
  edges: [
    { a: 'base-arcadia', b: 'cruce-del-rio', days: 1, flavor: 'La vega del río', biome: 'vega' },
    { a: 'base-arcadia', b: 'dunas-rotas', days: 1, flavor: 'El borde del mar de arena', biome: 'dunas' },
    { a: 'cruce-del-rio', b: 'paso-de-sal', days: 1, flavor: 'La subida a la garganta', biome: 'sierra' },
    { a: 'dunas-rotas', b: 'paso-de-sal', days: 1, flavor: 'El costado de las dunas', biome: 'dunas' },
    { a: 'cruce-del-rio', b: 'ruinas-de-helio', days: 2, flavor: 'La carretera muerta del norte', biome: 'vega' },
    { a: 'paso-de-sal', b: 'ruinas-de-helio', days: 1, flavor: 'El desfiladero blanco', biome: 'sierra' },
    { a: 'paso-de-sal', b: 'puesto-cardo', days: 1, flavor: 'La bajada oriental', biome: 'sierra' },
    { a: 'ruinas-de-helio', b: 'nido-del-grande', days: 1, flavor: 'El sendero de huesos', biome: 'dunas' },
    { a: 'puesto-cardo', b: 'nido-del-grande', days: 2, flavor: 'La cornisa del acantilado', biome: 'sierra' },
    { a: 'base-arcadia', b: 'villa-brasa', days: 1, flavor: 'El camino de las carretas', biome: 'vega' },
    { a: 'villa-brasa', b: 'dunas-rotas', days: 1, flavor: 'La linde del mar de arena', biome: 'dunas' },
    { a: 'cruce-del-rio', b: 'porto-azul', days: 1, flavor: 'La ribera navegable', biome: 'vega' },
    { a: 'porto-azul', b: 'ruinas-de-helio', days: 2, flavor: 'La calzada del norte', biome: 'vega' },
    { a: 'porto-azul', b: 'espejo-del-norte', days: 2, flavor: 'La ruta de los espejos', biome: 'vega' },
    { a: 'ruinas-de-helio', b: 'espejo-del-norte', days: 1, flavor: 'La cuesta de las antenas', biome: 'sierra' },
    { a: 'nido-del-grande', b: 'espejo-del-norte', days: 2, flavor: 'El filo del cráter', biome: 'sierra' },
  ],
};
