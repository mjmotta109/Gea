import type { AbilityDefinition, WeaponDefinition } from '../core/types.js';

export type WeaponFamily = 'melee' | 'ballistic' | 'missile' | 'energy' | 'support' | 'control';
export type WeaponWeight = 'light' | 'medium' | 'heavy' | 'superheavy';

export interface WeaponLibraryEntry {
  weaponId: string;
  abilityId: string;
  family: WeaponFamily;
  weight: WeaponWeight;
  role: 'duelist' | 'skirmisher' | 'sniper' | 'breaker' | 'artillery' | 'support' | 'controller';
  tags: string[];
  notes: string;
}

/**
 * Catalogo anexo de habilidades para armas personalizables.
 *
 * Es deliberadamente independiente de ABILITIES: un cliente puede hacer
 * `{ ...ABILITIES, ...WEAPON_LIBRARY_ABILITIES }` sin cambiar el motor ni
 * los datos base. Los IDs usan el prefijo `lib-` para evitar colisiones.
 */
export const WEAPON_LIBRARY_ABILITIES: Record<string, AbilityDefinition> = {
  'lib-vibro-fang': {
    id: 'lib-vibro-fang',
    name: 'Colmillo vibratorio',
    description: 'Mordida de contacto con filo vibratorio para abrir blindaje ligero.',
    range: 1,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 92,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 42, damageType: 'physical' }],
  },
  'lib-thermal-saber': {
    id: 'lib-thermal-saber',
    name: 'Sable termico',
    description: 'Corte energetico de contacto con buena pegada contra escudos.',
    range: 1,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 86,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 48, damageType: 'energy' }],
  },
  'lib-twin-autocannon': {
    id: 'lib-twin-autocannon',
    name: 'Autocanon gemelo',
    description: 'Rafaga estable de medio alcance, precisa pero de bajo impacto individual.',
    range: 4,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 84,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 32, damageType: 'physical' }],
  },
  'lib-rail-lance': {
    id: 'lib-rail-lance',
    name: 'Lanza railgun',
    description: 'Proyectil perforante en linea; excelente para castigar corredores largos.',
    range: 7,
    minRange: 3,
    shape: 'line',
    aoeRadius: 0,
    accuracy: 82,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 54, damageType: 'physical' }],
  },
  'lib-gauss-hammer': {
    id: 'lib-gauss-hammer',
    name: 'Martillo Gauss',
    description: 'Canon pesado de impacto; lento, ruidoso y capaz de empujar al objetivo.',
    range: 5,
    minRange: 2,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 74,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 58, damageType: 'physical' }],
  },
  'lib-micro-missile-swarm': {
    id: 'lib-micro-missile-swarm',
    name: 'Enjambre de micromisiles',
    description: 'Saturacion de area pequena para rematar objetivos agrupados.',
    range: 5,
    minRange: 2,
    shape: 'single',
    aoeRadius: 1,
    accuracy: 72,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 26, damageType: 'physical' }],
  },
  'lib-plasma-carbine': {
    id: 'lib-plasma-carbine',
    name: 'Carabina de plasma',
    description: 'Arma energetica flexible para hostigar sin depender de municion.',
    range: 4,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 80,
    targetsAllies: false,
    effects: [{ kind: 'damage', power: 38, damageType: 'energy' }],
  },
  'lib-ion-lance': {
    id: 'lib-ion-lance',
    name: 'Lanza ionica',
    description: 'Haz en linea con probabilidad de aturdir sistemas expuestos.',
    range: 5,
    minRange: 2,
    shape: 'line',
    aoeRadius: 0,
    accuracy: 76,
    targetsAllies: false,
    effects: [
      { kind: 'damage', power: 34, damageType: 'energy' },
      { kind: 'status', status: 'stunned', duration: 1, chance: 25 },
    ],
  },
  'lib-heat-needle': {
    id: 'lib-heat-needle',
    name: 'Aguja termica',
    description: 'Disparo preciso que introduce calor residual en el objetivo.',
    range: 6,
    minRange: 2,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 86,
    targetsAllies: false,
    effects: [
      { kind: 'damage', power: 30, damageType: 'energy' },
      { kind: 'status', status: 'overheat', duration: 2, chance: 45 },
    ],
  },
  'lib-smoke-mortar': {
    id: 'lib-smoke-mortar',
    name: 'Mortero de humo',
    description: 'Municion de cobertura para aumentar la evasion de un aliado a distancia.',
    range: 5,
    minRange: 1,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 100,
    targetsAllies: true,
    effects: [{ kind: 'status', status: 'evasion-up', duration: 2, chance: 100 }],
  },
  'lib-field-repair-beam': {
    id: 'lib-field-repair-beam',
    name: 'Haz de reparacion de campo',
    description: 'Restauracion a distancia para unidades de apoyo con generador estable.',
    range: 4,
    minRange: 0,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 100,
    targetsAllies: true,
    effects: [{ kind: 'heal', power: 36 }],
  },
  'lib-barrier-projector': {
    id: 'lib-barrier-projector',
    name: 'Proyector de barrera',
    description: 'Pulso defensivo que refuerza el blindaje de un aliado o del propio usuario.',
    range: 3,
    minRange: 0,
    shape: 'single',
    aoeRadius: 0,
    accuracy: 100,
    targetsAllies: true,
    effects: [{ kind: 'status', status: 'armor-up', duration: 3, chance: 100 }],
  },
};

/**
 * Catalogo anexo de armas montadas. Ninguna arma define mountSlot por
 * defecto: asi puede usarse en unidades monocasco y framed. Si una campana
 * quiere que un arma dependa de un modulo, puede clonar la entrada y agregar
 * `mountSlot` en su propio catalogo.
 */
export const WEAPON_LIBRARY_WEAPONS: Record<string, WeaponDefinition> = {
  'lib-w-vibro-fang': {
    id: 'lib-w-vibro-fang',
    name: 'Colmillo vibratorio',
    abilityId: 'lib-vibro-fang',
    costs: { energy: 6, heat: 4 },
    magazine: 0,
    reserves: 0,
  },
  'lib-w-thermal-saber': {
    id: 'lib-w-thermal-saber',
    name: 'Sable termico',
    abilityId: 'lib-thermal-saber',
    costs: { energy: 14, heat: 12 },
    magazine: 0,
    reserves: 0,
    projectile: { velocity: 28, dispersion: 0, penetration: 2, caliber: 0, mass: 0, ricochet: false },
  },
  'lib-w-twin-autocannon': {
    id: 'lib-w-twin-autocannon',
    name: 'Autocanon gemelo',
    abilityId: 'lib-twin-autocannon',
    costs: { heat: 4 },
    magazine: 6,
    reserves: 3,
    projectile: { velocity: 14, dispersion: 1, penetration: 1, caliber: 35, mass: 1, ricochet: true },
  },
  'lib-w-rail-lance': {
    id: 'lib-w-rail-lance',
    name: 'Lanza railgun',
    abilityId: 'lib-rail-lance',
    costs: { energy: 12, heat: 14, cooldownTurns: 1 },
    magazine: 3,
    reserves: 2,
    projectile: { velocity: 24, dispersion: 0, penetration: 5, caliber: 55, mass: 2, ricochet: false },
  },
  'lib-w-gauss-hammer': {
    id: 'lib-w-gauss-hammer',
    name: 'Martillo Gauss',
    abilityId: 'lib-gauss-hammer',
    costs: { energy: 18, heat: 18, cooldownTurns: 1 },
    magazine: 2,
    reserves: 2,
    projectile: { velocity: 10, dispersion: 2, penetration: 3, caliber: 120, mass: 5, ricochet: false },
  },
  'lib-w-micro-missile-swarm': {
    id: 'lib-w-micro-missile-swarm',
    name: 'Enjambre de micromisiles',
    abilityId: 'lib-micro-missile-swarm',
    costs: { heat: 8, cooldownTurns: 1 },
    magazine: 4,
    reserves: 2,
    projectile: { velocity: 9, dispersion: 2, penetration: 0, caliber: 80, mass: 2, ricochet: false },
  },
  'lib-w-plasma-carbine': {
    id: 'lib-w-plasma-carbine',
    name: 'Carabina de plasma',
    abilityId: 'lib-plasma-carbine',
    costs: { energy: 16, heat: 18 },
    magazine: 0,
    reserves: 0,
    projectile: { velocity: 18, dispersion: 1, penetration: 2, caliber: 0, mass: 0, ricochet: false },
  },
  'lib-w-ion-lance': {
    id: 'lib-w-ion-lance',
    name: 'Lanza ionica',
    abilityId: 'lib-ion-lance',
    costs: { energy: 20, heat: 22, cooldownTurns: 1 },
    magazine: 0,
    reserves: 0,
    projectile: { velocity: 22, dispersion: 0, penetration: 3, caliber: 0, mass: 0, ricochet: false },
  },
  'lib-w-heat-needle': {
    id: 'lib-w-heat-needle',
    name: 'Aguja termica',
    abilityId: 'lib-heat-needle',
    costs: { energy: 10, heat: 10 },
    magazine: 4,
    reserves: 3,
    projectile: { velocity: 20, dispersion: 0, penetration: 2, caliber: 25, mass: 1, ricochet: false },
  },
  'lib-w-smoke-mortar': {
    id: 'lib-w-smoke-mortar',
    name: 'Mortero de humo',
    abilityId: 'lib-smoke-mortar',
    costs: { heat: 4 },
    magazine: 3,
    reserves: 2,
    projectile: { velocity: 7, dispersion: 3, penetration: 0, caliber: 90, mass: 1, ricochet: false },
  },
  'lib-w-field-repair-beam': {
    id: 'lib-w-field-repair-beam',
    name: 'Haz de reparacion de campo',
    abilityId: 'lib-field-repair-beam',
    costs: { energy: 18, heat: 8 },
    magazine: 0,
    reserves: 0,
  },
  'lib-w-barrier-projector': {
    id: 'lib-w-barrier-projector',
    name: 'Proyector de barrera',
    abilityId: 'lib-barrier-projector',
    costs: { energy: 14, heat: 6, cooldownTurns: 1 },
    magazine: 0,
    reserves: 0,
  },
};

export const WEAPON_LIBRARY_ENTRIES: Record<string, WeaponLibraryEntry> = {
  'lib-w-vibro-fang': {
    weaponId: 'lib-w-vibro-fang',
    abilityId: 'lib-vibro-fang',
    family: 'melee',
    weight: 'light',
    role: 'duelist',
    tags: ['contact', 'low-cost', 'armor-opener'],
    notes: 'Opcion de melee economica para chasis rapidos o grunts mejorados.',
  },
  'lib-w-thermal-saber': {
    weaponId: 'lib-w-thermal-saber',
    abilityId: 'lib-thermal-saber',
    family: 'energy',
    weight: 'medium',
    role: 'duelist',
    tags: ['contact', 'shield-breaker', 'heat'],
    notes: 'Melee energetico mas caro; premia flancos y espalda.',
  },
  'lib-w-twin-autocannon': {
    weaponId: 'lib-w-twin-autocannon',
    abilityId: 'lib-twin-autocannon',
    family: 'ballistic',
    weight: 'medium',
    role: 'skirmisher',
    tags: ['ammo', 'stable', 'mid-range'],
    notes: 'Arma de batalla general para Command Wolf, Molga elite o Gustav armado.',
  },
  'lib-w-rail-lance': {
    weaponId: 'lib-w-rail-lance',
    abilityId: 'lib-rail-lance',
    family: 'ballistic',
    weight: 'heavy',
    role: 'sniper',
    tags: ['line', 'penetration', 'cooldown'],
    notes: 'Alternativa al rifle: menos flexible, mas penetrante.',
  },
  'lib-w-gauss-hammer': {
    weaponId: 'lib-w-gauss-hammer',
    abilityId: 'lib-gauss-hammer',
    family: 'ballistic',
    weight: 'superheavy',
    role: 'breaker',
    tags: ['knockback', 'cooldown', 'anti-heavy'],
    notes: 'Arma de ruptura; su masa activa empuje con la fisica existente.',
  },
  'lib-w-micro-missile-swarm': {
    weaponId: 'lib-w-micro-missile-swarm',
    abilityId: 'lib-micro-missile-swarm',
    family: 'missile',
    weight: 'medium',
    role: 'artillery',
    tags: ['aoe', 'ammo', 'cooldown'],
    notes: 'Controla agrupaciones; dano individual moderado para no reemplazar cannons.',
  },
  'lib-w-plasma-carbine': {
    weaponId: 'lib-w-plasma-carbine',
    abilityId: 'lib-plasma-carbine',
    family: 'energy',
    weight: 'medium',
    role: 'skirmisher',
    tags: ['no-ammo', 'heat', 'energy-cost'],
    notes: 'Arma energetica de linea media para chasis con generador estable.',
  },
  'lib-w-ion-lance': {
    weaponId: 'lib-w-ion-lance',
    abilityId: 'lib-ion-lance',
    family: 'control',
    weight: 'heavy',
    role: 'controller',
    tags: ['line', 'stun', 'cooldown'],
    notes: 'Control de carriles; menos dano que una railgun, mas utilidad.',
  },
  'lib-w-heat-needle': {
    weaponId: 'lib-w-heat-needle',
    abilityId: 'lib-heat-needle',
    family: 'energy',
    weight: 'light',
    role: 'controller',
    tags: ['overheat', 'precision', 'ammo'],
    notes: 'Herramienta anti-generador para presionar unidades calientes.',
  },
  'lib-w-smoke-mortar': {
    weaponId: 'lib-w-smoke-mortar',
    abilityId: 'lib-smoke-mortar',
    family: 'support',
    weight: 'light',
    role: 'support',
    tags: ['ally-target', 'evasion', 'ammo'],
    notes: 'Soporte defensivo sin tocar nuevas reglas: reutiliza evasion-up.',
  },
  'lib-w-field-repair-beam': {
    weaponId: 'lib-w-field-repair-beam',
    abilityId: 'lib-field-repair-beam',
    family: 'support',
    weight: 'medium',
    role: 'support',
    tags: ['ally-target', 'repair', 'no-ammo'],
    notes: 'Soporte de reparacion compatible con HP global y frame modular.',
  },
  'lib-w-barrier-projector': {
    weaponId: 'lib-w-barrier-projector',
    abilityId: 'lib-barrier-projector',
    family: 'support',
    weight: 'medium',
    role: 'support',
    tags: ['ally-target', 'armor-up', 'cooldown'],
    notes: 'Buff defensivo declarativo; no requiere sistema nuevo.',
  },
};

export const WEAPON_LIBRARY_LOADOUTS: Record<string, string[]> = {
  striker: ['lib-w-vibro-fang', 'lib-w-thermal-saber'],
  skirmisher: ['lib-w-twin-autocannon', 'lib-w-plasma-carbine'],
  sniper: ['lib-w-rail-lance', 'lib-w-heat-needle'],
  breaker: ['lib-w-gauss-hammer', 'lib-w-micro-missile-swarm'],
  support: ['lib-w-field-repair-beam', 'lib-w-smoke-mortar', 'lib-w-barrier-projector'],
  controller: ['lib-w-ion-lance', 'lib-w-heat-needle', 'lib-w-smoke-mortar'],
};

export function withWeaponLibrary(
  abilityCatalog: Record<string, AbilityDefinition>,
  weaponCatalog: Record<string, WeaponDefinition>,
): { abilityCatalog: Record<string, AbilityDefinition>; weaponCatalog: Record<string, WeaponDefinition> } {
  return {
    abilityCatalog: { ...abilityCatalog, ...WEAPON_LIBRARY_ABILITIES },
    weaponCatalog: { ...weaponCatalog, ...WEAPON_LIBRARY_WEAPONS },
  };
}
