import type { WorldAtlas, WorldRegion } from '../game/expedition.js';

/**
 * La primera región del mundo: el Paso de Sal. Dibujada a mano — siete
 * lugares y los tramos que los unen. Las batallas en un lugar usan el
 * mapa personalizado del editor cuyo nombre coincida con el del nodo
 * (si existe); si no, el mapa seleccionado en la cabecera.
 */
export const SALT_PASS_REGION: WorldRegion = {
  id: 'paso-de-sal',
  name: 'Región del Paso de Sal',
  continentId: 'arcadia',
  hq: 'base-arcadia',
  // Tierra de sal y dunas: la arena manda cuando el cielo se tuerce.
  weather: { clear: 5, rain: 1, sandstorm: 4 },
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
      description: 'Una ciudad de antes de la guerra. Nadie vuelve con las manos vacías. Nadie vuelve entero. Dicen que bajo la plaza hay una puerta sellada.',
      reveals: ['cripta-de-sal'],
    },
    {
      id: 'cripta-de-sal', name: 'Cripta de Sal', kind: 'ruinas', x: 72, y: 30,
      hidden: true, secret: true,
      description: 'La puerta sellada bajo Helio. Sal blanca, aire quieto y algo que aún respira despacio. Solo la encuentra quien excava la ciudad de arriba.',
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
    // Tramo LATENTE: solo aparece al descubrir la Cripta excavando Helio.
    { a: 'ruinas-de-helio', b: 'cripta-de-sal', days: 1, flavor: 'El pozo bajo la plaza', biome: 'sierra' },
  ],
};

/**
 * Costa Esmeralda: la salida al mar del continente de Arcadia. Vegas,
 * marjales y el puerto del ferry. Contenido de primera pasada: la
 * dirección lo repoblará.
 */
export const EMERALD_COAST_REGION: WorldRegion = {
  id: 'costa-esmeralda',
  name: 'Costa Esmeralda',
  continentId: 'arcadia',
  hq: 'faro-verde',
  // Costa húmeda: aquí llueve más de lo que despeja.
  weather: { clear: 4, rain: 5, sandstorm: 1 },
  nodes: [
    {
      id: 'faro-verde', name: 'Faro Verde', kind: 'taller', x: 14, y: 50,
      description: 'Un faro reconvertido en taller del Gremio. Huele a salitre y grasa.',
    },
    {
      id: 'marjal-luz', name: 'Marjal de la Luz', kind: 'paraje', x: 34, y: 30,
      description: 'Aguas someras que espejean al atardecer. Las patas se hunden, los sensores sueñan.',
    },
    {
      id: 'aldea-junco', name: 'Aldea Junco', kind: 'ciudad', x: 40, y: 72,
      description: 'Casas sobre pilotes y redes tendidas. Nadie tiene prisa, todo llega.',
      city: { level: 1 },
    },
    {
      id: 'puerto-esmeralda', name: 'Puerto Esmeralda', kind: 'ciudad', x: 68, y: 46,
      description: 'El puerto del ferry: grúas, aduanas y el olor del otro continente.',
      city: { level: 2, factory: 'piezas' },
    },
    {
      id: 'ruinas-abisales', name: 'Ruinas Abisales', kind: 'ruinas', x: 84, y: 18,
      description: 'Estructuras que el mar devuelve a trozos. Nadie sabe qué las hundió. Con marea baja asoma una escalera que baja al agua.',
      reveals: ['templo-sumergido'],
    },
    {
      id: 'templo-sumergido', name: 'Templo Sumergido', kind: 'ruinas', x: 92, y: 9,
      hidden: true, secret: true,
      description: 'Al fondo de la escalera abisal: naves inundadas y vitrales que la sal no ha vencido. Se vadea con las patas dentro del agua.',
    },
  ],
  edges: [
    { a: 'faro-verde', b: 'marjal-luz', days: 1, flavor: 'La senda del marjal', biome: 'vega' },
    { a: 'faro-verde', b: 'aldea-junco', days: 1, flavor: 'El camino de las redes', biome: 'vega' },
    { a: 'marjal-luz', b: 'puerto-esmeralda', days: 1, flavor: 'La calzada de mareas', biome: 'vega' },
    { a: 'aldea-junco', b: 'puerto-esmeralda', days: 1, flavor: 'La costanera', biome: 'vega' },
    { a: 'puerto-esmeralda', b: 'ruinas-abisales', days: 2, flavor: 'El espigón roto', biome: 'sierra' },
    // Tramo LATENTE: la escalera al templo solo aparece al explorar las Abisales.
    { a: 'ruinas-abisales', b: 'templo-sumergido', days: 1, flavor: 'La escalera al agua', biome: 'vega' },
  ],
};

/**
 * Meseta del Hierro: la puerta del continente del Hierro. Tierra de
 * clanes chatarreros, minas viejas y viento con arenilla.
 */
export const IRON_PLATEAU_REGION: WorldRegion = {
  id: 'meseta-hierro',
  name: 'Meseta del Hierro',
  continentId: 'hierro',
  hq: 'campamento-yunque',
  // Meseta ventosa: polvo de mineral en el aire la mitad del año.
  weather: { clear: 5, rain: 2, sandstorm: 3 },
  nodes: [
    {
      id: 'campamento-yunque', name: 'Campamento Yunque', kind: 'taller', x: 18, y: 42,
      description: 'La avanzada del Gremio al otro lado del mar. Media tienda, medio taller.',
    },
    {
      id: 'muelle-oxido', name: 'Muelle del Óxido', kind: 'paraje', x: 10, y: 78,
      description: 'El amarre del ferry: pontones remachados y contenedores con historia.',
    },
    {
      id: 'forja-alta', name: 'Forja Alta', kind: 'ciudad', x: 52, y: 30,
      description: 'La ciudad-horno de los clanes. El cielo naranja no es el atardecer.',
      city: { level: 2, factory: 'armas' },
    },
    {
      id: 'canon-clavos', name: 'Cañón de los Clavos', kind: 'paso', x: 46, y: 66,
      description: 'Paredes de mineral imantado. Las brújulas mienten y los peajes no.',
    },
    {
      id: 'ruinas-magneticas', name: 'Ruinas Magnéticas', kind: 'ruinas', x: 82, y: 52,
      description: 'Chatarra antigua pegada en columnas imposibles. Canta cuando sopla el viento. La aguja se vuelve loca hacia el este.',
      reveals: ['boveda-imantada'],
    },
    {
      id: 'boveda-imantada', name: 'Bóveda Imantada', kind: 'ruinas', x: 93, y: 62,
      hidden: true, secret: true,
      description: 'Donde la brújula señala y nadie va: una bóveda que el campo magnético mantuvo cerrada mil años. Dentro, lo que valía la pena esconder.',
    },
  ],
  edges: [
    { a: 'muelle-oxido', b: 'campamento-yunque', days: 1, flavor: 'La rampa del muelle', biome: 'sierra' },
    { a: 'campamento-yunque', b: 'forja-alta', days: 1, flavor: 'La pista de escoria', biome: 'dunas' },
    { a: 'campamento-yunque', b: 'canon-clavos', days: 1, flavor: 'El desvío imantado', biome: 'sierra' },
    { a: 'forja-alta', b: 'canon-clavos', days: 1, flavor: 'La bajada del horno', biome: 'sierra' },
    { a: 'canon-clavos', b: 'ruinas-magneticas', days: 2, flavor: 'El llano que canta', biome: 'dunas' },
    { a: 'forja-alta', b: 'ruinas-magneticas', days: 2, flavor: 'La ruta de las columnas', biome: 'dunas' },
    // Tramo LATENTE: la aguja loca guía a la Bóveda al explorar las Magnéticas.
    { a: 'ruinas-magneticas', b: 'boveda-imantada', days: 1, flavor: 'El rumbo que miente', biome: 'sierra' },
  ],
};

/**
 * Cinturón de Ceniza: la región profunda del continente del Velo. Tierra
 * volcánica de escoria y vidrio, la más dura del mundo conocido — y la que
 * más esconde. Aquí viven las ruinas más ricas (y sus puertas secretas).
 */
export const ASH_BELT_REGION: WorldRegion = {
  id: 'cinturon-ceniza',
  name: 'Cinturón de Ceniza',
  continentId: 'velo',
  hq: 'refugio-escoria',
  // Bajo el velo ceniciento el cielo casi nunca despeja; la arena manda.
  weather: { clear: 2, rain: 1, sandstorm: 7 },
  nodes: [
    {
      id: 'refugio-escoria', name: 'Refugio de Escoria', kind: 'taller', x: 14, y: 52,
      description: 'La avanzada del Gremio al pie del velo. Puertas de doble junta contra la ceniza.',
    },
    {
      id: 'puerto-brea', name: 'Puerto de Brea', kind: 'ciudad', x: 10, y: 24,
      description: 'El embarcadero negro donde atraca el ferry del Velo. Todo huele a alquitrán caliente.',
      city: { level: 1 },
    },
    {
      id: 'ciudad-hollin', name: 'Ciudad de Hollín', kind: 'ciudad', x: 48, y: 34,
      description: 'Casas bajo toldos de ceniza y un taller de piezas que trabaja el vidrio volcánico.',
      city: { level: 2, factory: 'piezas' },
    },
    {
      id: 'caldera-muerta', name: 'Caldera Muerta', kind: 'paso', x: 40, y: 66,
      description: 'El cráter frío que parte la región. El suelo cruje y a veces cede.',
    },
    {
      id: 'catedral-fundida', name: 'Catedral Fundida', kind: 'ciudad', x: 82, y: 20,
      description: 'La capital del Velo: una fundición del tamaño de una montaña. Armerías que forjan lo que en otras partes es leyenda.',
      city: { level: 3, factory: 'armas' },
    },
    {
      id: 'ruinas-calcinadas', name: 'Ruinas Calcinadas', kind: 'ruinas', x: 70, y: 56,
      description: 'Una urbe que el fuego selló en un instante. Entre la escoria hay un pozo que baja donde nadie mira.',
      reveals: ['sima-primeros'],
    },
    {
      id: 'foso-vidrio', name: 'Foso de Vidrio', kind: 'paraje', x: 58, y: 80,
      description: 'Un llano de obsidiana que refleja dos lunas. Peinarlo con calma revela caminos que nadie dibujó.',
      reveals: ['jardin-obsidiana'],
    },
    {
      id: 'sima-primeros', name: 'Sima de los Primeros', kind: 'ruinas', x: 86, y: 72,
      hidden: true, secret: true,
      description: 'El pozo bajo las Calcinadas baja mil años. Al fondo, la obra de los Primeros, intacta bajo la ceniza. El mejor botín del mundo, si sales.',
    },
    {
      id: 'jardin-obsidiana', name: 'Jardín de Obsidiana', kind: 'paraje', x: 44, y: 92,
      hidden: true,
      description: 'Agujas de cristal negro brotadas del suelo como un bosque. Un sitio de calma imposible en tierra tan brava.',
    },
  ],
  edges: [
    { a: 'refugio-escoria', b: 'puerto-brea', days: 1, flavor: 'La rampa de alquitrán', biome: 'sierra' },
    { a: 'refugio-escoria', b: 'caldera-muerta', days: 1, flavor: 'El borde de la caldera', biome: 'dunas' },
    { a: 'puerto-brea', b: 'ciudad-hollin', days: 1, flavor: 'La pista de hollín', biome: 'dunas' },
    { a: 'caldera-muerta', b: 'ciudad-hollin', days: 1, flavor: 'La subida al toldo', biome: 'sierra' },
    { a: 'caldera-muerta', b: 'ruinas-calcinadas', days: 1, flavor: 'El llano sellado', biome: 'dunas' },
    { a: 'caldera-muerta', b: 'foso-vidrio', days: 1, flavor: 'El reflejo de dos lunas', biome: 'dunas' },
    { a: 'ciudad-hollin', b: 'catedral-fundida', days: 2, flavor: 'La calzada de la fundición', biome: 'sierra' },
    { a: 'ruinas-calcinadas', b: 'catedral-fundida', days: 1, flavor: 'La cuesta de las forjas', biome: 'sierra' },
    // Tramos LATENTES: solo aparecen al descubrir sus secretos.
    { a: 'ruinas-calcinadas', b: 'sima-primeros', days: 1, flavor: 'El pozo de los Primeros', biome: 'sierra' },
    { a: 'foso-vidrio', b: 'jardin-obsidiana', days: 1, flavor: 'El sendero de cristal', biome: 'dunas' },
  ],
};

/** Los continentes y los transportes que los unen. */
export const WORLD_ATLAS: WorldAtlas = {
  continents: [
    { id: 'arcadia', name: 'Arcadia', blurb: 'El continente de partida: vegas, sal y caminos de carreta.' },
    { id: 'hierro', name: 'El Hierro', blurb: 'El continente de los clanes: mineral, viento y deudas.' },
    { id: 'velo', name: 'El Velo', blurb: 'El continente ceniciento: volcanes dormidos, vidrio negro y las ruinas más antiguas.' },
  ],
  regions: [SALT_PASS_REGION, EMERALD_COAST_REGION, IRON_PLATEAU_REGION, ASH_BELT_REGION],
  links: [
    {
      id: 'camino-esmeralda', kind: 'camino',
      a: { regionId: 'paso-de-sal', nodeId: 'cruce-del-rio' },
      b: { regionId: 'costa-esmeralda', nodeId: 'marjal-luz' },
      days: 1, fare: 0, flavor: 'El portazgo del oeste',
    },
    {
      id: 'ferry-esmeralda-oxido', kind: 'ferry',
      a: { regionId: 'costa-esmeralda', nodeId: 'puerto-esmeralda' },
      b: { regionId: 'meseta-hierro', nodeId: 'muelle-oxido' },
      days: 3, fare: 120, flavor: 'La travesía del Estrecho Gris',
    },
    {
      id: 'lanzadera-espejo-forja', kind: 'lanzadera',
      a: { regionId: 'paso-de-sal', nodeId: 'espejo-del-norte' },
      b: { regionId: 'meseta-hierro', nodeId: 'forja-alta' },
      days: 1, fare: 300, flavor: 'La catapulta orbital de los espejos',
    },
    {
      id: 'ferry-esmeralda-brea', kind: 'ferry',
      a: { regionId: 'costa-esmeralda', nodeId: 'puerto-esmeralda' },
      b: { regionId: 'cinturon-ceniza', nodeId: 'puerto-brea' },
      days: 4, fare: 220, flavor: 'La travesía del Mar de Ceniza',
    },
    {
      id: 'lanzadera-forja-catedral', kind: 'lanzadera',
      a: { regionId: 'meseta-hierro', nodeId: 'forja-alta' },
      b: { regionId: 'cinturon-ceniza', nodeId: 'catedral-fundida' },
      days: 1, fare: 380, flavor: 'El salto sobre el velo',
    },
  ],
};
