import type { UnitDefinition } from '../core/types.js';

/**
 * Catálogo de chasis de Zoids. Cumplen el papel de los jobs de FFTA:
 * definen stats, movimiento y qué habilidades están disponibles.
 *
 * Roles pensados para que el plantel base cubra el triángulo táctico:
 * asalto rápido, tanque, francotirador, soporte, volador y grunt barato.
 */
export const ZOIDS: Record<string, UnitDefinition> = {
  'liger-zero': {
    id: 'liger-zero',
    weightClass: 'ligero',
    name: 'Liger Zero',
    role: 'assault',
    moveType: 'ground',
    stats: {
      maxHp: 120, atk: 45, energyAtk: 55, def: 30, energyDef: 25,
      speed: 16, move: 6, jump: 2, evade: 20, accuracy: 0,
    },
    abilityIds: ['strike-laser-claw', 'bite-crush', 'e-shield'],
    aiProfile: { aggression: 0.85, selfPreservation: 0.4, riskTolerance: 0.6 },
    frame: [
      { slot: 'casco', moduleId: 'lz-casco' },
      { slot: 'nucleo', moduleId: 'lz-nucleo' },
      { slot: 'tren-del', moduleId: 'lz-tren-del' },
      { slot: 'tren-tras', moduleId: 'lz-tren-tras' },
      { slot: 'garras', moduleId: 'lz-garras' },
      { slot: 'lomo', moduleId: 'lz-lomo' },
    ],
  },
  'command-wolf': {
    id: 'command-wolf',
    weightClass: 'ligero',
    name: 'Command Wolf',
    role: 'skirmisher',
    moveType: 'ground',
    stats: {
      maxHp: 100, atk: 40, energyAtk: 30, def: 25, energyDef: 20,
      speed: 14, move: 5, jump: 2, evade: 15, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'shock-cannon', 'smoke-discharger'],
    frame: [
      { slot: 'casco', moduleId: 'cw-casco' },
      { slot: 'nucleo', moduleId: 'cw-nucleo' },
      { slot: 'patas-del', moduleId: 'cw-patas-del' },
      { slot: 'patas-tras', moduleId: 'cw-patas-tras' },
      { slot: 'canon', moduleId: 'cw-canon' },
    ],
  },
  'gojulas': {
    id: 'gojulas',
    weightClass: 'extrapesado',
    name: 'Gojulas',
    role: 'tank',
    moveType: 'ground',
    stats: {
      // Nerf (2026-07-08): con la IA de fuego concentrado su ataque enorme (60)
      // lo volvía dominante (61.6%). Baja a 52; sigue siendo el tanque más duro.
      maxHp: 200, atk: 52, energyAtk: 40, def: 50, energyDef: 40,
      speed: 8, move: 4, jump: 1, evade: 0, accuracy: 3,
    },
    abilityIds: ['bite-crush', 'missile-pod', 'e-shield'],
    frame: [
      { slot: 'casco', moduleId: 'gj-casco' },
      { slot: 'nucleo', moduleId: 'gj-nucleo' },
      { slot: 'patas', moduleId: 'gj-patas' },
      { slot: 'misiles', moduleId: 'gj-misiles' },
      { slot: 'coraza', moduleId: 'gj-coraza' },
    ],
  },
  'gun-sniper': {
    id: 'gun-sniper',
    weightClass: 'extraligero',
    vision: 8, // ojos de la noche
    name: 'Gun Sniper',
    role: 'sniper',
    moveType: 'ground',
    stats: {
      maxHp: 80, atk: 46, energyAtk: 25, def: 15, energyDef: 15,
      speed: 12, move: 4, jump: 1, evade: 8, accuracy: 0,
    },
    abilityIds: ['bite-crush'],
    weapons: ['w-sniper-rifle'],
    aiProfile: { aggression: 0.35, selfPreservation: 0.8, riskTolerance: 0.2 },
    frame: [
      { slot: 'sensor', moduleId: 'gsn-sensor' },
      { slot: 'nucleo', moduleId: 'gsn-nucleo' },
      { slot: 'patas', moduleId: 'gsn-patas' },
      { slot: 'cola', moduleId: 'gsn-cola' },
      { slot: 'rifle', moduleId: 'gsn-rifle' },
    ],
  },
  'pteras': {
    id: 'pteras',
    weightClass: 'ligero',
    vision: 8, // ojos de la noche
    name: 'Pteras',
    role: 'flyer',
    moveType: 'flying',
    stats: {
      // Buff (2026-07-08): explorador aéreo frágil de pega floja; +HP y +evasión
      // para que aguante (no dejar un hueco nuevo al reforzar los otros voladores).
      maxHp: 100, atk: 30, energyAtk: 35, def: 15, energyDef: 20,
      speed: 15, move: 7, jump: 99, evade: 28, accuracy: 0,
    },
    abilityIds: ['shock-cannon', 'stun-blade'],
    frame: [
      { slot: 'casco', moduleId: 'pt-casco' },
      { slot: 'fuselaje', moduleId: 'pt-fuselaje' },
      { slot: 'ala-izq', moduleId: 'pt-ala-izq' },
      { slot: 'ala-der', moduleId: 'pt-ala-der' },
      { slot: 'cola', moduleId: 'pt-cola' },
    ],
  },
  'gustav': {
    id: 'gustav',
    weightClass: 'pesado',
    name: 'Gustav',
    role: 'support',
    moveType: 'ground',
    stats: {
      maxHp: 140, atk: 20, energyAtk: 15, def: 45, energyDef: 35,
      speed: 10, move: 4, jump: 1, evade: 5, accuracy: 0,
    },
    abilityIds: ['repair-drones', 'smoke-discharger', 'e-shield'],
    weapons: ['w-impact-cannon'],
    aiProfile: { aggression: 0.2, selfPreservation: 0.9, riskTolerance: 0.3 },
  },
  'molga': {
    id: 'molga',
    weightClass: 'extraligero',
    name: 'Molga',
    role: 'skirmisher',
    moveType: 'ground',
    stats: {
      maxHp: 70, atk: 30, energyAtk: 20, def: 20, energyDef: 15,
      speed: 11, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'shock-cannon'],
  },
  'geno-saurer': {
    id: 'geno-saurer',
    weightClass: 'pesado',
    name: 'Geno Saurer',
    role: 'assault',
    moveType: 'ground',
    stats: {
      maxHp: 130, atk: 45, energyAtk: 65, def: 35, energyDef: 30,
      speed: 12, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['charged-particle-gun', 'bite-crush', 'e-shield'],
    aiProfile: { aggression: 0.6, selfPreservation: 0.6, riskTolerance: 0.7 },
    frame: [
      { slot: 'casco', moduleId: 'gsa-casco' },
      { slot: 'nucleo', moduleId: 'gsa-nucleo' },
      { slot: 'patas', moduleId: 'gsa-patas' },
      { slot: 'canon', moduleId: 'gsa-canon' },
      { slot: 'cola', moduleId: 'gsa-cola' },
    ],
  },

  // La Gun Sniper de Naomi: monocasco, pero con munición finita — cuatro
  // disparos por cargador y dos de repuesto (fase 2).
  'gun-sniper-naomi': {
    id: 'gun-sniper-naomi',
    weightClass: 'extraligero',
    vision: 8, // ojos de la noche
    name: 'Gun Sniper (custom)',
    role: 'sniper',
    moveType: 'ground',
    stats: {
      maxHp: 80, atk: 50, energyAtk: 25, def: 15, energyDef: 15,
      speed: 12, move: 4, jump: 1, evade: 10, accuracy: 0,
    },
    abilityIds: ['bite-crush'],
    weapons: ['w-sniper-rifle'],
    aiProfile: { aggression: 0.35, selfPreservation: 0.8, riskTolerance: 0.2 },
  },

  // ── Segunda generación del hangar (sesión nocturna): 12 chasis nuevos.
  //    Los que montan armas 'lib-*' requieren catálogos mezclados con
  //    withWeaponLibrary() — el cliente web ya los mezcla. ──

  'shield-liger': {
    id: 'shield-liger', name: 'Shield Liger', role: 'assault', moveType: 'ground',
    weightClass: 'pesado',
    stats: { maxHp: 130, atk: 42, energyAtk: 40, def: 38, energyDef: 42, speed: 14, move: 5, jump: 2, evade: 15, accuracy: 0 },
    abilityIds: ['bite-crush', 'e-shield'],
    weapons: ['lib-w-vibro-fang'],
    aiProfile: { aggression: 0.7, selfPreservation: 0.5, riskTolerance: 0.5 },
  },
  'blade-liger': {
    id: 'blade-liger', name: 'Blade Liger', role: 'assault', moveType: 'ground',
    weightClass: 'pesado',
    stats: { maxHp: 135, atk: 50, energyAtk: 52, def: 34, energyDef: 30, speed: 16, move: 6, jump: 2, evade: 18, accuracy: 0 },
    abilityIds: ['bite-crush', 'e-shield'],
    weapons: ['lib-w-thermal-saber'],
    aiProfile: { aggression: 0.85, selfPreservation: 0.35, riskTolerance: 0.65 },
  },
  'zaber-fang': {
    id: 'zaber-fang', name: 'Zaber Fang', role: 'skirmisher', moveType: 'ground',
    weightClass: 'ligero',
    // Nerf (2026-07-09): con el daño localizado su autocañón gemelo lo subió a
    // ~61% (castiga bien las piezas frágiles). atk 40→37: sigue siendo un
    // cerrador fuerte, dentro de banda.
    stats: { maxHp: 105, atk: 37, energyAtk: 32, def: 30, energyDef: 24, speed: 14, move: 5, jump: 2, evade: 14, accuracy: 0 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-twin-autocannon'],
    aiProfile: { aggression: 0.65, selfPreservation: 0.45, riskTolerance: 0.55 },
  },
  'iron-kong': {
    id: 'iron-kong', name: 'Iron Kong', role: 'tank', moveType: 'ground',
    weightClass: 'extrapesado',
    stats: { maxHp: 190, atk: 58, energyAtk: 35, def: 48, energyDef: 38, speed: 9, move: 3, jump: 2, evade: 4, accuracy: 0 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-gauss-hammer', 'lib-w-micro-missile-swarm'],
    aiProfile: { aggression: 0.6, selfPreservation: 0.5, riskTolerance: 0.4 },
    frame: [
      { slot: 'casco', moduleId: 'ik-casco' },
      { slot: 'nucleo', moduleId: 'ik-nucleo' },
      { slot: 'brazos', moduleId: 'ik-brazos' },
      { slot: 'piernas', moduleId: 'ik-piernas' },
      { slot: 'mochila', moduleId: 'ik-mochila' },
    ],
  },
  'dibison': {
    id: 'dibison', name: 'Dibison', role: 'tank', moveType: 'ground',
    weightClass: 'extrapesado',
    stats: { maxHp: 165, atk: 48, energyAtk: 28, def: 42, energyDef: 30, speed: 10, move: 4, jump: 1, evade: 6, accuracy: 0 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-cluster-mortar', 'lib-w-flak-burst'],
    aiProfile: { aggression: 0.5, selfPreservation: 0.55, riskTolerance: 0.45 },
  },
  'gordos': {
    id: 'gordos', name: 'Gordos', role: 'sniper', moveType: 'ground',
    weightClass: 'extrapesado',
    stats: { maxHp: 160, atk: 40, energyAtk: 30, def: 40, energyDef: 32, speed: 8, move: 3, jump: 1, evade: 4, accuracy: 5 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-rail-lance'],
    aiProfile: { aggression: 0.3, selfPreservation: 0.7, riskTolerance: 0.25 },
  },
  'redler': {
    id: 'redler', name: 'Redler', role: 'flyer', moveType: 'flying',
    weightClass: 'extraligero',
    vision: 8, // ojos de la noche
    stats: { maxHp: 90, atk: 36, energyAtk: 34, def: 18, energyDef: 22, speed: 16, move: 7, jump: 99, evade: 26, accuracy: 0 },
    abilityIds: ['stun-blade'],
    weapons: ['lib-w-plasma-carbine'],
    aiProfile: { aggression: 0.75, selfPreservation: 0.45, riskTolerance: 0.6 },
  },
  'storm-sworder': {
    id: 'storm-sworder', name: 'Storm Sworder', role: 'flyer', moveType: 'flying',
    weightClass: 'ligero',
    vision: 8, // ojos de la noche
    // Buff (2026-07-08): cazador aéreo frágil que muere cerrando distancia. +HP
    // y +evasión; la evasión alta además lo hace difícil de FIJAR con fuego
    // concentrado (la IA de foco castiga a los que se dejan clavar).
    stats: { maxHp: 140, atk: 46, energyAtk: 40, def: 25, energyDef: 26, speed: 17, move: 8, jump: 99, evade: 44, accuracy: 0 },
    abilityIds: ['stun-blade'],
    weapons: ['lib-w-plasma-axe'],
    aiProfile: { aggression: 0.85, selfPreservation: 0.5, riskTolerance: 0.7 },
  },
  'konig-wolf': {
    id: 'konig-wolf', name: 'König Wolf', role: 'sniper', moveType: 'ground',
    weightClass: 'ligero',
    vision: 9, // ojos de la noche
    stats: { maxHp: 110, atk: 42, energyAtk: 26, def: 28, energyDef: 26, speed: 12, move: 6, jump: 2, evade: 13, accuracy: 2 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-heat-needle'],
    aiProfile: { aggression: 0.45, selfPreservation: 0.65, riskTolerance: 0.3 },
  },
  'rev-raptor': {
    id: 'rev-raptor', name: 'Rev Raptor', role: 'skirmisher', moveType: 'ground',
    weightClass: 'ligero',
    // Buff (2026-07-08): asaltante melee de cristal (95% de bajas, 39.6% victoria).
    // +HP y +evasión para que llegue al cuerpo a cuerpo con algo de casco.
    stats: { maxHp: 105, atk: 38, energyAtk: 24, def: 20, energyDef: 16, speed: 15, move: 6, jump: 2, evade: 22, accuracy: 0 },
    abilityIds: ['bite-crush'],
    weapons: ['lib-w-monomolecular-claw'],
    aiProfile: { aggression: 0.8, selfPreservation: 0.3, riskTolerance: 0.6 },
  },
  'guysak': {
    id: 'guysak', name: 'Guysak', role: 'skirmisher', moveType: 'ground',
    weightClass: 'ligero',
    // Buff (2026-07-08): rompedor melee que debe cerrar bajo fuego y paga tempo
    // pesado con el pilote; +HP y +evasión para que llegue a pegar.
    stats: { maxHp: 115, atk: 46, energyAtk: 20, def: 26, energyDef: 18, speed: 12, move: 5, jump: 1, evade: 20, accuracy: 0 },
    abilityIds: ['bite-crush', 'stun-blade'],
    weapons: ['lib-w-pile-bunker'],
    aiProfile: { aggression: 0.6, selfPreservation: 0.4, riskTolerance: 0.5 },
  },
  'brachios': {
    id: 'brachios', name: 'Brachios', role: 'support', moveType: 'amphibious',
    weightClass: 'pesado',
    stats: { maxHp: 155, atk: 34, energyAtk: 40, def: 36, energyDef: 34, speed: 9, move: 4, jump: 1, evade: 8, accuracy: 0 },
    abilityIds: ['e-shield'],
    weapons: ['lib-w-arc-emitter', 'lib-w-smoke-mortar'],
    aiProfile: { aggression: 0.35, selfPreservation: 0.7, riskTolerance: 0.35 },
  },

  // ── Versiones framed (fase 1): mismo rendimiento intacto que sus
  //    equivalentes monocasco, pero con daño localizado por módulos. ──

  'liger-zero-cas': {
    id: 'liger-zero-cas',
    weightClass: 'ligero',
    name: 'Liger Zero CAS',
    role: 'assault',
    moveType: 'ground',
    // Núcleo desnudo: los módulos aportan el resto (ver data/modules.ts).
    stats: {
      maxHp: 120, atk: 25, energyAtk: 25, def: 30, energyDef: 25,
      speed: 12, move: 0, jump: 0, evade: 0, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'e-shield'],
    energy: { capacity: 80, outputPerTurn: 30 },
    heat: { max: 100, dissipationPerTurn: 25 },
    weapons: ['w-strike-laser-claw'],
    aiProfile: { aggression: 0.85, selfPreservation: 0.4, riskTolerance: 0.6 },
    frame: [
      { slot: 'head', moduleId: 'liger-head' },
      { slot: 'torso', moduleId: 'liger-torso' },
      { slot: 'legs-front', moduleId: 'liger-legs-front' },
      { slot: 'legs-rear', moduleId: 'liger-legs-rear' },
      { slot: 'weapon-claws', moduleId: 'strike-claws' },
      { slot: 'backpack', moduleId: 'ion-boosters' },
    ],
  },
  'geno-saurer-cp': {
    id: 'geno-saurer-cp',
    weightClass: 'pesado',
    name: 'Geno Saurer CP',
    role: 'assault',
    moveType: 'ground',
    stats: {
      maxHp: 130, atk: 35, energyAtk: 35, def: 35, energyDef: 30,
      speed: 8, move: 0, jump: 1, evade: 0, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'e-shield'],
    energy: { capacity: 120, outputPerTurn: 25 },
    heat: { max: 80, dissipationPerTurn: 15 },
    weapons: ['w-charged-particle-gun'],
    aiProfile: { aggression: 0.6, selfPreservation: 0.6, riskTolerance: 0.7 },
    frame: [
      { slot: 'head', moduleId: 'geno-head' },
      { slot: 'torso', moduleId: 'geno-torso' },
      { slot: 'leg-l', moduleId: 'geno-leg-l' },
      { slot: 'leg-r', moduleId: 'geno-leg-r' },
      { slot: 'weapon-cannon', moduleId: 'particle-intake' },
      { slot: 'tail', moduleId: 'geno-tail' },
    ],
  },

  // ── Unidades de escenario (sin precio: no aparecen en tiendas) ────────
  // PROVISIONAL — la dirección los rebautizará. Cabecilla de caza mayor:
  // bestia 2×2 que ancla los contratos de caza (objetivo: derribarla).
  'gran-brontes': {
    id: 'gran-brontes',
    weightClass: 'extrapesado',
    name: 'Gran Brontes',
    role: 'tank',
    moveType: 'ground',
    size: 2,
    stats: {
      maxHp: 340, atk: 60, energyAtk: 40, def: 44, energyDef: 36,
      speed: 9, move: 3, jump: 1, evade: 2, accuracy: 0,
    },
    abilityIds: ['bite-crush', 'missile-pod'],
    aiProfile: { aggression: 0.9, selfPreservation: 0.05, riskTolerance: 0.8 },
  },
  // PROVISIONAL — carga civil de los contratos de escolta: no actúa
  // (speed 0 nunca gana turno), solo hay que mantenerla en pie.
  'carguero-colono': {
    id: 'carguero-colono',
    weightClass: 'pesado',
    name: 'Carguero colono',
    role: 'support',
    moveType: 'ground',
    stats: {
      maxHp: 140, atk: 0, energyAtk: 0, def: 20, energyDef: 20,
      speed: 0, move: 0, jump: 0, evade: 0, accuracy: 0,
    },
    abilityIds: [],
  },
};
