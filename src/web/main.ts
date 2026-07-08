/**
 * Cliente web jugable del motor, con flujo estilo XCOM:
 * seleccionar → previsualizar → confirmar, manejable por completo con
 * teclado (WASD/flechas + E/Enter) o ratón sobre el mismo cursor.
 *
 * Consume solo la API pública del motor (Battle + BattleEvent).
 * Build: npm run web  →  dist/web/gea.html (autocontenido).
 */
import { planTurn } from '../ai/simpleAi.js';
import { Battle, type ReinforcementWave, type UnitSpawn } from '../core/battle.js';
import { OVERCLOCK_ENGAGE_HEAT, HEAT_HIGH_THRESHOLD, HEAT_CRITICAL_THRESHOLD } from '../core/systems.js';
import { wearTier } from '../core/wear.js';
import { attackArc, type AttackArc } from '../core/combat.js';
import { GameMap, posKey, terrainLabel, TERRAIN_COVER } from '../core/grid.js';
import { reachableTiles, type ReachableTile } from '../core/pathfinding.js';
import {
  adjustStress, applyXp, awardXp, chooseSpecs, healInjury, injurePilot, isInjured, newPilot, observeBattle,
  recordPilotEvent, reframeQuirk, trackLevel,
  TRACK_LEVEL_THRESHOLDS, SPECIALIZATIONS,
  type PilotState, type SpecializationId,
} from '../core/progression.js';
import { STATUS_DEFINITIONS } from '../core/status.js';
import type { BattleEvent, BattleObjective, Facing, Position, Team, UnitState, WeatherId, FrameState,
} from '../core/types.js';
import { ABILITIES } from '../data/abilities.js';
import { BLUEPRINT_PRICES, CITY_TIERS, CONTRACT_ENEMY_POOL, DIFFICULTIES, ECONOMY, LEISURE_OPTIONS, STARTER_COMPANIONS, THERAPY } from '../data/economy.js';
import { VALLEY_CROSSING } from '../data/maps.js';
import { generateBattlefield } from '../game/mapgen.js';
import { adjustReputation, contractSlots, priceFactor, reputationTier, REPUTATION_MAX } from '../game/reputation.js';
import { FACTIONS, PLACE_FACTIONS } from '../data/factions.js';
import { ASSIGNMENT_SPECS } from '../data/assignments.js';
import {
  advanceAssignment, assignmentDone, finishAssignment, resolveAssignmentCall, startAssignment,
} from '../game/assignment.js';
import { playSfx, sfxEnabled, toggleSfx } from './sfx.js';
import { spriteBody, unitSprite } from './sprites.js';
import {
  drawDiorama, isoCanvasSize, isoPick, isoProjectView, ELEV_STEP,
  type DioramaScene, type DioramaTile, type DioramaUnit,
} from './iso.js';
import { GARAGE_MODULE_OPTIONS, MODULES } from '../data/modules.js';
import { PERKS } from '../data/progression.js';
import { withWeaponLibrary } from '../data/weaponLibrary.js';
import { WEAPONS } from '../data/weapons.js';
import { ZOIDS } from '../data/zoids.js';
import {
  armorRepairCost, buyBlueprint, buySupplies, buyWeapon, buyZoid, cityRepair, consumeSupplies,
  contractOffers, mountedCount, newCampaign, rebuildCost, rebuildZoid, reinforceArmor,
  reinforcementModifiers, repairArmor, repairCost, repairZoid, resolveContract, scarLevel,
  sellCargo, sellWeapon, serviceTier, setMountedWeapons, stashCargo, stripReinforcement,
  tavernJob, updateZoidRecord, zoidRecord,
  type CampaignState, type Contract,
} from '../game/mercenary.js';
import {
  canExplore, edgesTowardCivilization, exploreSite, neighbors, otherEnd,
  startExpedition, startFreeExpedition, travel, resolveEncounter, edgeKey,
  regionOf, linksFrom, linkDestination, useLink, weatherFor,
  isNodeVisible, isEdgeVisible,
  type ExpeditionState, type WorldEdge, type WorldRegion,
} from '../game/expedition.js';
import { SALT_PASS_REGION, WORLD_ATLAS } from '../data/world.js';
import { createSave, describeSave, serializeSave, validateSave, type SaveGame } from '../game/save.js';
import {
  bondExpedition, companionModifiers, newCompanion, observeCompanionBattle, recordCompanionEvent,
} from '../game/companion.js';
import { COMPANION_TABLE } from '../data/marks.js';

// Catálogos completos del cliente: base + anexo de la librería de armas.
// Los Zoids de segunda generación montan armas 'lib-*' y los necesitan.
const CATALOGS = withWeaponLibrary(ABILITIES, WEAPONS);

// ── Estado de la aplicación ──────────────────────────────────────────────

type Mode =
  | { kind: 'idle' }
  | { kind: 'move'; tiles: Map<string, ReachableTile>; shotsFrom: Map<string, string[]> }
  | { kind: 'boost'; tiles: Map<string, ReachableTile>; shotsFrom: Map<string, string[]> }
  | { kind: 'ability'; abilityId: string; targets: Set<string> }
  | { kind: 'facing' };

let battle: Battle;
let mode: Mode = { kind: 'idle' };
/** Posición del cursor de tablero (compartido por ratón y teclado). */
let cursor: Position = { x: 0, y: 0 };
/** Objetivo seleccionado pendiente de confirmación (flujo en dos pasos). */
let pending: Position | null = null;
/** SOBREMARCHA armada: el próximo golpe pega ×1.5 a costa del próximo turno. */
let overdriveArmed = false;
/** true mientras la IA enemiga anima su turno: bloquea la entrada. */
let busy = false;
/** Animación pendiente de movimiento: la ficha recorre su camino. */
let pendingMoveAnim: { unitId: string; path: Position[] } | null = null;
/** Unidades golpeadas en el último lote de eventos: destello de impacto. */
let pendingHits = new Set<string>();

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (id: string): HTMLElement => document.getElementById(id)!;

const FACING_ARROW: Record<Facing, string> = { north: '▲', east: '▶', south: '▼', west: '◀' };
const ARC_LABEL: Record<AttackArc, string> = { front: 'FRENTE', side: 'FLANCO', back: 'ESPALDA' };
const FACING_OFFSET: Record<Facing, Position> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};

// ── Garaje y pilotos persistentes ────────────────────────────────────────

/** Configuración de un hueco del equipo del jugador (persistida). */
interface SlotConfig {
  unitTypeId: string;
  weapons: string[];
  /** Módulos sustituidos por slot del frame (solo chasis framed). */
  slots: Record<string, string>;
}

const PLAYER_IDS = ['P1', 'P2', 'P3', 'P4'] as const;
const PILOT_IDS = ['pilot-1', 'pilot-2', 'pilot-3', 'pilot-4'] as const;
const DEFAULT_PILOT_NAMES = ['Van', 'Irvine', 'Moonbay', 'Fiona'];
const SPEC_LABEL: Record<SpecializationId, string> = {
  assault: 'Asalto', sniper: 'Tirador', support: 'Soporte', defense: 'Defensa',
};
const GARAGE_KEY = 'gea-garage-v1';
const PILOTS_KEY = 'gea-pilots-v1';

function factorySlot(unitTypeId: string): SlotConfig {
  return { unitTypeId, weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])], slots: {} };
}

const DEFAULT_TEAM = ['liger-zero-cas', 'command-wolf', 'gun-sniper-naomi', 'gustav'];

/** Armas del catálogo montables en un chasis (mountSlot exige ese slot). */
function compatibleWeapons(unitTypeId: string): string[] {
  const def = ZOIDS[unitTypeId]!;
  return Object.values(CATALOGS.weaponCatalog)
    .filter((w) => !w.mountSlot || def.frame?.some((e) => e.slot === w.mountSlot))
    .map((w) => w.id)
    .sort((a, b) => CATALOGS.weaponCatalog[a]!.name.localeCompare(CATALOGS.weaponCatalog[b]!.name));
}

/** Valida un hueco guardado contra los catálogos actuales. */
function sanitizeSlot(raw: unknown, fallbackType: string): SlotConfig {
  const candidate = (raw ?? {}) as Partial<SlotConfig>;
  const unitTypeId = candidate.unitTypeId && ZOIDS[candidate.unitTypeId] ? candidate.unitTypeId : fallbackType;
  const def = ZOIDS[unitTypeId]!;
  const legal = new Set(compatibleWeapons(unitTypeId));
  const weapons = Array.isArray(candidate.weapons)
    ? candidate.weapons.filter((w) => legal.has(w)).slice(0, 3)
    : [...(def.weapons ?? [])];
  const slots: Record<string, string> = {};
  if (candidate.slots && typeof candidate.slots === 'object') {
    for (const [slot, moduleId] of Object.entries(candidate.slots)) {
      if (def.frame?.some((e) => e.slot === slot) && MODULES[moduleId]) slots[slot] = moduleId;
    }
  }
  return { unitTypeId, weapons, slots };
}

function loadGarage(): SlotConfig[] {
  try {
    const stored = JSON.parse(localStorage.getItem(GARAGE_KEY) ?? '[]') as unknown[];
    return DEFAULT_TEAM.map((type, i) => sanitizeSlot(stored[i], type));
  } catch {
    return DEFAULT_TEAM.map(factorySlot);
  }
}

function loadPilots(): Record<string, PilotState> {
  const pilots: Record<string, PilotState> = {};
  let stored: Record<string, PilotState> = {};
  try {
    stored = JSON.parse(localStorage.getItem(PILOTS_KEY) ?? '{}') as Record<string, PilotState>;
  } catch { /* almacenamiento corrupto: pilotos nuevos */ }
  PILOT_IDS.forEach((id, i) => {
    const raw = stored[id];
    const pilot = newPilot(id, typeof raw?.name === 'string' && raw.name.trim() ? raw.name : DEFAULT_PILOT_NAMES[i]!);
    for (const spec of Object.keys(pilot.tracks) as SpecializationId[]) {
      const xp = raw?.tracks?.[spec];
      if (typeof xp === 'number' && xp >= 0) pilot.tracks[spec] = Math.round(xp);
    }
    if (Array.isArray(raw?.quirks)) pilot.quirks = raw.quirks.filter((q) => typeof q === 'string');
    if (raw?.memory && typeof raw.memory === 'object') pilot.memory = { ...raw.memory };
    if (typeof raw?.stress === 'number') pilot.stress = Math.max(0, Math.min(100, Math.round(raw.stress)));
    if (typeof raw?.injuryDays === 'number') pilot.injuryDays = Math.max(0, Math.round(raw.injuryDays));
    // Árbol nuevo: guardados de antes reciben la básica (un cuarto de lo
    // vivido) y sus especializaciones (la dominante + la segunda real).
    if (typeof raw?.basics === 'number' && raw.basics >= 0) {
      pilot.basics = Math.round(raw.basics);
    } else {
      const total = SPECIALIZATIONS.reduce((n, s) => n + pilot.tracks[s], 0);
      pilot.basics = Math.round(total * 0.25);
    }
    if (raw?.mainSpec && SPECIALIZATIONS.includes(raw.mainSpec)) {
      pilot.mainSpec = raw.mainSpec;
      if (raw.sideSpec && SPECIALIZATIONS.includes(raw.sideSpec) && raw.sideSpec !== raw.mainSpec) {
        pilot.sideSpec = raw.sideSpec;
      }
    } else {
      const total = SPECIALIZATIONS.reduce((n, s) => n + pilot.tracks[s], 0);
      if (total > 0) {
        const sorted = [...SPECIALIZATIONS].sort((a, b) => pilot.tracks[b] - pilot.tracks[a]);
        pilot.mainSpec = sorted[0];
        if (pilot.tracks[sorted[1]!] > 0) pilot.sideSpec = sorted[1];
      } // novato de verdad: elegirá en el cuartel
    }
    pilots[id] = pilot;
  });
  return pilots;
}

let garage: SlotConfig[] = loadGarage();
let pilots: Record<string, PilotState> = loadPilots();

function saveGarage(): void {
  try { localStorage.setItem(GARAGE_KEY, JSON.stringify(garage)); } catch { /* privado */ }
}
function savePilots(): void {
  try { localStorage.setItem(PILOTS_KEY, JSON.stringify(pilots)); } catch { /* privado */ }
}

function spawnLoadout(config: SlotConfig): UnitSpawn['loadout'] {
  return {
    weapons: config.weapons,
    ...(Object.keys(config.slots).length > 0 ? { slots: { ...config.slots } } : {}),
  };
}

/**
 * Equipo enemigo determinista por semilla: un comandante y tres escoltas
 * del hangar. La variedad es del cliente; el motor solo ve los spawns.
 */
function enemyTeam(seed: number): UnitSpawn[] {
  let state = (seed ^ 0x9e3779b9) >>> 0;
  const next = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const commanders = ['geno-saurer-cp', 'iron-kong', 'blade-liger'];
  const escorts = ['molga', 'pteras', 'zaber-fang', 'rev-raptor', 'guysak', 'redler', 'dibison', 'gordos', 'konig-wolf', 'shield-liger'];
  const commander = commanders[Math.floor(next() * commanders.length)]!;
  const pool = [...escorts];
  const picks: string[] = [];
  for (let i = 0; i < 3; i++) {
    picks.push(pool.splice(Math.floor(next() * pool.length), 1)[0]!);
  }
  return [commander, ...picks].map((unitTypeId, i) => ({
    id: `E${i + 1}`,
    name: ZOIDS[unitTypeId]!.name,
    unitTypeId,
    team: 'enemy' as Team,
    position: ENEMY_POSITIONS[i]!,
    ...(i === 0 ? { commander: true } : {}),
  }));
}

/** Contexto de la batalla en curso para repartir XP al terminar. */
let allEvents: BattleEvent[] = [];
let startPositions: Record<string, Position> = {};
let unitTeams: Record<string, Team> = {};
let xpAwarded = false;

const PLAYER_POSITIONS: Position[] = [{ x: 1, y: 3 }, { x: 0, y: 5 }, { x: 1, y: 7 }, { x: 0, y: 4 }];
const ENEMY_POSITIONS: Position[] = [{ x: 10, y: 3 }, { x: 11, y: 5 }, { x: 10, y: 6 }, { x: 11, y: 2 }];

// ── Mapas personalizados (editor) ────────────────────────────────────────

/** Mapa de usuario: filas en el formato ASCII del motor + spawns. */
interface CustomMap {
  name: string;
  rows: string[];
  playerSpawns: Position[];
  enemySpawns: Position[];
}

const MAPS_KEY = 'gea-maps-v1';
const MAP_SEL_KEY = 'gea-map-sel';

function loadCustomMaps(): Record<string, CustomMap> {
  try {
    const stored = JSON.parse(localStorage.getItem(MAPS_KEY) ?? '{}') as Record<string, CustomMap>;
    const valid: Record<string, CustomMap> = {};
    for (const [name, map] of Object.entries(stored)) {
      try {
        GameMap.fromAscii(map.rows); // valida el formato
        if (map.playerSpawns.length === 4 && map.enemySpawns.length === 4) valid[name] = map;
      } catch { /* mapa corrupto: se descarta */ }
    }
    return valid;
  } catch {
    return {};
  }
}

let customMaps = loadCustomMaps();
let currentMapName = localStorage.getItem(MAP_SEL_KEY) ?? '';

function saveCustomMaps(): void {
  try {
    localStorage.setItem(MAPS_KEY, JSON.stringify(customMaps));
    localStorage.setItem(MAP_SEL_KEY, currentMapName);
  } catch { /* almacenamiento privado */ }
}

/** Nombre reservado del modo procedural en el selector de mapas. */
const GEN_MAP = '__gen__';

/** Tamaño de campo del generador para cada tipo de contrato. */
const MAPGEN_TIER: Record<Contract['tier'], 'escolta' | 'asalto' | 'caza'> = {
  escolta: 'escolta', asalto: 'asalto', caza: 'caza',
  incursion: 'asalto', defensa: 'escolta',
};

/** Convierte un mapa generado al formato de campo listo para batalla. */
function generatedField(key: string, tier?: Contract['tier']): { map: GameMap; playerPos: Position[]; enemyPos: Position[] } {
  const gen = generateBattlefield(key, tier ? { tier: MAPGEN_TIER[tier] } : {});
  return { map: GameMap.fromAscii(gen.rows), playerPos: gen.playerSpawns, enemyPos: gen.enemySpawns };
}

/** Campo de batalla activo: el mapa elegido en la cabecera, o el valle. */
function battlefield(genKey?: string): { map: GameMap; playerPos: Position[]; enemyPos: Position[] } {
  if (currentMapName === GEN_MAP) {
    // Procedural: la semilla de la cabecera manda — cámbiala y el campo cambia.
    return generatedField(genKey ?? ($('seed') as HTMLInputElement).value);
  }
  const custom = customMaps[currentMapName];
  if (custom) {
    try {
      return {
        map: GameMap.fromAscii(custom.rows),
        playerPos: custom.playerSpawns,
        enemyPos: custom.enemySpawns,
      };
    } catch { /* cae al valle */ }
  }
  return { map: VALLEY_CROSSING, playerPos: PLAYER_POSITIONS, enemyPos: ENEMY_POSITIONS };
}

function refreshMapSelect(): void {
  const select = $('map-select') as HTMLSelectElement;
  select.innerHTML = '';
  const valley = document.createElement('option');
  valley.value = '';
  valley.textContent = 'Valle del cruce';
  select.appendChild(valley);
  const gen = document.createElement('option');
  gen.value = GEN_MAP;
  gen.textContent = '🎲 Procedural (según semilla)';
  select.appendChild(gen);
  for (const name of Object.keys(customMaps).sort()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  }
  select.value = currentMapName === GEN_MAP ? GEN_MAP
    : customMaps[currentMapName] ? currentMapName : '';
}

/** Escaramuza libre: el equipo del garaje contra un equipo por semilla. */
function newBattle(seed: number, weather: WeatherId): void {
  activeContract = null; // empezar escaramuza abandona el contrato en curso
  deployedSlots = [];
  returnToMerc = false;
  const field = battlefield();
  const spawns: UnitSpawn[] = [
    ...garage.map((config, i) => ({
      id: PLAYER_IDS[i]!,
      name: ZOIDS[config.unitTypeId]!.name,
      unitTypeId: config.unitTypeId,
      team: 'player' as Team,
      position: field.playerPos[i]!,
      loadout: spawnLoadout(config),
      ...(i === 0 ? { commander: true } : {}),
    })),
    ...enemyTeam(seed).map((s, i) => ({ ...s, position: field.enemyPos[i]! })),
  ];
  startBattle(spawns, seed, weather, field.map);
}

interface BattleBrief {
  objective?: BattleObjective;
  reinforcements?: ReinforcementWave[];
  /** Línea de briefing que abre el registro táctico. */
  briefing?: string;
}

/**
 * Severidad del desgaste según la dificultad de la campaña. Sin campaña
 * (escaramuza) rige el desgaste base (Mercenario): cada impacto pesa, pero
 * sin castigo extra. No infla HP: escala cuánto degrada el daño acumulado.
 */
function campaignWear(): number {
  const id = campaign?.difficulty ?? 'mercenario';
  return DIFFICULTIES.find((d) => d.id === id)?.wear ?? 1;
}

function startBattle(
  spawns: UnitSpawn[], seed: number, weather: WeatherId, map: GameMap, brief: BattleBrief = {},
): void {
  battle = new Battle({
    map,
    unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog,
    moduleCatalog: MODULES,
    weaponCatalog: CATALOGS.weaponCatalog,
    weather,
    wear: campaignWear(),
    seed,
    spawns,
    ...(brief.objective ? { objective: brief.objective } : {}),
    ...(brief.reinforcements ? { reinforcements: brief.reinforcements } : {}),
    // El id Pn conserva el hueco n aunque falten unidades (campaña con
    // bajas): el piloto n siempre tripula el hueco n. Las unidades de
    // escenario (W1, el carguero) no llevan piloto.
    pilots: Object.fromEntries(
      spawns.filter((s) => s.team === 'player' && /^P\d+$/.test(s.id))
        .map((s) => [s.id, pilots[PILOT_IDS[Number(s.id.slice(1)) - 1]!]!])),
    perkTable: PERKS,
  });
  allEvents = [];
  startPositions = Object.fromEntries(spawns.map((s) => [s.id, { ...s.position }]));
  unitTeams = Object.fromEntries(spawns.map((s) => [s.id, s.team]));
  xpAwarded = false;
  mode = { kind: 'idle' };
  pending = null;
  busy = false;
  $('log').innerHTML = '';
  $('overlay').classList.remove('show');
  log('— enlace táctico establecido —', 'turn');
  if (brief.briefing) log(`🎯 ${brief.briefing}`, 'turn');
  advance();
}

// ── Bucle de turnos ──────────────────────────────────────────────────────

function advance(): void {
  if (battle.isOver) { renderAll(); showOverlay(); return; }
  if (!battle.getActiveUnit()) {
    logEvents(battle.nextTurn());
  }
  if (battle.isOver) { renderAll(); showOverlay(); return; }

  const active = battle.getActiveUnit();
  if (!active) { renderAll(); return; }
  overdriveArmed = false; // defensa: la sobremarcha nunca cruza de turno/unidad

  if (active.team === 'enemy') {
    mode = { kind: 'idle' };
    pending = null;
    renderAll();
    runEnemyTurn(active);
  } else {
    cursor = { ...active.position };
    pending = null;
    // Estilo XCOM: el turno abre directamente en modo movimiento.
    if (!active.hasMoved && battle.checkVetoes({ type: 'move', unitId: active.id, to: active.position }) === null) {
      enterMove();
    } else {
      mode = { kind: 'idle' };
      renderAll();
    }
  }
}

function runEnemyTurn(unit: UnitState): void {
  busy = true;
  const actions = planTurn(battle, unit);
  let i = 0;
  const step = (): void => {
    // El turno pudo cerrarse solo (contraataque letal al propio actor).
    if (battle.isOver || i >= actions.length || battle.getActiveUnit()?.id !== unit.id) {
      busy = false;
      advance();
      return;
    }
    try {
      logEvents(battle.execute(actions[i]!));
    } catch (error) {
      log(`⚠ IA enemiga: ${(error as Error).message}`, 'warn');
      if (battle.getActiveUnit()?.id === unit.id) {
        logEvents(battle.execute({ type: 'wait', unitId: unit.id }));
      }
      i = actions.length;
    }
    i++;
    renderAll();
    window.setTimeout(step, 320);
  };
  window.setTimeout(step, 320);
}

// ── Modos de acción ──────────────────────────────────────────────────────

function playerUnit(): UnitState | undefined {
  const active = battle.getActiveUnit();
  return active && active.team === 'player' && !busy ? active : undefined;
}

/**
 * Enemigos a tiro desde una posición hipotética, con las armas que la
 * unidad puede pagar ahora mismo (los vetos no dependen de la posición).
 * Es el indicador ⌖ de "desde aquí tienes disparo" al planear movimiento.
 */
function shotsFromTile(unit: UnitState, from: Position): string[] {
  if (unit.hasActed) return [];
  const enemies = battle.units.filter((u) => u.team !== unit.team && u.hp > 0);
  const abilities = battle.knownAbilityIds(unit)
    .map((id) => battle.abilityOf(id))
    .filter((a) => a.effects.some((e) => e.kind === 'damage'))
    .filter((a) => battle.checkVetoes({
      type: 'ability', unitId: unit.id, abilityId: a.id, target: unit.position,
    }) === null);

  const shots: string[] = [];
  for (const enemy of enemies) {
    const usable = abilities.filter((ability) =>
      battle.canTargetFrom(unit, from, ability.id, enemy.position));
    if (usable.length > 0) {
      shots.push(`${enemy.id} (${usable.map((a) => a.name).join(', ')})`);
    }
  }
  return shots;
}

function computeShotsFrom(unit: UnitState, tiles: Map<string, ReachableTile>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const [key, tile] of tiles) {
    const shots = shotsFromTile(unit, tile.pos);
    if (shots.length > 0) result.set(key, shots);
  }
  return result;
}

function enterMove(): void {
  const unit = playerUnit();
  if (!unit || unit.hasMoved) return;
  const tiles = new Map<string, ReachableTile>();
  for (const tile of battle.legalMoves(unit.id)) tiles.set(posKey(tile.pos), tile);
  mode = { kind: 'move', tiles, shotsFrom: computeShotsFrom(unit, tiles) };
  pending = null;
  renderAll();
}

function enterBoost(): void {
  const unit = playerUnit();
  const energy = unit?.components.energy;
  if (!unit || !energy || energy.boostedThisTurn) return;
  if (battle.checkVetoes({ type: 'boost', unitId: unit.id, to: unit.position })) return;
  const stats = battle.effectiveStats(unit);
  const tiles = new Map<string, ReachableTile>();
  for (const tile of reachableTiles(battle.map, unit.position, {
    move: Math.max(1, Math.ceil(stats.move / 2)),
    jump: stats.jump,
    moveType: battle.definitionOf(unit.unitTypeId).moveType,
    team: unit.team,
  }, battle.units)) {
    if (!samePosition(tile.pos, unit.position)) tiles.set(posKey(tile.pos), tile);
  }
  mode = { kind: 'boost', tiles, shotsFrom: computeShotsFrom(unit, tiles) };
  pending = null;
  renderAll();
}

function enterAbility(abilityId: string): void {
  const unit = playerUnit();
  if (!unit || unit.hasActed) return;
  if (battle.checkVetoes({ type: 'ability', unitId: unit.id, abilityId, target: unit.position })) return;
  const targets = new Set<string>();
  for (const pos of battle.legalTargets(unit.id, abilityId)) targets.add(posKey(pos));
  mode = { kind: 'ability', abilityId, targets };
  pending = null;
  renderAll();
}

function enterFacing(): void {
  if (!playerUnit()) return;
  mode = { kind: 'facing' };
  pending = null;
  renderAll();
}

function cancel(): void {
  if (!playerUnit()) return;
  if (overdriveArmed) { overdriveArmed = false; log('sobremarcha desarmada'); renderAll(); return; }
  if (pending) { pending = null; renderAll(); return; }
  if (mode.kind !== 'idle') { mode = { kind: 'idle' }; renderAll(); }
}

function doReload(): void {
  const unit = playerUnit();
  if (!unit || unit.hasActed) return;
  const weapon = firstReloadable(unit);
  if (!weapon) return;
  try {
    logEvents(battle.execute({ type: 'reload', unitId: unit.id, weaponId: weapon }));
  } catch (error) {
    log(`⚠ ${(error as Error).message}`, 'warn');
  }
  mode = { kind: 'idle' };
  renderAll();
}

function doWait(facing?: Facing): void {
  const unit = playerUnit();
  if (!unit) return;
  logEvents(battle.execute({ type: 'wait', unitId: unit.id, facing }));
  mode = { kind: 'idle' };
  pending = null;
  overdriveArmed = false; // no sobrevive al turno
  advance();
}

/** Vigilancia: cierra el turno al acecho (la tecla V también llega aquí). */
function doOverwatch(): void {
  const unit = playerUnit();
  if (!unit || unit.hasActed) return;
  logEvents(battle.execute({ type: 'overwatch', unitId: unit.id }));
  mode = { kind: 'idle' };
  pending = null;
  overdriveArmed = false; // no sobrevive al turno (vigilar lo cierra)
  advance();
}

/**
 * Arma/desarma la SOBREMARCHA (tecla X): el próximo golpe pega ×1.5 a costa
 * de ceder el próximo turno (recargo brutal de tempo). Solo tiene sentido
 * con un arma seleccionada; se anuncia en el registro para que sea legible.
 */
function toggleOverdrive(): void {
  const unit = playerUnit();
  if (!unit) return;
  overdriveArmed = !overdriveArmed;
  log(overdriveArmed
    ? '⚡ SOBREMARCHA armada: el próximo golpe pega ×1.5 y cederás el próximo turno'
    : 'sobremarcha desarmada', overdriveArmed ? 'warn' : undefined);
  renderAll();
}

/** Sobrecarga del reactor: acción libre (tecla O). Solo con reactor. */
function doOverclock(): void {
  const unit = playerUnit();
  if (!unit || !unit.components.energy || !unit.components.heat) return;
  const on = !(unit.overclocked ?? false);
  logEvents(battle.execute({ type: 'overclock', unitId: unit.id, on }));
  renderAll();
}

function firstReloadable(unit: UnitState): string | undefined {
  return unit.components.arsenal?.weapons.find((w) => {
    const def = battle.weaponOf(w.weaponId);
    return def.magazine > 0 && w.ammo < def.magazine && w.reserves > 0;
  })?.weaponId;
}

// ── Cursor y confirmación (ratón y teclado convergen aquí) ──────────────

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function setCursor(pos: Position): void {
  if (samePosition(cursor, pos)) return;
  cursor = pos;
  renderBoard();
  renderPreview();
}

function moveCursor(dx: number, dy: number): void {
  setCursor({
    x: Math.max(0, Math.min(battle.map.width - 1, cursor.x + dx)),
    y: Math.max(0, Math.min(battle.map.height - 1, cursor.y + dy)),
  });
}

/** Confirmación en el cursor: mover/boost ejecutan; atacar pide 2 pasos. */
function confirm(): void {
  const unit = playerUnit();
  if (!unit) return;
  const key = posKey(cursor);

  try {
    if (mode.kind === 'move' && mode.tiles.has(key)) {
      logEvents(battle.execute({ type: 'move', unitId: unit.id, to: cursor }));
      afterAction();
    } else if (mode.kind === 'boost' && mode.tiles.has(key)) {
      logEvents(battle.execute({ type: 'boost', unitId: unit.id, to: cursor }));
      afterAction();
    } else if (mode.kind === 'ability' && mode.targets.has(key)) {
      if (pending && samePosition(pending, cursor)) {
        const ability = battle.abilityOf(mode.abilityId);
        const offensive = ability.effects.some((e) => e.kind === 'damage');
        const overdrive = overdriveArmed && offensive;
        logEvents(battle.execute({ type: 'ability', unitId: unit.id, abilityId: mode.abilityId, target: cursor, overdrive }));
        pending = null;
        overdriveArmed = false;
        afterAction();
      } else {
        pending = { ...cursor }; // primer paso: seleccionar y analizar
        renderAll();
      }
    } else if (mode.kind === 'facing') {
      doWait();
    }
  } catch (error) {
    log(`⚠ ${(error as Error).message}`, 'warn');
    mode = { kind: 'idle' };
    pending = null;
    renderAll();
  }
}

/** Tras mover/atacar: decide el siguiente modo útil sin cerrar el turno. */
function afterAction(): void {
  if (battle.isOver) { renderAll(); showOverlay(); return; }
  const unit = playerUnit();
  if (!unit) { advance(); return; }
  cursor = { ...unit.position };
  mode = { kind: 'idle' };
  pending = null;
  renderAll();
}

// ── Diálogos propios ─────────────────────────────────────────────────────
// El visor embebido (artifact) corre el juego en un iframe aislado donde
// window.confirm/prompt/alert están bloqueados y devuelven false/null en
// silencio. Todo pasa por este diálogo del propio juego.

let dlgResolve: ((value: string | null) => void) | null = null;

function dlgShow(message: string, opts: { input?: string; cancelable?: boolean } = {}): Promise<string | null> {
  // Si hubiera uno abierto, se cancela: nunca dos diálogos apilados.
  dlgResolve?.(null);
  $('dlg-msg').textContent = message;
  const input = $('dlg-input') as HTMLInputElement;
  if (opts.input !== undefined) {
    input.style.display = 'block';
    input.value = opts.input;
  } else {
    input.style.display = 'none';
    input.value = '';
  }
  ($('dlg-cancel') as HTMLElement).style.display = opts.cancelable === false ? 'none' : '';
  $('dlg').classList.add('show');
  if (opts.input !== undefined) { input.focus(); input.select(); }
  return new Promise((resolve) => { dlgResolve = resolve; });
}

function dlgFinish(accepted: boolean): void {
  const resolve = dlgResolve;
  dlgResolve = null;
  $('dlg').classList.remove('show');
  const input = $('dlg-input') as HTMLInputElement;
  resolve?.(accepted ? (input.style.display === 'none' ? '' : input.value) : null);
}

function dlgOpen(): boolean { return dlgResolve !== null; }

function uiAlert(message: string): Promise<void> {
  return dlgShow(message, { cancelable: false }).then(() => undefined);
}
function uiConfirm(message: string): Promise<boolean> {
  return dlgShow(message).then((v) => v !== null);
}
function uiPrompt(message: string, initial: string): Promise<string | null> {
  return dlgShow(message, { input: initial });
}

$('dlg-ok').addEventListener('click', () => dlgFinish(true));
$('dlg-cancel').addEventListener('click', () => dlgFinish(false));

/** true mientras hay una elección OBLIGATORIA en pantalla (sin escape). */
let dlgChoiceMode = false;

/**
 * Elección con opciones: obligatoria, sin Aceptar/Cancelar. Devuelve el
 * id de la opción pulsada (también con las teclas 1-9).
 */
function uiChoice(prompt: string, options: Array<{ id: string; label: string; detail: string }>): Promise<string> {
  dlgResolve?.(null);
  $('dlg-msg').textContent = prompt;
  ($('dlg-input') as HTMLElement).style.display = 'none';
  ($('dlg-ok') as HTMLElement).style.display = 'none';
  ($('dlg-cancel') as HTMLElement).style.display = 'none';
  const host = $('dlg-opts');
  host.innerHTML = '';
  dlgChoiceMode = true;
  playSfx('choice');
  $('dlg').classList.add('show');
  return new Promise((resolve) => {
    const finish = (id: string): void => {
      dlgChoiceMode = false;
      dlgResolve = null;
      host.innerHTML = '';
      ($('dlg-ok') as HTMLElement).style.display = '';
      $('dlg').classList.remove('show');
      resolve(id);
    };
    // dlgResolve ocupado: dlgOpen() bloquea el resto del teclado.
    dlgResolve = () => { /* inescapable: solo las opciones cierran */ };
    options.forEach((option, i) => {
      const btn = document.createElement('button');
      btn.innerHTML = `${i + 1}. ${escapeHtml(option.label)}<span class="odet">${escapeHtml(option.detail)}</span>`;
      btn.addEventListener('click', () => finish(option.id));
      host.appendChild(btn);
    });
    choiceKeys = (digit) => {
      const option = options[digit - 1];
      if (option) finish(option.id);
    };
  });
}

/** Selección por teclado (1-9) de la elección en curso. */
let choiceKeys: ((digit: number) => void) | null = null;

/**
 * Selector de FORMACIÓN: alterna miembros y confirma. El hueco 0 (tu
 * compañera) va siempre: tú ERES el piloto 1. Devuelve los huecos
 * elegidos o null si se cancela.
 */
function uiParty(
  prompt: string,
  options: Array<{ slot: number; label: string; detail: string }>,
  preselected: number[],
): Promise<number[] | null> {
  dlgResolve?.(null);
  $('dlg-msg').textContent = prompt;
  ($('dlg-input') as HTMLElement).style.display = 'none';
  ($('dlg-ok') as HTMLElement).style.display = '';
  ($('dlg-cancel') as HTMLElement).style.display = '';
  const host = $('dlg-opts');
  host.innerHTML = '';
  const chosen = new Set<number>([0, ...preselected.filter((n) => n !== 0)]);
  $('dlg').classList.add('show');
  return new Promise((resolve) => {
    const paint = (btn: HTMLButtonElement, slot: number): void => {
      btn.style.borderColor = chosen.has(slot) ? 'var(--player)' : 'var(--line)';
      btn.style.opacity = chosen.has(slot) ? '1' : '0.55';
    };
    // El hueco 0 se muestra fijo, sin botón: la compañera no se queda.
    host.insertAdjacentHTML('beforeend',
      `<div class="cnote" style="font-family:var(--mono);font-size:10px;color:var(--player);margin-bottom:6px">❤ Tu compañera va siempre: tú pilotas.</div>`);
    for (const option of options) {
      const btn = document.createElement('button');
      btn.innerHTML = `${option.label}<span class="odet">${escapeHtml(option.detail)}</span>`;
      paint(btn, option.slot);
      btn.addEventListener('click', () => {
        if (chosen.has(option.slot)) chosen.delete(option.slot);
        else chosen.add(option.slot);
        playSfx('click');
        paint(btn, option.slot);
      });
      host.appendChild(btn);
    }
    const finish = (accepted: boolean): void => {
      dlgResolve = null;
      host.innerHTML = '';
      $('dlg').classList.remove('show');
      resolve(accepted ? [...chosen].sort() : null);
    };
    // Compartimos el cierre del diálogo normal: OK confirma, Esc cancela.
    dlgResolve = (value) => finish(value !== null);
  });
}

// ── Teclado ──────────────────────────────────────────────────────────────

document.addEventListener('keydown', (event) => {
  if (dlgOpen()) {
    if (dlgChoiceMode) {
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) { event.preventDefault(); choiceKeys?.(digit); }
      return; // elección obligatoria: ni Enter ni Escape la saltan
    }
    if (event.key === 'Enter') { event.preventDefault(); dlgFinish(true); }
    if (event.key === 'Escape') dlgFinish(false);
    return;
  }
  if (newGameOpen) {
    if (event.key === 'Escape') closeNewGame();
    return;
  }
  if (startOpen) {
    if ((event.key === 'Enter' || event.key === 'Escape') && hasLiveGame()) closeStart();
    return;
  }
  if (garageOpen) {
    if (event.key === 'Escape') closeGarage();
    return;
  }
  if (chronicleOpen) {
    if (event.key === 'Escape') closeChronicle();
    return;
  }
  if (mercOpen) {
    if (event.key === 'Escape') { if (inCampaign()) openStart(); else closeMerc(); }
    return;
  }
  if (editorOpen) {
    if (event.key === 'Escape') closeEditor();
    return;
  }
  if (pilotsOpen) {
    if (event.key === 'Escape') closePilots();
    return;
  }
  if (savesOpen) {
    if (event.key === 'Escape') closeSaves();
    return;
  }
  if (cityOpen) {
    if (event.key === 'Escape') {
      // Dentro de un edificio, Esc vuelve a la plaza; en la plaza, al mapa.
      if (cityBuilding !== null) { cityBuilding = null; renderCity(); }
      else closeCity();
    }
    return;
  }
  if (worldOpen) {
    if (event.key === 'Escape') { if (inCampaign()) openStart(); else closeWorld(); }
    return;
  }
  if (document.activeElement === $('seed')) return;
  if (battle.isOver) {
    if (event.key === 'Enter') restart();
    return;
  }

  const facingByKey: Record<string, Facing> = {
    ArrowUp: 'north', ArrowRight: 'east', ArrowDown: 'south', ArrowLeft: 'west',
    w: 'north', d: 'east', s: 'south', a: 'west',
    W: 'north', D: 'east', S: 'south', A: 'west',
  };

  // En modo orientación, las direcciones cierran el turno mirando ahí.
  if (mode.kind === 'facing' && facingByKey[event.key]) {
    event.preventDefault();
    doWait(facingByKey[event.key]);
    return;
  }

  switch (event.key) {
    case 'ArrowUp': case 'w': case 'W': event.preventDefault(); moveCursor(0, -1); return;
    case 'ArrowDown': case 's': case 'S': event.preventDefault(); moveCursor(0, 1); return;
    case 'ArrowLeft': case 'a': case 'A': event.preventDefault(); moveCursor(-1, 0); return;
    case 'ArrowRight': case 'd': case 'D': event.preventDefault(); moveCursor(1, 0); return;
    case 'Enter': case 'e': case 'E': event.preventDefault(); confirm(); return;
    case 'Escape': case 'q': case 'Q': event.preventDefault(); cancel(); return;
    case 'm': case 'M': enterMove(); return;
    case 'b': case 'B': enterBoost(); return;
    case 'r': case 'R': doReload(); return;
    case 'f': case 'F': enterFacing(); return;
    case 'v': case 'V': doOverwatch(); return;
    case 'o': case 'O': doOverclock(); return;
    case 'x': case 'X': toggleOverdrive(); return;
    case 'q': case 'Q': if (currentView() === 'diorama') rotateDiorama(); return;
    case ' ': event.preventDefault(); enterFacing(); return;
    default: {
      const index = Number(event.key);
      if (index >= 1 && index <= 9) {
        const unit = playerUnit();
        if (!unit) return;
        const abilityId = battle.knownAbilityIds(unit)[index - 1];
        if (abilityId) enterAbility(abilityId);
      }
    }
  }
});

// ── Renderizado ──────────────────────────────────────────────────────────

const TERRAIN_BASE: Record<string, string> = {
  plain: '#2b3d31',
  rough: '#4a4433',
  water: '#1d3a52',
  forest: '#1e4527',
  wall: '#11161b',
};

function shade(hex: string, height: number): string {
  const n = parseInt(hex.slice(1), 16);
  const lift = Math.min(3, height) * 0.13;
  const r = Math.min(255, Math.round(((n >> 16) & 255) * (1 + lift)));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * (1 + lift)));
  const b = Math.min(255, Math.round((n & 255) * (1 + lift)));
  return `rgb(${r},${g},${b})`;
}

/** Camino previsualizado: hasta el cursor en modo move/boost. */
function previewPath(): Set<string> {
  if (mode.kind !== 'move' && mode.kind !== 'boost') return new Set();
  const tile = mode.tiles.get(posKey(cursor));
  if (!tile) return new Set();
  return new Set(tile.path.slice(1, -1).map(posKey));
}

function facingCells(): Map<string, Facing> {
  const cells = new Map<string, Facing>();
  const unit = playerUnit();
  if (mode.kind !== 'facing' || !unit) return cells;
  for (const facing of ['north', 'east', 'south', 'west'] as Facing[]) {
    const offset = FACING_OFFSET[facing];
    const pos = { x: unit.position.x + offset.x, y: unit.position.y + offset.y };
    if (battle.map.inBounds(pos)) cells.set(posKey(pos), facing);
  }
  return cells;
}

function renderBoard(): void {
  if (currentView() === 'diorama') { renderDioramaView(); return; }
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${battle.map.width}, 46px)`;
  board.innerHTML = '';
  const active = battle.getActiveUnit();
  const unit = playerUnit();
  const path = previewPath();
  const faces = facingCells();

  const objective = battle.objective;
  const zone = objective.kind === 'reach'
    ? new Set(objective.zone.map(posKey)) : null;
  for (let y = 0; y < battle.map.height; y++) {
    for (let x = 0; x < battle.map.width; x++) {
      const pos = { x, y };
      const key = posKey(pos);
      const tile = battle.map.tileAt(pos);
      const cell = document.createElement('button');
      cell.className = `cell t-${tile.terrain}`;
      if (zone?.has(key)) {
        cell.classList.add('hl-zone');
        const flag = document.createElement('span');
        flag.className = 'hl-label';
        flag.textContent = '⚑';
        cell.appendChild(flag);
      }
      cell.style.background = shade(TERRAIN_BASE[tile.terrain]!, tile.height);
      if ((x + y) % 2 === 0) cell.classList.add('alt');
      if (tile.height > 0) cell.classList.add(`elev-${Math.min(3, tile.height)}`);

      if (tile.height > 0 && tile.terrain !== 'wall') {
        const h = document.createElement('span');
        h.className = 'h';
        h.textContent = String(tile.height);
        cell.appendChild(h);
      }

      // Control del campo: la casilla ardiendo se VE (brasa + llama).
      if (battle.map.fireAt(pos) > 0) {
        cell.classList.add('on-fire');
        const flame = document.createElement('span');
        flame.className = 'fire-flame';
        flame.textContent = '🔥';
        cell.appendChild(flame);
      }

      // Resaltados del modo actual.
      if ((mode.kind === 'move' || mode.kind === 'boost') && mode.tiles.has(key)) {
        cell.classList.add(mode.kind === 'move' ? 'hl-move' : 'hl-boost', 'actionable');
        // ⌖ = desde esta casilla tendrías al menos un enemigo a tiro.
        if (mode.shotsFrom.has(key)) {
          const shot = document.createElement('span');
          shot.className = 'hl-label shot';
          shot.textContent = '⌖';
          cell.appendChild(shot);
        }
      }
      if (mode.kind === 'ability' && mode.targets.has(key)) {
        cell.classList.add('hl-target', 'actionable');
        const label = targetLabel(unit, pos);
        if (label) {
          const span = document.createElement('span');
          span.className = 'hl-label';
          span.textContent = label;
          cell.appendChild(span);
        }
      }
      const face = faces.get(key);
      if (face) {
        cell.classList.add('hl-face', 'actionable');
        const span = document.createElement('span');
        span.className = 'hl-label';
        span.textContent = FACING_ARROW[face];
        cell.appendChild(span);
      }
      if (path.has(key)) cell.classList.add('path');
      if (pending && samePosition(pending, pos)) cell.classList.add('pending');
      if (samePosition(cursor, pos) && playerUnit()) cell.classList.add('cursor');

      const occupant = battle.unitAt(pos);
      if (occupant && samePosition(occupant.position, pos)) {
        const chip = document.createElement('div');
        chip.className = `chip ${occupant.team}`;
        if (occupant.size > 1) {
          chip.classList.add('size2');
          cell.classList.add('has-big');
        }
        if (active?.id === occupant.id) chip.classList.add('active-unit');
        chip.innerHTML =
          unitSprite(occupant.unitTypeId, occupant.facing, scarsFor(occupant.id)) +
          `<span class="ztag">${occupant.id}</span>`;
        const bar = document.createElement('div');
        bar.className = 'hpbar';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round((occupant.hp / battle.effectiveStats(occupant).maxHp) * 100)}%`;
        bar.appendChild(fill);
        chip.appendChild(bar);
        cell.appendChild(chip);
        animateChip(chip, occupant.id);
      }

      cell.addEventListener('mousemove', () => setCursor(pos));
      cell.addEventListener('click', () => {
        setCursor(pos);
        const facing = facingCells().get(key);
        if (facing) { doWait(facing); return; }
        confirm();
      });
      board.appendChild(cell);
    }
  }
}

/** Tamaño de celda en píxeles (46 de celda + 2 de separación). */
const CELL_PX = 48;

// ── El diorama (escalón 3): escena, dibujo y ratón ──────────────────────

const TEAM_COLORS = { player: '#53d1e0', enemy: '#ff8a5c' } as const;

/** Cicatrices de la máquina que ocupa el hueco Pn (0 para el resto). */
function scarsFor(unitId: string): number {
  if (!campaign || !/^P\d+$/.test(unitId)) return 0;
  const slot = Number(unitId.slice(1)) - 1;
  if (!deployedSlots.includes(slot)) return 0; // escaramuza: sin historial
  const zoid = campaign.roster[slot];
  return zoid ? scarLevel(zoidRecord(zoid)) : 0;
}

function dioramaScene(): DioramaScene {
  const unit = playerUnit();
  const path = previewPath();
  const faces = facingCells();
  const tiles: DioramaTile[] = [];
  const labels = new Map<string, string>();
  const targets = new Set<string>();
  const shots = new Set<string>();
  const moveSet = new Set<string>();
  const boostSet = new Set<string>();
  for (let y = 0; y < battle.map.height; y++) {
    for (let x = 0; x < battle.map.width; x++) {
      const pos = { x, y };
      const key = posKey(pos);
      const tile = battle.map.tileAt(pos);
      tiles.push({
        x, y,
        terrain: tile.terrain as DioramaTile['terrain'],
        height: tile.height,
        fill: shade(TERRAIN_BASE[tile.terrain]!, tile.height),
      });
      if ((mode.kind === 'move' || mode.kind === 'boost') && mode.tiles.has(key)) {
        (mode.kind === 'move' ? moveSet : boostSet).add(key);
        if (mode.shotsFrom.has(key)) shots.add(key);
      }
      if (mode.kind === 'ability' && mode.targets.has(key)) {
        targets.add(key);
        const label = targetLabel(unit, pos);
        if (label) labels.set(key, label);
      }
    }
  }
  const units: DioramaUnit[] = battle.units
    .filter((u) => u.hp > 0 && !u.retreated)
    .map((u) => {
      const pose = walkingPose(u.id);
      const center = (u.size - 1) / 2; // la huella 2x2 se ancla a su centro
      return {
        id: u.id,
        unitTypeId: u.unitTypeId,
        team: u.team,
        facing: u.facing,
        x: (pose?.x ?? u.position.x) + center,
        y: (pose?.y ?? u.position.y) + center,
        ...(pose ? { elev: pose.elev } : {}),
        ...(u.size > 1 ? { scale: 1 + (u.size - 1) * 0.85 } : {}),
        hpRatio: u.hp / Math.max(1, battle.effectiveStats(u).maxHp),
        active: battle.getActiveUnit()?.id === u.id,
      };
    });
  const objective = battle.objective;
  const zone = objective.kind === 'reach'
    ? new Set(objective.zone.map(posKey)) : undefined;
  return {
    width: battle.map.width,
    height: battle.map.height,
    tiles,
    units,
    hl: {
      move: moveSet, boost: boostSet, target: targets,
      path: new Set(path), faces: new Map([...faces].map(([k, f]) => [k, FACING_ARROW[f]])),
      labels, shots,
      ...(zone ? { zone } : {}),
      ...(pending ? { pending } : {}),
      ...(playerUnit() ? { cursor } : {}),
    },
    time: performance.now(),
    rotation: dioramaRot,
    weather: battle.weather,
  };
}

/** Marcha en curso dentro del diorama (unidad + camino + reloj). */
let dioramaWalk: { unitId: string; path: Position[]; start: number } | null = null;
const WALK_MS_PER_TILE = 110;

/** Posición y elevación interpoladas de la unidad en marcha. */
function walkingPose(unitId: string): { x: number; y: number; elev: number } | null {
  if (!dioramaWalk || dioramaWalk.unitId !== unitId) return null;
  const steps = dioramaWalk.path.length - 1;
  if (steps <= 0) return null;
  const t = (performance.now() - dioramaWalk.start) / (steps * WALK_MS_PER_TILE);
  if (t >= 1) { dioramaWalk = null; return null; }
  const at = t * steps;
  const i = Math.min(steps - 1, Math.floor(at));
  const f = at - i;
  const a = dioramaWalk.path[i]!;
  const b = dioramaWalk.path[i + 1]!;
  const elevOf = (pos: Position): number => {
    const tile = battle.map.tileAt(pos);
    return tile.terrain === 'wall' ? tile.height + 1 : tile.height;
  };
  // Un saltito por casilla: la zancada se nota.
  const hop = Math.sin(f * Math.PI) * 3.5;
  return {
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    elev: elevOf(a) + (elevOf(b) - elevOf(a)) * f + hop / ELEV_STEP,
  };
}

/** Giro de cámara del diorama en cuartos de vuelta (persistido). */
let dioramaRot = (() => {
  try { return (Number(localStorage.getItem('gea-rot')) || 0) & 3; } catch { return 0; }
})();

function rotateDiorama(): void {
  dioramaRot = (dioramaRot + 1) & 3;
  try { localStorage.setItem('gea-rot', String(dioramaRot)); } catch { /* privado */ }
  renderAll();
}

let dioramaWired = false;

function renderDioramaView(): void {
  const canvas = $('diorama') as HTMLCanvasElement;
  const scene = dioramaScene();
  drawDiorama(canvas, scene,
    (u) => ({ body: spriteBody(u.unitTypeId, scarsFor(u.id)), color: TEAM_COLORS[u.team] }),
    () => renderDioramaView());
  if (!dioramaWired) {
    dioramaWired = true;
    const pickAt = (event: MouseEvent): { x: number; y: number } | null => {
      const rect = canvas.getBoundingClientRect();
      const scale = canvas.width / rect.width;
      return isoPick(
        { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale },
        dioramaScene().tiles, battle.map.width, battle.map.height, dioramaRot);
    };
    canvas.addEventListener('mousemove', (event) => {
      const pos = pickAt(event);
      if (pos && !samePosition(pos, cursor)) setCursor(pos);
    });
    canvas.addEventListener('click', (event) => {
      const pos = pickAt(event);
      if (!pos) return;
      setCursor(pos);
      const facing = facingCells().get(posKey(pos));
      if (facing) { doWait(facing); return; }
      confirm();
    });
  }
}

// El agua ondula y las marchas fluyen: repintado suave cuando toca.
window.setInterval(() => {
  if (currentView() !== 'diorama') return;
  if (document.hidden || startOpen || mercOpen || worldOpen || cityOpen) return;
  renderDioramaView();
}, 140);
function walkFrame(): void {
  if (dioramaWalk && currentView() === 'diorama') {
    renderDioramaView();
    requestAnimationFrame(walkFrame);
  }
}

/**
 * Animaciones de ficha tras el re-render: desplazamiento a lo largo del
 * camino recorrido (Web Animations API) y destello al recibir impactos.
 * El estado del juego ya está actualizado; esto es solo presentación.
 */
function animateChip(chip: HTMLElement, unitId: string): void {
  if (reducedMotion) {
    if (unitId === pendingMoveAnim?.unitId) pendingMoveAnim = null;
    pendingHits.delete(unitId);
    return;
  }

  if (pendingMoveAnim?.unitId === unitId) {
    const path = pendingMoveAnim.path;
    const last = path[path.length - 1]!;
    // Keyframes: desde cada casilla del camino hasta la posición final.
    const frames = path.map((p) => ({
      transform: `translate(${(p.x - last.x) * CELL_PX}px, ${(p.y - last.y) * CELL_PX}px)`,
    }));
    chip.animate(frames, {
      duration: Math.min(600, 110 * Math.max(1, path.length - 1)),
      easing: 'ease-out',
    });
    pendingMoveAnim = null;
  }

  if (pendingHits.has(unitId)) {
    chip.animate([
      { filter: 'brightness(3)', transform: 'scale(1.15)' },
      { filter: 'brightness(1)', transform: 'scale(1)' },
    ], { duration: 260, easing: 'ease-out' });
    pendingHits.delete(unitId);
  }
}

/** % de impacto (o ✚ para aliados) mostrado sobre un objetivo. */
function targetLabel(unit: UnitState | undefined, pos: Position): string | undefined {
  if (!unit || mode.kind !== 'ability') return undefined;
  const target = battle.unitAt(pos);
  if (!target) return undefined;
  const ability = battle.abilityOf(mode.abilityId);
  if (target.team === unit.team) return ability.targetsAllies ? '✚' : undefined;
  const preview = battle.attackPreview(unit.id, mode.abilityId, pos);
  return preview ? displayedChance(unit, preview.chance, pos) : undefined;
}

/** El objetivo, en una frase que cabe en el HUD. */
function objectiveText(): string {
  const objective = battle.objective;
  switch (objective.kind) {
    case 'eliminate': return 'derriba a todo el equipo enemigo';
    case 'assassinate': return `derriba al cabecilla (${objective.targetUnitId})`;
    case 'protect': return `protege a ${objective.wardUnitId}: si cae, se pierde`;
    case 'reach': return 'alcanza la zona marcada';
    case 'survive': return `aguanta ${objective.rounds} rondas`;
  }
}

function renderBanner(): void {
  const objBar = $('objective-bar');
  objBar.textContent = `🎯 ${objectiveText()} · ronda ${battle.round}`;
  const banner = $('turn-banner');
  const active = battle.getActiveUnit();
  if (!active) {
    banner.className = '';
    banner.innerHTML = 'Resolviendo...';
    return;
  }
  const isPlayer = active.team === 'player' && !busy;
  banner.className = isPlayer ? '' : 'enemy';
  const modeText = {
    idle: 'elige una acción',
    move: 'elige casilla de movimiento',
    boost: 'elige casilla de boost',
    ability: pending ? 'confirma el disparo [E]' : 'elige objetivo',
    facing: 'elige orientación final (WASD) o confirma [E]',
  }[mode.kind];
  banner.innerHTML = isPlayer
    ? `▶ ${active.id} ${active.name} — ${modeText}<span class="kbd-hint">M mover · B boost · 1-9 armas · X sobremarcha · R recargar · F/espacio fin de turno</span>`
    : `■ Turno enemigo: ${active.id} ${active.name}`;
}

function renderActionbar(): void {
  const bar = $('actionbar');
  bar.innerHTML = '';
  const unit = playerUnit();
  if (!unit) return;

  const mkBtn = (
    label: string, kbd: string, onClick: () => void,
    opts: { disabled?: boolean; title?: string; on?: boolean } = {},
  ): void => {
    const btn = document.createElement('button');
    btn.className = 'abtn';
    btn.innerHTML = `<kbd>${kbd}</kbd><span>${label}</span>`;
    btn.disabled = Boolean(opts.disabled);
    if (opts.title) btn.title = opts.title;
    if (opts.on) btn.classList.add('mode-on');
    btn.addEventListener('click', onClick);
    bar.appendChild(btn);
  };

  // Posturas de energía: acción libre, dos caras a la vista en el título.
  const stances: Array<{ id: 'cazador' | 'galope' | 'tortuga'; label: string; title: string }> = [
    { id: 'cazador', label: '🐆', title: 'Cazador: puntería +10, evasión −5' },
    { id: 'galope', label: '🐎', title: 'Galope: movimiento +2, blindaje −10' },
    { id: 'tortuga', label: '🐢', title: 'Tortuga: blindajes +10, movimiento −2' },
  ];
  for (const stance of stances) {
    mkBtn(stance.label, '·', () => {
      logEvents(battle.execute({ type: 'stance', unitId: unit.id, stance: stance.id }));
      renderAll();
    }, { on: unit.stance === stance.id, title: stance.title });
  }

  // Sobrecarga del reactor (pacto con el diablo): acción libre reservada a
  // las máquinas con reactor (energía + calor). Sube potencia, iniciativa y
  // daño a cambio de un pico de calor inmediato y calor extra cada turno —
  // el precio, y el riesgo de apagado, los cobran los sistemas.
  if (unit.components.energy && unit.components.heat) {
    const oc = unit.overclocked ?? false;
    mkBtn(oc ? '🔥 Sobrecarga ON' : '🔥 Sobrecarga', '·', () => {
      logEvents(battle.execute({ type: 'overclock', unitId: unit.id, on: !oc }));
      renderAll();
    }, {
      on: oc,
      title: oc
        ? 'reactor sobrecargado: +mov/+iniciativa/+daño, pero el calor no para de subir — púlsalo para cortarla'
        : `sobrecargar el reactor: +mov/+iniciativa/+daño por +${OVERCLOCK_ENGAGE_HEAT} de calor al instante y calor extra cada turno (riesgo de apagado si no refrigeras)`,
    });
  }

  const moveVeto = battle.checkVetoes({ type: 'move', unitId: unit.id, to: unit.position });
  mkBtn('Mover', 'M', enterMove, {
    disabled: unit.hasMoved || moveVeto !== null,
    title: moveVeto?.reason ?? (unit.hasMoved ? 'ya se movió' : undefined),
    on: mode.kind === 'move',
  });

  const energy = unit.components.energy;
  if (energy) {
    const boostVeto = battle.checkVetoes({ type: 'boost', unitId: unit.id, to: unit.position });
    mkBtn('Boost ⚡20', 'B', enterBoost, {
      disabled: energy.boostedThisTurn || boostVeto !== null,
      title: boostVeto?.reason ?? (energy.boostedThisTurn ? 'ya hizo boost' : undefined),
      on: mode.kind === 'boost',
    });
  }

  battle.knownAbilityIds(unit).forEach((abilityId, index) => {
    const ability = battle.abilityOf(abilityId);
    const veto = battle.checkVetoes({ type: 'ability', unitId: unit.id, abilityId, target: unit.position });
    const entry = battle.weaponEntry(unit, abilityId);
    const cost = entry?.def.costs;
    const bits = [
      cost?.energy ? `⚡${cost.energy}` : '',
      cost?.heat ? `🔥${cost.heat}` : '',
      entry && entry.def.magazine > 0 ? `${entry.state.ammo}/${entry.def.magazine}` : '',
    ].filter(Boolean).join(' ');
    mkBtn(bits ? `${ability.name} ${bits}` : ability.name, String(index + 1), () => enterAbility(abilityId), {
      disabled: unit.hasActed || veto !== null,
      title: veto?.reason ?? (unit.hasActed ? 'ya actuó' : ability.description),
      on: mode.kind === 'ability' && mode.abilityId === abilityId,
    });
  });

  const reloadable = firstReloadable(unit);
  if (reloadable) {
    mkBtn(`Recargar ${battle.weaponOf(reloadable).name}`, 'R', doReload, { disabled: unit.hasActed });
  }

  // Vigilancia (XCOM): renuncia a actuar para cubrir el terreno.
  mkBtn('👁 Vigilancia', 'V', doOverwatch, {
    disabled: unit.hasActed,
    title: unit.hasActed ? 'ya actuó'
      : 'termina el turno al acecho: dispara al primer enemigo que se mueva a tiro (75% de daño; paga munición y energía)',
  });

  // Salidas de emergencia: retirarse por el borde salva la máquina;
  // eyectar la sacrifica para salvar al piloto. Consecuencias anunciadas.
  const onEdge = (): boolean => {
    for (let dy = 0; dy < unit.size; dy++) {
      for (let dx = 0; dx < unit.size; dx++) {
        const x = unit.position.x + dx;
        const y = unit.position.y + dy;
        if (x === 0 || y === 0 || x === battle.map.width - 1 || y === battle.map.height - 1) return true;
      }
    }
    return false;
  };
  if (onEdge()) {
    mkBtn('🏳 Retirarse', '·', () => {
      void uiConfirm(`¿Retirar a ${unit.id} ${unit.name} del combate? La máquina se salva con el daño que lleve, pero no volverá a esta batalla.`).then((ok) => {
        if (!ok) return;
        logEvents(battle.execute({ type: 'retreat', unitId: unit.id }));
        mode = { kind: 'idle' };
        pending = null;
        advance();
      });
    }, { title: 'abandonar el campo por el borde: la máquina sobrevive' });
  }
  const hpRatio = unit.hp / Math.max(1, battle.effectiveStats(unit).maxHp);
  if (hpRatio <= 0.5) {
    mkBtn('🪂 Eyectar', '·', () => {
      void uiConfirm(`¿Eyectar del ${unit.name}? La máquina SE PIERDE donde está; el piloto salta y vuelve casi entero (1 jornada de baja en campaña, no 3).`).then((ok) => {
        if (!ok) return;
        logEvents(battle.execute({ type: 'eject', unitId: unit.id }));
        mode = { kind: 'idle' };
        pending = null;
        advance();
      });
    }, { title: 'sacrificar la máquina para salvar al piloto' });
  }

  mkBtn('Fin de turno', 'F', enterFacing, { on: mode.kind === 'facing' });
}

/** Panel de análisis: contexto del cursor y pronóstico de ataque. */
function renderPreview(): void {
  const el = $('preview');
  const unit = playerUnit();
  const tile = battle.map.tileAt(cursor);
  const occupant = battle.unitAt(cursor);
  const lines: string[] = [];

  // Pronóstico de disparo (el corazón del flujo XCOM).
  if (unit && mode.kind === 'ability' && occupant && mode.targets.has(posKey(cursor))) {
    const ability = battle.abilityOf(mode.abilityId);
    const preview = occupant.team !== unit.team
      ? battle.attackPreview(unit.id, mode.abilityId, cursor)
      : undefined;
    if (preview) {
      const { chance, min, max, arc, heightAdvantage, cover, weatherPenalty } = preview;
      lines.push(`<div class="pv-title">${ability.name} → ${occupant.id} ${occupant.name}</div>`);
      lines.push(`<div>impacto <b>${displayedChance(unit, chance, cursor)}</b> · daño <b>${min}–${max}</b> · arco <b class="${arc === 'back' ? 'pv-good' : arc === 'side' ? 'pv-warn' : ''}">${ARC_LABEL[arc]}</b>${heightAdvantage !== 0 ? ` · altura ${heightAdvantage > 0 ? '+' : ''}${heightAdvantage}` : ''}${cover > 0 ? ` · <span class="pv-warn">cobertura −${cover}</span>` : ''}${weatherPenalty > 0 ? ` · <span class="pv-warn">clima −${weatherPenalty}</span>` : ''}</div>`);
      const entry = battle.weaponEntry(unit, mode.abilityId);
      if (entry) {
        const cost = entry.def.costs;
        const costs: string[] = [];
        if (cost.energy) costs.push(`⚡${cost.energy}`);
        if (cost.heat) costs.push(`🔥+${cost.heat}`);
        if (entry.def.magazine > 0) costs.push(`munición ${entry.state.ammo}→${entry.state.ammo - 1}`);
        if (cost.cooldownTurns) costs.push(`enfría ${cost.cooldownTurns}t`);
        if (costs.length > 0) lines.push(`<div class="pv-muted">coste: ${costs.join(' · ')}</div>`);
        const heat = unit.components.heat;
        if (heat && cost.heat) {
          const after = heat.current + cost.heat;
          if (after > heat.max) lines.push('<div class="pv-danger">⚠ superará el límite térmico: APAGADO el próximo turno</div>');
          else if (after >= heat.max * 0.7) lines.push('<div class="pv-warn">⚠ calor alto tras el disparo: puntería degradada</div>');
        }
      }
      lines.push(pending && samePosition(pending, cursor)
        ? '<div class="pv-confirm">pulsa E / clic de nuevo para DISPARAR</div>'
        : '<div class="pv-muted">E / clic: seleccionar objetivo</div>');
      el.innerHTML = lines.join('');
      return;
    }
  }

  // Contexto general del cursor.
  const cover = TERRAIN_COVER[tile.terrain];
  lines.push(`<div class="pv-muted">(${cursor.x},${cursor.y}) · ${terrainLabel(tile.terrain)} · altura ${tile.height}${cover > 0 ? ` · <span class="pv-good">cobertura +${cover}</span>` : ''}</div>`);
  if (occupant) {
    const stats = battle.effectiveStats(occupant);
    lines.push(`<div class="pv-title">${occupant.id} ${occupant.name} ${FACING_ARROW[occupant.facing]}</div>`);
    lines.push(`<div>HP ${occupant.hp}/${stats.maxHp} · evasión ${stats.evade} · mov ${stats.move}</div>`);
    const reading = symptomBadges(occupant);
    if (reading) lines.push(`<div class="pv-muted">lectura: ${reading}</div>`);
    if (unit && occupant.team !== unit.team) {
      const arc = attackArc(unit.position, occupant.position, occupant.facing);
      lines.push(`<div class="pv-muted">desde tu posición lo atacarías por: <b>${ARC_LABEL[arc]}</b></div>`);
    }
  }
  if (unit && (mode.kind === 'move' || mode.kind === 'boost')) {
    const reach = mode.tiles.get(posKey(cursor));
    if (reach) {
      if (mode.kind === 'move') lines.push(`<div class="pv-muted">coste de movimiento: ${reach.cost}</div>`);
      const shots = mode.shotsFrom.get(posKey(cursor));
      lines.push(shots
        ? `<div class="pv-good">⌖ a tiro desde aquí: ${shots.join(' · ')}</div>`
        : '<div class="pv-muted">sin enemigos a tiro desde esta casilla</div>');
    }
  }
  el.innerHTML = lines.join('');
}

function renderForecast(): void {
  const el = $('forecast');
  el.innerHTML = '';
  // Tempo comprometido por la unidad activa del jugador: el timeline de abajo
  // ya se reordena en vivo con ello; esta etiqueta le pone número.
  const active = playerUnit();
  if (active) {
    const { spent } = battle.projectedTempo(active.id);
    const tag = document.createElement('span');
    tag.className = 'fc tempo';
    tag.textContent = `tempo ${spent}`;
    tag.title = 'CT que cederás al cerrar el turno: cuanto más comprometes (mover, arma pesada, sobremarcha), más tardas en volver';
    if (overdriveArmed) { tag.textContent += ' ⚡'; tag.title += ' — SOBREMARCHA armada (×1.5, cedes el próximo turno)'; }
    el.appendChild(tag);
  }
  for (const id of battle.forecast(8)) {
    const unit = battle.unit(id);
    const chip = document.createElement('span');
    chip.className = `fc ${unit.team}`;
    chip.textContent = id;
    el.appendChild(chip);
  }
}

function renderRoster(): void {
  const el = $('roster');
  el.innerHTML = '';
  for (const unit of battle.units) {
    const stats = battle.effectiveStats(unit);
    const card = document.createElement('div');
    card.className = `ucard ${unit.team}`;

    const name = document.createElement('div');
    name.className = 'name';
    name.innerHTML = `<span class="tag">${unit.id}</span> ${unit.name}${unit.isCommander ? ' ★' : ''}` +
      (unit.hp <= 0 ? ' <span class="dead">DESTRUIDO</span>' : symptomBadges(unit)) +
      (unit.statuses.length > 0
        ? ` <span style="color:var(--heat);font-size:10px">${unit.statuses.map((s) => STATUS_DEFINITIONS[s.id].name).join(', ')}</span>`
        : '');
    card.appendChild(name);

    if (unit.hp > 0) {
      const bars = document.createElement('div');
      bars.className = 'bars';
      const addBar = (lbl: string, cls: string, value: number, max: number): void => {
        bars.insertAdjacentHTML('beforeend',
          `<span class="lbl">${lbl}</span>` +
          `<span class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (value / max) * 100))}%"></i></span>` +
          `<span class="num">${value}/${max}</span>`);
      };
      addBar('HP', 'hp', unit.hp, stats.maxHp);
      const { energy, heat, arsenal, frame } = unit.components;
      if (energy) addBar('⚡', 'en', energy.current, energy.capacity);
      if (heat) addBar('🔥', 'ht', heat.current, heat.max);
      card.appendChild(bars);

      if (arsenal) {
        for (const weapon of arsenal.weapons) {
          const def = battle.weaponOf(weapon.weaponId);
          const bits: string[] = [];
          if (def.magazine > 0) bits.push(`${weapon.ammo}/${def.magazine} (+${weapon.reserves} cargadores)`);
          if (weapon.cooldown > 0) bits.push(`enfriando ${weapon.cooldown}t`);
          if (bits.length > 0) {
            card.insertAdjacentHTML('beforeend', `<div class="extra">${def.name}: ${bits.join(' · ')}</div>`);
          }
        }
      }
      if (frame) {
        card.insertAdjacentHTML('beforeend', moduleDiagram(frame, unit.unitTypeId));
      }
    }
    el.appendChild(card);
  }
}

/*
 * Diagrama de estado del Zoid: silueta lateral genérica (morro a la
 * derecha) con cada módulo como pieza coloreada por su HP. Los slots
 * son cadenas libres del frame: se asignan a regiones por patrón y lo
 * que no encaje se apila como bloque extra a la izquierda.
 */
const DIAGRAM_ANCHORS: Array<{ match: RegExp; x: number; y: number }> = [
  { match: /head/, x: 128, y: 22 },
  { match: /torso|body|core/, x: 76, y: 42 },
  { match: /weapon|cannon|claws|gun/, x: 76, y: 13 },
  { match: /backpack|tail|booster/, x: 22, y: 24 },
  { match: /front|-r$/, x: 108, y: 74 },
  { match: /rear|-l$/, x: 46, y: 74 },
];

function moduleColor(ratio: number): string {
  if (ratio >= 0.7) return 'var(--hp)';
  if (ratio >= 0.35) return 'var(--heat)';
  return 'var(--danger)';
}

/** Etiquetas de los módulos DESTRUIDOS de una unidad (síntomas). */
function destroyedTags(unit: UnitState): Set<string> {
  const tags = new Set<string>();
  for (const module of unit.components.frame?.modules ?? []) {
    if (!module.destroyed) continue;
    for (const tag of MODULES[module.moduleId]?.tags ?? []) tags.add(tag);
  }
  return tags;
}

/**
 * Insignias de síntoma legible: la avería y la TENSIÓN se VEN, no se
 * deducen (leer la máquina, no la ficha). Cubre lo permanente (módulos
 * caídos, desgaste) y lo transitorio (calor, sobrecarga, energía) —
 * también en el enemigo: un rival humeante o al rojo se delata.
 */
function symptomBadges(unit: UnitState): string {
  if (unit.hp <= 0) return '';
  const tags = destroyedTags(unit);
  const hot: string[] = [];   // señales térmicas/de reactor (color calor)
  const cold: string[] = [];  // averías y desgaste (borde neutro)

  // Tensión del reactor: el pacto con el diablo se DELATA a la vista.
  if (unit.overclocked) hot.push('🔥 reactor forzado');
  const heat = unit.components.heat;
  if (heat && heat.max > 0) {
    const ratio = heat.current / heat.max;
    if (ratio >= HEAT_CRITICAL_THRESHOLD) hot.push('🌋 al rojo vivo');
    else if (ratio >= HEAT_HIGH_THRESHOLD) hot.push('♨ humea');
  }
  const energy = unit.components.energy;
  if (energy && energy.current <= 0) cold.push('🔋 sin fuerza');

  // Desgaste: el daño acumulado se VE. Solo cuando la dificultad lo activa.
  if (battle && battle.wear > 0) {
    const tier = wearTier(unit.hp, battle.effectiveStats(unit).maxHp);
    if (tier === 'castigada') cold.push('⚠ castigada');
    else if (tier === 'malherida') cold.push('🩸 malherida');
  }
  // Piezas EXPUESTAS: el blindaje de una parte se agotó (aún no destruida):
  // es la costura por donde entra el próximo golpe.
  const exposed = (unit.components.frame?.modules ?? []).some((m) =>
    !m.destroyed && (MODULES[m.moduleId]?.plating ?? 0) > 0 && m.plating <= 0);
  if (exposed) cold.push('🛡 expuesto');

  if (tags.has('locomotion')) cold.push('🦵 cojea');
  if (tags.has('sensor')) cold.push('📡 sensores rotos');
  if (tags.has('weapon')) cold.push('🔫 arma inutilizada');

  return [
    ...hot.map((b) => `<span class="symptom" style="border-color:var(--heat);color:var(--heat)">${b}</span>`),
    ...cold.map((b) => `<span class="symptom">${b}</span>`),
  ].join('');
}

/**
 * Sensores rotos: la consola MIENTE. El % real sigue mandando en el
 * motor; aquí solo se distorsiona lo que el piloto cree ver.
 */
function displayedChance(attacker: UnitState, chance: number, target: Position): string {
  if (!destroyedTags(attacker).has('sensor')) return `${chance}%`;
  let h = 2166136261;
  for (const ch of `${attacker.id}|${attacker.position.x},${attacker.position.y}|${target.x},${target.y}`) {
    h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  }
  const noise = ((h >>> 0) % 41) - 20; // ±20 puntos de mentira
  return `≈${Math.max(5, Math.min(99, chance + noise))}%?`;
}

/*
 * Lector de casco: la SILUETA del propio chasis como fondo del
 * diagnóstico, con cada módulo como nodo-anilla anclado a su zona del
 * cuerpo (anilla = fracción de HP; ✕ pulsante = destruido). Es la
 * consola de la cabina, no una tabla.
 */
function moduleDiagram(frame: FrameState, unitTypeId: string): string {
  const used = new Set<number>();
  let extraY = 16;
  const nodes: string[] = [];
  const wires: string[] = [];
  const R = 10.5;
  const CIRC = 2 * Math.PI * R;
  const RP = R + 3;           // anilla exterior = blindaje
  const CIRCP = 2 * Math.PI * RP;
  for (const module of frame.modules) {
    const def = MODULES[module.moduleId];
    const maxHp = def?.hp ?? Math.max(1, module.hp);
    const maxPlating = def?.plating ?? 0;
    const platingRatio = maxPlating > 0 ? Math.max(0, Math.min(1, module.plating / maxPlating)) : 0;
    const exposed = maxPlating > 0 && module.plating <= 0;
    const idx = DIAGRAM_ANCHORS.findIndex((a, i) => !used.has(i) && a.match.test(module.slot));
    let at: { x: number; y: number };
    if (idx >= 0) { used.add(idx); at = DIAGRAM_ANCHORS[idx]!; }
    else { at = { x: 12, y: extraY }; extraY += 24; }
    const ratio = Math.max(0, Math.min(1, module.hp / maxHp));
    const color = moduleColor(ratio);
    const critical = !module.destroyed && ratio < 0.35;
    // Anilla exterior de blindaje: cian mientras aguanta; roja tenue y
    // punteada cuando la pieza queda EXPUESTA (blindaje agotado).
    const armorLabel = maxPlating > 0
      ? (module.plating > 0 ? `🛡 ${module.plating}/${maxPlating} · ` : '⚠ EXPUESTO · ')
      : '';
    const armorRing = module.destroyed ? '' : maxPlating > 0
      ? (exposed
        ? `<circle cx="${at.x}" cy="${at.y}" r="${RP}" fill="none" stroke="var(--danger)" stroke-width="1.3" stroke-dasharray="2 3" opacity="0.6"/>`
        : `<circle cx="${at.x}" cy="${at.y}" r="${RP}" fill="none" stroke="var(--player)" stroke-width="1.6"` +
          ` stroke-dasharray="${(CIRCP * platingRatio).toFixed(1)} ${CIRCP.toFixed(1)}"` +
          ` transform="rotate(-90 ${at.x} ${at.y})" stroke-linecap="round" opacity="0.9"/>`)
      : '';
    const title = `${def?.name ?? module.slot} — ${module.destroyed ? 'DESTRUIDO' : `${armorLabel}${module.hp}/${maxHp}`}`;
    // Cable del nodo al corazón del casco (el torso), tenue.
    if (!/torso|body|core/.test(module.slot)) {
      wires.push(`<line x1="${at.x}" y1="${at.y}" x2="76" y2="42" class="wire${module.destroyed ? ' dead' : ''}"/>`);
    }
    if (module.destroyed) {
      nodes.push(
        `<g class="mnode broken"><title>${escapeHtml(title)}</title>` +
        `<circle cx="${at.x}" cy="${at.y}" r="${R}" class="socket"/>` +
        `<circle cx="${at.x}" cy="${at.y}" r="${R}" fill="none" stroke="var(--danger)" stroke-width="1.6" stroke-dasharray="3 3" opacity="0.8"/>` +
        `<text x="${at.x}" y="${at.y + 3.5}" class="broken-x">✕</text></g>`);
    } else {
      nodes.push(
        `<g class="mnode${critical ? ' critical' : ''}${exposed ? ' exposed' : ''}"><title>${escapeHtml(title)}</title>` +
        `<circle cx="${at.x}" cy="${at.y}" r="${R}" class="socket"/>` +
        armorRing +
        `<circle cx="${at.x}" cy="${at.y}" r="${R}" fill="none" stroke="${color}" stroke-width="2.4"` +
        ` stroke-dasharray="${(CIRC * ratio).toFixed(1)} ${CIRC.toFixed(1)}"` +
        ` transform="rotate(-90 ${at.x} ${at.y})" stroke-linecap="round"/>` +
        `<text x="${at.x}" y="${at.y + 3.5}" style="fill:${color}">${module.hp}</text></g>`);
    }
  }
  return `<svg class="mdiag" viewBox="0 0 160 92" role="img">` +
    `<g transform="translate(14 14) scale(3.3)" class="ghost">${spriteBody(unitTypeId)}</g>` +
    `<path d="M2 8 V2 H10 M150 2 H158 V8 M158 84 V90 H150 M10 90 H2 V84" class="corner"/>` +
    wires.join('') + nodes.join('') + '</svg>';
}

function renderAll(): void {
  renderBanner();
  renderBoard();
  renderActionbar();
  renderPreview();
  renderForecast();
  renderRoster();
}

// ── Registro de eventos ──────────────────────────────────────────────────

function unitLabel(id: string): string {
  return `${id} ${battle.unit(id).name}`;
}

function describe(event: BattleEvent): { text: string; cls?: string } | undefined {
  switch (event.type) {
    case 'turn-started': return { text: `── Turno de ${unitLabel(event.unitId)} ──`, cls: 'turn' };
    case 'unit-moved': {
      const to = event.path[event.path.length - 1]!;
      return { text: `${event.unitId} se mueve a (${to.x},${to.y})` };
    }
    case 'unit-boosted': {
      const to = event.path[event.path.length - 1]!;
      return { text: `${event.unitId} hace BOOST hasta (${to.x},${to.y})`, cls: 'good' };
    }
    case 'ability-used': return { text: `${event.unitId} usa ${battle.abilityOf(event.abilityId).name}` };
    case 'ability-missed': return { text: `...${event.targetUnitId} lo esquiva!`, cls: 'good' };
    case 'damage-dealt': return { text: `${event.targetUnitId} recibe ${event.amount} de daño (${event.targetHp} HP)`, cls: 'hit' };
    case 'hit-location-rolled': return undefined;
    case 'unit-armor-damaged': return undefined; // el goteo del búnker no satura el registro
    case 'unit-armor-broken': return { text: `🛡✕ el blindaje de refuerzo de ${unitLabel(event.unitId)} se AGOTA: el casco queda al descubierto`, cls: 'warn' };
    case 'module-armor-damaged': return undefined; // el goteo del blindaje no satura el registro
    case 'module-armor-broken': return { text: `🛡✕ blindaje de ${event.slot} de ${event.targetUnitId} ROTO: la pieza queda EXPUESTA`, cls: 'warn' };
    case 'module-damaged': return { text: `→ impacto en ${event.slot} (${event.moduleHp} HP del módulo)` };
    case 'module-destroyed': return { text: `💔 ${event.slot} de ${event.targetUnitId} DESTRUIDO`, cls: 'hit' };
    case 'unit-healed': return { text: `${event.targetUnitId} repara ${event.amount} (${event.targetHp} HP)`, cls: 'good' };
    case 'status-applied': return { text: `${event.targetUnitId} sufre ${STATUS_DEFINITIONS[event.status].name} (${event.duration}t)`, cls: 'warn' };
    case 'status-expired': return { text: `${STATUS_DEFINITIONS[event.status].name} expira en ${event.targetUnitId}` };
    case 'status-ticked': return { text: `${event.targetUnitId} pierde ${event.damage} HP por ${STATUS_DEFINITIONS[event.status].name}`, cls: 'warn' };
    case 'energy-changed':
      return event.reason === 'boost' || event.reason === 'ability'
        ? { text: `⚡ energía de ${event.unitId}: ${event.current} (${event.delta})` }
        : undefined;
    case 'heat-changed':
      if (event.delta <= 0) return undefined; // la disipación no satura el registro
      if (event.reason === 'overclock') {
        return { text: `🔥 SOBRECARGA: el reactor de ${event.unitId} escupe +${event.delta} de calor (${event.current})`, cls: 'warn' };
      }
      if (event.reason === 'strain') {
        return { text: `🔥 ${event.unitId} opera RODEADO: +${event.delta} de calor por trabajar al límite (${event.current})`, cls: 'warn' };
      }
      if (event.reason === 'weapon') {
        return { text: `🔥 ${unitLabel(event.unitId)} es COCIDO: +${event.delta} de calor en su reactor (${event.current})`, cls: 'hit' };
      }
      if (event.reason === 'fire') {
        return { text: `🔥 ${unitLabel(event.unitId)} arde: +${event.delta} de calor por el fuego (${event.current})`, cls: 'warn' };
      }
      return { text: `🔥 calor de ${event.unitId}: ${event.current} (+${event.delta})`, cls: 'warn' };
    case 'overclock-changed':
      return event.on
        ? { text: `🔥 ${unitLabel(event.unitId)} SOBRECARGA el reactor: +potencia/+iniciativa/+daño — el calor se disparará`, cls: 'warn' }
        : { text: `❄ ${unitLabel(event.unitId)} corta la sobrecarga del reactor`, cls: 'good' };
    case 'tempo-spent': return undefined; // el coste de tempo se ve en la línea de turnos, no satura el registro
    case 'overdrive-used':
      return { text: `⚡ ${unitLabel(event.unitId)} entra en SOBREMARCHA: golpe ×1.5 — cede su próximo turno`, cls: 'hit' };
    case 'weapon-reloaded': return { text: `${event.unitId} recarga (${event.ammo} disparos)`, cls: 'good' };
    case 'unit-shutdown': return { text: `⚠ ${unitLabel(event.unitId)}: APAGADO DE EMERGENCIA (${event.damage} daño interno)`, cls: 'warn' };
    case 'stance-changed': return { text: `${event.unitId} cambia a postura ${event.stance.toUpperCase()}` };
    case 'projectile-fired': return undefined; // el renderer 3D lo animará
    case 'unit-pushed': return { text: `${event.unitId} sale despedido a (${event.to.x},${event.to.y})`, cls: 'warn' };
    case 'terrain-destroyed': return { text: `💥 muro derribado en (${event.pos.x},${event.pos.y})`, cls: 'warn' };
    case 'terrain-razed': return { text: `🔥 el bosque de (${event.pos.x},${event.pos.y}) queda arrasado: sin cobertura`, cls: 'warn' };
    case 'tile-ignited': return { text: `🔥 la zona (${event.pos.x},${event.pos.y}) PRENDE: arderá ${event.turns} turnos`, cls: 'warn' };
    case 'tile-extinguished': return undefined; // el fin del fuego no satura el registro
    case 'unit-burned': return { text: `🔥 ${unitLabel(event.unitId)} se quema en el fuego: ${event.damage} de daño`, cls: 'hit' };
    case 'round-started': return { text: `━━ RONDA ${event.round} ━━`, cls: 'turn' };
    case 'reaction': return {
      text: `⚡ ¡${event.reaction === 'oportunidad' ? 'Tiro de oportunidad' : event.reaction === 'vigilancia' ? 'Disparo de VIGILANCIA' : 'Contraataque'} de ${unitLabel(event.unitId)} contra ${event.targetUnitId}!`,
      cls: 'warn',
    };
    case 'overwatch-set': return { text: `👁 ${unitLabel(event.unitId)} entra en VIGILANCIA: disparará al primero que se mueva`, cls: 'good' };
    case 'unit-retreated': return { text: `🏳 ${unitLabel(event.unitId)} se retira del campo (la máquina se salva)`, cls: 'warn' };
    case 'unit-ejected': return { text: `🪂 el piloto de ${unitLabel(event.unitId)} EYECTA: la máquina se pierde`, cls: 'warn' };
    case 'reinforcements-arrived': return { text: `🚨 REFUERZOS ENEMIGOS: ${event.unitIds.join(', ')} entran al campo`, cls: 'hit' };
    case 'command-link-lost': return { text: `⚠ EQUIPO ${event.team === 'player' ? 'JUGADOR' : 'ENEMIGO'}: comandante caído — enlace de mando perdido (-5 puntería/evasión)`, cls: 'warn' };
    case 'unit-destroyed': return { text: `💥 ${unitLabel(event.unitId)} queda fuera de combate!`, cls: 'hit' };
    case 'battle-ended': return { text: `★ Victoria del equipo ${event.winner === 'player' ? 'JUGADOR' : 'ENEMIGO'} ★`, cls: 'turn' };
    case 'turn-ended': return undefined;
  }
}

function log(text: string, cls?: string): void {
  const el = $('log');
  const line = document.createElement('div');
  if (cls) line.className = cls;
  line.textContent = text;
  el.prepend(line);
  while (el.childElementCount > 120) el.lastElementChild!.remove();
}

function logEvents(events: BattleEvent[]): void {
  allEvents.push(...events);
  for (const event of events) {
    if (event.type === 'unit-moved' || event.type === 'unit-boosted') {
      pendingMoveAnim = { unitId: event.unitId, path: event.path };
      if (currentView() === 'diorama' && !reducedMotion && event.path.length > 1) {
        dioramaWalk = { unitId: event.unitId, path: event.path, start: performance.now() };
        pendingMoveAnim = null; // el diorama anima por su cuenta
        requestAnimationFrame(walkFrame);
      }
    }
    if (event.type === 'unit-pushed') {
      pendingMoveAnim = { unitId: event.unitId, path: [event.from, event.to] };
    }
    if (event.type === 'damage-dealt' || event.type === 'status-ticked' || event.type === 'unit-shutdown') {
      pendingHits.add(event.type === 'damage-dealt' ? event.targetUnitId
        : event.type === 'status-ticked' ? event.targetUnitId : event.unitId);
    }
    // Números flotantes sobre el tablero (game feel).
    switch (event.type) {
      case 'damage-dealt': spawnFloat(event.targetUnitId, `−${event.amount}`, 'dmg'); break;
      case 'status-ticked': spawnFloat(event.targetUnitId, `−${event.damage}`, 'dmg'); break;
      case 'ability-missed': spawnFloat(event.targetUnitId, 'ESQUIVA', 'miss'); break;
      case 'unit-healed': spawnFloat(event.targetUnitId, `+${event.amount}`, 'heal'); break;
      case 'status-applied': spawnFloat(event.targetUnitId, STATUS_DEFINITIONS[event.status].name, 'stat'); break;
      case 'reaction': spawnFloat(event.unitId, '¡REACCIÓN!', 'stat'); break;
      case 'unit-retreated': spawnFloat(event.unitId, 'RETIRADA', 'miss'); break;
      case 'unit-ejected': spawnFloat(event.unitId, 'EYECCIÓN', 'miss'); break;
      default: break;
    }
    // Efectos sobre el tablero: trazadoras, impactos, polvo, explosiones.
    switch (event.type) {
      case 'ability-used':
        fxAttack = { unitId: event.unitId, hadProjectile: false };
        break;
      case 'projectile-fired':
        if (fxAttack?.unitId === event.unitId) fxAttack.hadProjectile = true;
        fxTracer(event.from, event.to, event.flightTime);
        break;
      case 'damage-dealt': {
        const at = fxUnitPos(event.targetUnitId);
        if (at) {
          const heavy = event.amount >= 30;
          if (fxAttack && !fxAttack.hadProjectile) fxSlash(at);
          fxImpact(at, heavy);
          if (heavy) fxShake(false);
        }
        break;
      }
      case 'unit-moved': fxDust(event.path); break;
      case 'unit-boosted': fxDust(event.path); break;
      case 'unit-pushed': {
        fxDust([event.from, event.to]);
        fxShake(false);
        break;
      }
      case 'unit-healed': {
        const at = fxUnitPos(event.targetUnitId);
        if (at) fxHeal(at);
        break;
      }
      case 'unit-destroyed': {
        const at = fxUnitPos(event.unitId);
        if (at) fxExplosion(at, true);
        fxShake(true);
        break;
      }
      case 'terrain-destroyed':
        fxExplosion(event.pos, false);
        fxShake(false);
        break;
      case 'terrain-razed':
        fxExplosion(event.pos, false);
        break;
      case 'reaction': {
        const at = fxUnitPos(event.unitId);
        if (at) fxSlash(at);
        break;
      }
      case 'unit-retreated': {
        const at = fxUnitPos(event.unitId);
        if (at) fxDust([at]);
        break;
      }
      case 'reinforcements-arrived':
        fxShake(false);
        break;
      case 'module-destroyed': {
        const at = fxUnitPos(event.targetUnitId);
        if (at) fxExplosion(at, false);
        break;
      }
      default: break;
    }
    const line = describe(event);
    if (line) log(line.text, line.cls);
  }
}

/*
 * ── Efectos de combate ─────────────────────────────────────────────────
 * Capa #fx sobre el tablero: trazadoras, fogonazos, impactos, tajos,
 * polvo y explosiones. Solo presentación: el estado ya está resuelto
 * cuando estos elementos nacen, y con movimiento reducido no existen.
 */

/** Centro de una casilla en píxeles dentro del panel del tablero. */
function fxCenter(pos: Position): { x: number; y: number } {
  if (currentView() === 'diorama') {
    const canvas = $('diorama') as HTMLCanvasElement;
    const rect = { left: canvas.offsetLeft, top: canvas.offsetTop };
    const scale = canvas.clientWidth > 0 ? canvas.clientWidth / canvas.width : 1;
    const tile = battle.map.tileAt(pos);
    const c = isoProjectView(pos.x, pos.y, tile.terrain === 'wall' ? tile.height + 1 : tile.height,
      battle.map.width, battle.map.height, dioramaRot);
    return { x: rect.left + c.x * scale, y: rect.top + (c.y - 12) * scale };
  }
  const board = $('board');
  return {
    x: board.offsetLeft + pos.x * CELL_PX + CELL_PX / 2,
    y: board.offsetTop + pos.y * CELL_PX + CELL_PX / 2,
  };
}

function fxSpawn(cls: string, pos: Position, keyframes: Keyframe[], opts: KeyframeAnimationOptions): void {
  if (reducedMotion) return;
  const at = fxCenter(pos);
  const el = document.createElement('div');
  el.className = `fx ${cls}`;
  el.style.left = `${at.x}px`;
  el.style.top = `${at.y}px`;
  $('fx').appendChild(el);
  el.animate(keyframes, { fill: 'forwards', ...opts });
  const life = Number(opts.duration ?? 400) + Number(opts.delay ?? 0);
  window.setTimeout(() => el.remove(), life + 60);
}

/** Trazadora del disparo: viaja del arma al objetivo siguiendo el evento. */
function fxTracer(from: Position, to: Position, flightTime: number): void {
  if (reducedMotion) return;
  const a = fxCenter(from);
  const b = fxCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const beam = flightTime < 0.15; // vuelo casi instantáneo: arma de energía
  const el = document.createElement('div');
  el.className = `fx fx-tracer${beam ? ' beam' : ''}`;
  el.style.left = `${a.x}px`;
  el.style.top = `${a.y}px`;
  el.style.transform = `rotate(${angle}deg)`;
  $('fx').appendChild(el);
  playSfx(beam ? 'beam' : 'shot');
  const duration = Math.max(90, Math.min(380, flightTime * 1000));
  el.animate([
    { transform: `translate(0, 0) rotate(${angle}deg)`, opacity: 1 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${angle}deg)`, opacity: 0.9 },
  ], { duration, easing: 'linear', fill: 'forwards' });
  window.setTimeout(() => el.remove(), duration + 40);
  // Fogonazo en la boca del arma.
  fxSpawn('fx-muzzle', from, [
    { opacity: 1, transform: 'translate(-50%, -50%) scale(0.4)' },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(1.6)' },
  ], { duration: 160, easing: 'ease-out' });
}

/** Impacto: anillo expansivo + chispas radiales. */
function fxImpact(pos: Position, heavy: boolean): void {
  playSfx('impact');
  fxSpawn('fx-ring', pos, [
    { opacity: 1, transform: 'translate(-50%, -50%) scale(0.5)' },
    { opacity: 0, transform: `translate(-50%, -50%) scale(${heavy ? 4 : 2.6})` },
  ], { duration: heavy ? 380 : 280, easing: 'ease-out' });
  const sparks = heavy ? 8 : 5;
  for (let i = 0; i < sparks; i++) {
    const angle = (Math.PI * 2 * i) / sparks + Math.random() * 0.7;
    const dist = (heavy ? 26 : 18) + Math.random() * 10;
    fxSpawn(`fx-spark${Math.random() < 0.4 ? ' metal' : ''}`, pos, [
      { opacity: 1, transform: 'translate(-50%, -50%)' },
      { opacity: 0, transform: `translate(${Math.cos(angle) * dist - 6}px, ${Math.sin(angle) * dist - 6}px)` },
    ], { duration: 300 + Math.random() * 160, easing: 'ease-out' });
  }
}

/** Tajo cuerpo a cuerpo: arco blanco que barre el objetivo. */
function fxSlash(pos: Position): void {
  playSfx('slash');
  fxSpawn('fx-slash', pos, [
    { opacity: 0, transform: 'translate(-50%, -50%) rotate(-160deg) scale(0.7)' },
    { opacity: 1, transform: 'translate(-50%, -50%) rotate(-40deg) scale(1.05)', offset: 0.4 },
    { opacity: 0, transform: 'translate(-50%, -50%) rotate(40deg) scale(1.15)' },
  ], { duration: 260, easing: 'ease-in-out' });
}

/** Polvo bajo las patas: una nube por casilla del camino, escalonada. */
function fxDust(path: Position[]): void {
  if (path.length > 1) playSfx('step');
  path.forEach((pos, i) => {
    fxSpawn('fx-dust', pos, [
      { opacity: 0.9, transform: 'translate(-50%, -30%) scale(0.6)' },
      { opacity: 0, transform: 'translate(-50%, -30%) scale(1.8)' },
    ], { duration: 420, delay: i * 100, easing: 'ease-out' });
  });
}

/** Explosión: núcleo brillante, humo y metralla. */
function fxExplosion(pos: Position, big: boolean): void {
  playSfx('explosion');
  fxSpawn('fx-boom', pos, [
    { opacity: 1, transform: 'translate(-50%, -50%) scale(0.5)' },
    { opacity: 1, transform: `translate(-50%, -50%) scale(${big ? 2.6 : 1.7})`, offset: 0.35 },
    { opacity: 0, transform: `translate(-50%, -50%) scale(${big ? 3.2 : 2.1})` },
  ], { duration: big ? 520 : 380, easing: 'ease-out' });
  const bits = big ? 10 : 6;
  for (let i = 0; i < bits; i++) {
    const angle = (Math.PI * 2 * i) / bits + Math.random();
    const dist = 20 + Math.random() * (big ? 34 : 20);
    fxSpawn('fx-spark metal', pos, [
      { opacity: 1, transform: 'translate(-50%, -50%)' },
      { opacity: 0, transform: `translate(${Math.cos(angle) * dist - 6}px, ${Math.sin(angle) * dist - 6}px)` },
    ], { duration: 380 + Math.random() * 220, easing: 'ease-out' });
  }
  for (let i = 0; i < (big ? 4 : 2); i++) {
    fxSpawn('fx-smoke', pos, [
      { opacity: 0.8, transform: 'translate(-50%, -50%) scale(0.7)' },
      { opacity: 0, transform: `translate(${(Math.random() - 0.5) * 26 - 10}px, ${-18 - Math.random() * 18}px) scale(2.2)` },
    ], { duration: 700, delay: 120 + i * 130, easing: 'ease-out' });
  }
}

/** Reparación: motas verdes que suben. */
function fxHeal(pos: Position): void {
  playSfx('heal');
  for (let i = 0; i < 4; i++) {
    fxSpawn('fx-heal', pos, [
      { opacity: 1, transform: `translate(${(i - 1.5) * 9 - 3}px, 6px)` },
      { opacity: 0, transform: `translate(${(i - 1.5) * 9 - 3}px, -22px)` },
    ], { duration: 480, delay: i * 90, easing: 'ease-out' });
  }
}

/** Sacudida del tablero: los golpes serios se sienten en la cabina. */
function fxShake(big: boolean): void {
  if (reducedMotion) return;
  const panel = $('board-panel');
  panel.classList.remove('shake', 'shake-big');
  void panel.offsetWidth; // reinicia la animación si ya estaba sonando
  panel.classList.add(big ? 'shake-big' : 'shake');
  window.setTimeout(() => panel.classList.remove('shake', 'shake-big'), big ? 500 : 320);
}

/** Posición actual de una unidad (para anclar efectos). */
function fxUnitPos(unitId: string): Position | undefined {
  return battle.units.find((u) => u.id === unitId)?.position;
}

/** El ataque en curso: para distinguir tiro (hubo trazadora) de garra. */
let fxAttack: { unitId: string; hadProjectile: boolean } | null = null;

/**
 * Número flotante sobre la unidad: vive en la capa #floats (fuera del
 * tablero, que se reconstruye en cada render) y se limpia solo.
 */
let floatStagger = 0;
function spawnFloat(unitId: string, text: string, cls: string): void {
  if (reducedMotion) return;
  const unit = battle.units.find((u) => u.id === unitId);
  if (!unit) return;
  const board = $('board');
  const span = document.createElement('span');
  span.className = `float ${cls}`;
  span.textContent = text;
  const at = fxCenter(unit.position);
  span.style.left = `${at.x}px`;
  span.style.top = `${at.y - CELL_PX / 2 + 6}px`;
  $('floats').appendChild(span);
  const delay = (floatStagger++ % 3) * 110; // varios impactos no se pisan
  span.style.opacity = '0';
  span.animate([
    { opacity: 0, transform: 'translate(-50%, -100%) translateY(6px)' },
    { opacity: 1, transform: 'translate(-50%, -100%) translateY(-6px)', offset: 0.25 },
    { opacity: 1, transform: 'translate(-50%, -100%) translateY(-18px)', offset: 0.75 },
    { opacity: 0, transform: 'translate(-50%, -100%) translateY(-30px)' },
  ], { duration: 820, delay, easing: 'ease-out', fill: 'forwards' });
  window.setTimeout(() => span.remove(), 900 + delay);
}

function showOverlay(): void {
  const won = battle.winner === 'player';
  $('ov-title').textContent = won ? 'Victoria' : 'Derrota';
  $('ov-title').style.color = won ? 'var(--player)' : 'var(--enemy)';
  // Liquida el contrato (fija el destino de vuelta) ANTES de decidir el texto.
  $('ov-merc').innerHTML = activeContract ? settleContract() : '';
  // El botón y el subtítulo dicen A DÓNDE se vuelve — mismas condiciones que
  // restart(), para que texto y acción nunca mientan.
  const toWorld = returnToWorld && !!expedition && !!campaign;
  const toMerc = !toWorld && returnToMerc && !!campaign;
  const restartBtn = $('ov-restart');
  if (toWorld) {
    $('ov-sub').textContent = won
      ? 'Contrato cumplido. [Enter] para volver al mapa (seguir o volver).'
      : 'Toca replegarse. [Enter] para volver al mapa.';
    restartBtn.textContent = '🗺 Volver al mapa';
  } else if (toMerc) {
    $('ov-sub').textContent = won
      ? 'Misión cerrada. [Enter] para volver al cuartel.'
      : 'La expedición se pierde. [Enter] para volver al cuartel.';
    restartBtn.textContent = '⚒ Volver al cuartel';
  } else {
    $('ov-sub').textContent = won
      ? 'El equipo cian controla el campo. [Enter] para otra batalla.'
      : 'Tus Zoids quedan fuera de combate. [Enter] para reintentar.';
    restartBtn.textContent = 'Nueva batalla';
  }
  $('ov-xp').innerHTML = renderXpSummary();
  $('overlay').classList.add('show');
}

/**
 * Reparte la XP de la batalla terminada entre los pilotos (una sola vez),
 * la persiste y devuelve el resumen HTML para el overlay.
 */
function renderXpSummary(): string {
  if (!xpAwarded) {
    xpAwarded = true;
    const roster = Object.fromEntries(PLAYER_IDS.map((id, i) => [id, PILOT_IDS[i]!]));
    const survivors = new Set(battle.units.filter((u) => u.hp > 0).map((u) => u.id));
    const gains = awardXp(allEvents, roster, unitTeams, startPositions, battle.winner, survivors);
    const before: Record<string, Record<string, number>> = {};
    for (const [id, pilot] of Object.entries(pilots)) {
      before[id] = Object.fromEntries(
        Object.entries(pilot.tracks).map(([spec, xp]) => [spec, trackLevel(xp)]));
    }
    pilots = applyXp(pilots, gains);

    // Memoria y manías: lo vivido deja huella en cada piloto desplegado.
    const quirkLines: string[] = [];
    const playerUnits = battle.units.filter((u) => u.team === 'player' && /^P\d+$/.test(u.id));
    const alliesLostTotal = playerUnits.filter((u) => u.hp <= 0).length;
    for (const unit of playerUnits) {
      const pilotId = PILOT_IDS[Number(unit.id.slice(1)) - 1];
      const pilot = pilotId ? pilots[pilotId] : undefined;
      if (!pilot) continue;
      const ratio = unit.hp / Math.max(1, battle.effectiveStats(unit).maxHp);
      const before = pilot.stress ?? 0;
      const observed = observeBattle(pilot, {
        events: allEvents, unitId: unit.id, finalHpRatio: ratio,
        victory: battle.winner === 'player',
        alliesLost: alliesLostTotal - (unit.hp <= 0 ? 1 : 0),
      }, PERKS);
      pilots = { ...pilots, [pilot.id]: observed.pilot };
      const after = observed.pilot.stress;
      if (Math.abs(after - before) >= 5 || after >= 50) {
        quirkLines.push(`<div>💢 <b>${escapeHtml(observed.pilot.name)}</b>: estrés ${before}→${after}${stressLabel(after) ? ` <span style="color:var(--heat)">(${stressLabel(after)})</span>` : ''}</div>`);
      }
      for (const quirk of observed.gained) {
        quirkLines.push(`<div>🧠 <b>${escapeHtml(observed.pilot.name)}</b> adquiere la manía <b class="lvlup">${quirk.name}</b> — <span style="color:var(--muted)">${quirk.description}</span></div>`);
      }
    }
    savePilots();

    const lines: string[] = [...quirkLines];
    for (const pilotId of PILOT_IDS) {
      const pilot = pilots[pilotId]!;
      const own = gains.filter((g) => g.pilotId === pilotId);
      if (own.length === 0) continue;
      const bits = own.map((g) => {
        const leveled = trackLevel(pilot.tracks[g.track]) > (before[pilotId]?.[g.track] ?? 0);
        return `+${g.amount} ${SPEC_LABEL[g.track]}${leveled ? ' <b class="lvlup">▲ ¡NIVEL!</b>' : ''}`;
      });
      lines.push(`<div><b>${escapeHtml(pilot.name)}</b> · ${bits.join(' · ')}</div>`);
    }
    lastXpSummary = lines.length > 0
      ? `<div class="xp-title">Experiencia de pilotos</div>${lines.join('')}`
      : '';
  }
  return lastXpSummary;
}

let lastXpSummary = '';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// ── Pantalla de garaje ───────────────────────────────────────────────────

let garageOpen = false;

const ROLE_LABEL: Record<string, string> = {
  assault: 'asalto', skirmisher: 'escaramuza', tank: 'tanque', sniper: 'tirador',
  flyer: 'volador', support: 'soporte', artillery: 'artillería', scout: 'explorador',
  transport: 'transporte',
};

function openGarage(): void {
  garageOpen = true;
  closeMerc();
  renderGarage();
  $('garage').classList.add('show');
}

function closeGarage(): void {
  garageOpen = false;
  $('garage').classList.remove('show');
}

/** Stats efectivas de un hueco vía una batalla desechable de un spawn. */
function previewStats(config: SlotConfig, pilotId?: string): ReturnType<Battle['effectiveStats']> | undefined {
  try {
    const preview = new Battle({
      map: VALLEY_CROSSING,
      unitCatalog: ZOIDS,
      abilityCatalog: CATALOGS.abilityCatalog,
      moduleCatalog: MODULES,
      weaponCatalog: CATALOGS.weaponCatalog,
      seed: 1,
      spawns: [{
        id: 'PV', name: 'PV', unitTypeId: config.unitTypeId, team: 'player',
        position: { x: 1, y: 3 }, loadout: spawnLoadout(config),
      }],
      ...(pilotId ? { pilots: { PV: pilots[pilotId]! }, perkTable: PERKS } : {}),
    });
    return preview.effectiveStats(preview.units[0]!);
  } catch {
    return undefined;
  }
}

/** Piezas montadas cuya spec casa con la escuela PRINCIPAL del piloto. */
function synergyPieces(config: SlotConfig, pilot: PilotState): { spec: SpecializationId; count: number } | undefined {
  const dominant = pilot.mainSpec;
  if (!dominant || trackLevel(pilot.tracks[dominant]) === 0) return undefined;
  const def = ZOIDS[config.unitTypeId]!;
  const specs: (SpecializationId | undefined)[] = [
    ...config.weapons.map((w) => CATALOGS.weaponCatalog[w]?.spec),
    ...(def.frame ?? []).map((entry) => MODULES[config.slots[entry.slot] ?? entry.moduleId]?.spec),
  ];
  const count = Math.min(PERKS.synergyCap, specs.filter((s) => s === dominant).length);
  return count > 0 ? { spec: dominant, count } : undefined;
}

/** Etiqueta del tramo de estrés alcanzado ('' si está entero). */
function stressLabel(stress: number): string {
  const tier = [...(PERKS.stressTiers ?? [])].sort((a, b) => b.min - a.min).find((t) => stress >= t.min);
  return tier?.label ?? '';
}

/** Niveles del árbol ACTIVO: básica + principal + secundaria. */
function activePilotLevels(pilot: PilotState): number {
  let levels = trackLevel(pilot.basics ?? 0);
  if (pilot.mainSpec) levels += trackLevel(pilot.tracks[pilot.mainSpec]);
  if (pilot.sideSpec) levels += trackLevel(pilot.tracks[pilot.sideSpec]);
  return levels;
}

function pilotSummary(pilot: PilotState): string {
  const bits: string[] = [`Pilotaje <b>N${trackLevel(pilot.basics ?? 0)}</b>`];
  if (pilot.mainSpec) {
    bits.push(`★ ${SPEC_LABEL[pilot.mainSpec]} <b>N${trackLevel(pilot.tracks[pilot.mainSpec])}</b>`);
  }
  if (pilot.sideSpec) {
    bits.push(`☆ ${SPEC_LABEL[pilot.sideSpec]} <b>N${trackLevel(pilot.tracks[pilot.sideSpec])}</b>`);
  }
  if (!pilot.mainSpec) bits.push('<span class="gmuted">sin especializar — elígela en Compañía</span>');
  return bits.join(' · ');
}

function renderGarage(): void {
  const host = $('gslots');
  host.innerHTML = '';

  garage.forEach((config, index) => {
    const def = ZOIDS[config.unitTypeId]!;
    const pilotId = PILOT_IDS[index]!;
    const pilot = pilots[pilotId]!;
    const card = document.createElement('div');
    card.className = 'gcard';

    // Cabecera: hueco + nombre del piloto (editable, no re-renderiza).
    const head = document.createElement('div');
    head.className = 'ghead-row';
    head.innerHTML = `<span class="gtag">${PLAYER_IDS[index]}${index === 0 ? ' ★' : ''}</span>`;
    const nameInput = document.createElement('input');
    nameInput.className = 'gname';
    nameInput.value = pilot.name;
    nameInput.maxLength = 18;
    nameInput.title = 'nombre del piloto';
    nameInput.addEventListener('input', () => {
      pilot.name = nameInput.value.trim() || DEFAULT_PILOT_NAMES[index]!;
      savePilots();
    });
    head.appendChild(nameInput);
    card.appendChild(head);

    const tracks = document.createElement('div');
    tracks.className = 'gtracks';
    tracks.innerHTML = pilotSummary(pilot);
    card.appendChild(tracks);

    const mkRow = (label: string, control: HTMLElement): void => {
      const row = document.createElement('label');
      row.className = 'grow';
      row.innerHTML = `<span>${label}</span>`;
      row.appendChild(control);
      card.appendChild(row);
    };

    // Chasis (solo los con precio: las bestias de escenario no se pilotan).
    const zoidSelect = document.createElement('select');
    for (const unit of Object.values(ZOIDS)) {
      if (ECONOMY.zoidPrices[unit.id] === undefined) continue;
      const opt = document.createElement('option');
      opt.value = unit.id;
      opt.textContent = `${unit.name} · ${ROLE_LABEL[unit.role] ?? unit.role}`;
      if (unit.id === config.unitTypeId) opt.selected = true;
      zoidSelect.appendChild(opt);
    }
    zoidSelect.addEventListener('change', () => {
      garage[index] = factorySlot(zoidSelect.value);
      saveGarage();
      renderGarage();
    });
    mkRow('Zoid', zoidSelect);

    // Armas (hasta 3; el chasis pone las innatas gratis aparte).
    const legalWeapons = compatibleWeapons(config.unitTypeId);
    for (let slot = 0; slot < 3; slot++) {
      const weaponSelect = document.createElement('select');
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '— sin arma —';
      weaponSelect.appendChild(none);
      for (const weaponId of legalWeapons) {
        const weapon = CATALOGS.weaponCatalog[weaponId]!;
        const opt = document.createElement('option');
        opt.value = weaponId;
        opt.textContent = weapon.spec ? `${weapon.name} [${SPEC_LABEL[weapon.spec]}]` : weapon.name;
        if (config.weapons[slot] === weaponId) opt.selected = true;
        weaponSelect.appendChild(opt);
      }
      weaponSelect.addEventListener('change', () => {
        const picked = [0, 1, 2].map((s) => (s === slot ? weaponSelect.value : config.weapons[s] ?? ''));
        garage[index] = { ...config, weapons: picked.filter(Boolean) };
        saveGarage();
        renderGarage();
      });
      mkRow(`Arma ${slot + 1}`, weaponSelect);
    }

    // Módulos por slot del frame (solo si hay recambios que ofrecer).
    for (const entry of def.frame ?? []) {
      const options = (GARAGE_MODULE_OPTIONS[entry.slot] ?? []).filter((id) => MODULES[id]);
      if (options.length === 0) continue;
      const moduleSelect = document.createElement('select');
      for (const moduleId of [entry.moduleId, ...options]) {
        const module = MODULES[moduleId]!;
        const opt = document.createElement('option');
        opt.value = moduleId;
        opt.textContent = moduleId === entry.moduleId
          ? `${module.name} (fábrica)`
          : module.spec ? `${module.name} [${SPEC_LABEL[module.spec]}]` : module.name;
        if ((config.slots[entry.slot] ?? entry.moduleId) === moduleId) opt.selected = true;
        moduleSelect.appendChild(opt);
      }
      moduleSelect.addEventListener('change', () => {
        const slots = { ...config.slots };
        if (moduleSelect.value === entry.moduleId) delete slots[entry.slot];
        else slots[entry.slot] = moduleSelect.value;
        garage[index] = { ...config, slots };
        saveGarage();
        renderGarage();
      });
      mkRow(entry.slot, moduleSelect);
    }

    // Vista previa de stats en vivo: loadout actual (con piloto) vs fábrica.
    const stats = previewStats(config, pilotId);
    const factory = previewStats(factorySlot(config.unitTypeId));
    const statsBox = document.createElement('div');
    statsBox.className = 'gstats';
    if (stats && factory) {
      const rows: [string, keyof typeof stats][] = [
        ['HP', 'maxHp'], ['ATQ', 'atk'], ['ATQ.E', 'energyAtk'], ['DEF', 'def'],
        ['DEF.E', 'energyDef'], ['VEL', 'speed'], ['MOV', 'move'], ['EVA', 'evade'], ['PUNT', 'accuracy'],
      ];
      statsBox.innerHTML = rows.map(([label, stat]) => {
        const value = stats[stat];
        const delta = value - factory[stat];
        const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : '';
        return `<span class="gstat"><i>${label}</i> <b class="${cls}">${value}</b>${delta !== 0 ? `<em class="${cls}">${delta > 0 ? '+' : ''}${delta}</em>` : ''}</span>`;
      }).join('');
      const synergy = synergyPieces(config, pilot);
      if (synergy) {
        statsBox.insertAdjacentHTML('beforeend',
          `<div class="gsyn">◈ Sinergia ${SPEC_LABEL[synergy.spec]} ×${synergy.count} — piloto y máquina alineados</div>`);
      }
    } else {
      statsBox.textContent = '⚠ loadout inválido';
    }
    card.appendChild(statsBox);
    host.appendChild(card);
  });
}

// ── Modo mercenario (pantalla de campaña) ────────────────────────────────

const CAMPAIGN_KEY = 'gea-campaign-v1';
const TIER_LABEL: Record<Contract['tier'], string> = {
  escolta: 'Escolta', asalto: 'Asalto', caza: 'Caza', incursion: 'Incursión', defensa: 'Defensa',
};

const factoryLoadout = (unitTypeId: string): { weapons: string[]; slots: Record<string, string> } =>
  ({ weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])], slots: {} });

function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as CampaignState;
    if (!Array.isArray(state.roster) || typeof state.credits !== 'number') return null;
    // Campañas anteriores a la capa de viaje: dotarlas de intendencia.
    if (typeof state.supplies !== 'number') state.supplies = ECONOMY.startingSupplies;
    if (!Array.isArray(state.cargo)) state.cargo = [];
    if (!Array.isArray(state.moduleBlueprints)) state.moduleBlueprints = [];
    if (!state.companion || typeof state.companion !== 'object') state.companion = newCompanion();
    if (!state.reputation || typeof state.reputation !== 'object') state.reputation = {};
    if (!Array.isArray(state.chronicle)) state.chronicle = [];
    if (typeof state.homeRegionId !== 'string') state.homeRegionId = SALT_PASS_REGION.id;
    if (!Array.isArray(state.assignments)) state.assignments = [];
    return state;
  } catch {
    return null;
  }
}

let campaign: CampaignState | null = loadCampaign();
let selectedContractId: string | null = null;
/** Contrato de la batalla en curso (null = escaramuza libre). */
let activeContract: Contract | null = null;
/** Huecos del roster desplegados en la batalla de contrato actual. */
let deployedSlots: number[] = [];
/** Tras resolver un contrato, "Nueva batalla" vuelve a la campaña. */
let returnToMerc = false;
let mercOpen = false;
/** Marcas grabadas por la compañera en la última batalla (parte). */
let companionMarkLines: string[] = [];

/** Apunta líneas en el diario de la compañía (el que llama, guarda). */
function chronicle(...lines: string[]): void {
  if (!campaign) return;
  campaign = { ...campaign, chronicle: [...campaign.chronicle, ...lines].slice(-400) };
}

function saveCampaign(): void {
  try {
    if (campaign) localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(campaign));
    else localStorage.removeItem(CAMPAIGN_KEY);
  } catch { /* almacenamiento privado */ }
}

/** maxHp real del hueco (motor manda: montaje + perks del piloto). */
function campaignMaxHp(slot: number): number {
  const zoid = campaign!.roster[slot]!;
  const stats = previewStats(
    { unitTypeId: zoid.unitTypeId, weapons: zoid.weapons, slots: zoid.slots },
    PILOT_IDS[slot]!,
  );
  return stats?.maxHp ?? ZOIDS[zoid.unitTypeId]!.stats.maxHp;
}

function openMerc(): void {
  if (!campaign) {
    campaign = newCampaign(ECONOMY, factoryLoadout);
    saveCampaign();
  }
  mercOpen = true;
  closeGarage();
  renderMerc();
  $('merc').classList.add('show');
}

function closeMerc(): void {
  mercOpen = false;
  $('merc').classList.remove('show');
}

function renderMerc(): void {
  if (!campaign) return;
  const company = localStorage.getItem(COMPANY_KEY);
  const base = homeRegion();
  const baseNode = base.nodes.find((n) => n.id === base.hq);
  $('merc-status').textContent =
    `${company ? `${company} · ` : ''}⌾ ${campaign.credits} créditos · contratos completados: ${campaign.contractsDone}` +
    ` · base: ${baseNode?.name ?? base.name} (${base.name})`;
  renderMercTabs();
  const anyAlive = campaign.roster.some((z) => !z.destroyed);
  const deploy = $('merc-deploy') as HTMLButtonElement;
  deploy.disabled = !selectedContractId || !anyAlive;
  deploy.textContent = selectedContractId ? '⚑ Partir al contrato' : '⚑ Partir al contrato (elige uno)';
  ($('merc-freeroam') as HTMLButtonElement).disabled = !anyAlive;
}

/** Panel de reputación del cuartel: cómo nos mira cada facción. */
let chronicleOpen = false;

function chronicleHtml(): string {
  if (!campaign || campaign.chronicle.length === 0) {
    return '<div class="cempty">Aún no hay nada escrito. Sal ahí fuera: el diario se escribe solo.</div>';
  }
  return [...campaign.chronicle].reverse().map((line) => {
    const cls = line === '· · ·' ? ' sep' : line.includes('⚠') || line.startsWith('✝') ? ' warn' : line.includes('❤') ? ' mark' : '';
    return `<div class="cline${cls}">${escapeHtml(line)}</div>`;
  }).join('');
}

function openChronicle(): void {
  if (!campaign) return;
  chronicleOpen = true;
  $('chronicle-body').innerHTML = chronicleHtml();
  $('chronicle').classList.add('show');
}

function closeChronicle(): void {
  chronicleOpen = false;
  $('chronicle').classList.remove('show');
}

// Pestañas del cuartel: Operaciones (decidir) / Hangar (tocar) /
// Compañía (consultar). Se recuerda la última abierta.
let mercTab: 'operaciones' | 'hangar' | 'compania' =
  (localStorage.getItem('gea-merc-tab') as 'operaciones' | 'hangar' | 'compania') ?? 'operaciones';

function renderMercTabs(): void {
  for (const tab of ['operaciones', 'hangar', 'compania'] as const) {
    $(`mtab-${tab}`).classList.toggle('on', mercTab === tab);
    $(`tab-${tab}`).classList.toggle('on', mercTab === tab);
  }
  // Solo se construye la pestaña visible: el cuartel abre ligero.
  if (mercTab === 'operaciones') {
    renderContracts();
    renderAssignments();
  } else if (mercTab === 'hangar') {
    renderMercHangar();
    renderMercStore();
  } else {
    renderReputation();
    renderPilots('merc-pilots');
    $('merc-diario').innerHTML = chronicleHtml();
  }
}

for (const tab of ['operaciones', 'hangar', 'compania'] as const) {
  $(`mtab-${tab}`).addEventListener('click', () => {
    mercTab = tab;
    try { localStorage.setItem('gea-merc-tab', tab); } catch { /* privado */ }
    playSfx('click');
    renderMercTabs();
  });
}

/** Panel de destacamentos: la compañía trabaja aunque no la mires. */
function renderAssignments(): void {
  const host = $('merc-assignments');
  host.innerHTML = '';
  const active = campaign!.assignments ?? [];

  // En curso: progreso, llamadas pendientes y regresos por liquidar.
  for (const assignment of active) {
    const spec = ASSIGNMENT_SPECS.find((sp) => sp.id === assignment.specId);
    if (!spec) continue;
    const pilot = pilots[PILOT_IDS[assignment.slot]!]!;
    const card = document.createElement('div');
    card.className = 'acard';
    const pct = Math.round((assignment.daysDone / assignment.totalDays) * 100);
    card.innerHTML =
      `<div class="aname">📡 ${spec.name}</div>` +
      `<div class="ameta">${escapeHtml(pilot.name)} · jornada ${assignment.daysDone}/${assignment.totalDays}</div>` +
      `<div class="abar"><i style="width:${pct}%"></i></div>` +
      `<div class="ablurb">${escapeHtml(assignment.log[assignment.log.length - 1] ?? '')}</div>`;
    if (assignment.pendingCall) {
      const btn = document.createElement('button');
      btn.className = 'call';
      btn.textContent = '📞 Atender la llamada';
      btn.addEventListener('click', () => {
        const call = assignment.pendingCall!;
        void uiChoice(`${pilot.name} — ${call.prompt}`, call.options.map((o) => ({
          id: o.id, label: o.label, detail: o.detail,
        }))).then((optionId) => {
          if (!campaign) return;
          campaign = {
            ...campaign,
            assignments: campaign.assignments!.map((a) => (a === assignment ? resolveAssignmentCall(a, optionId) : a)),
          };
          saveCampaign();
          renderMerc();
        });
      });
      card.appendChild(btn);
    } else if (assignmentDone(assignment)) {
      const btn = document.createElement('button');
      btn.textContent = '✔ Recibir al destacamento';
      btn.addEventListener('click', () => {
        if (!campaign) return;
        const pilotId = PILOT_IDS[assignment.slot]!;
        const levels = activePilotLevels(pilots[pilotId]!);
        const report = finishAssignment(assignment, spec, levels);
        campaign = {
          ...campaign,
          credits: campaign.credits + report.credits,
          assignments: campaign.assignments!.filter((a) => a !== assignment),
        };
        for (const change of report.reputation) {
          campaign = { ...campaign, reputation: adjustReputation(campaign.reputation, change.factionId, change.delta) };
        }
        const gains = Object.entries(report.xp).map(([track, amount]) => ({
          pilotId, track: track as SpecializationId, amount: amount ?? 0,
        }));
        pilots = applyXp(pilots, gains);
        if (report.stressDelta !== 0) pilots[pilotId] = adjustStress(pilots[pilotId]!, report.stressDelta);
        if (report.injuryDays > 0) pilots[pilotId] = injurePilot(pilots[pilotId]!, report.injuryDays);
        chronicle(report.line);
        savePilots();
        saveCampaign();
        playSfx(report.grade === 'fracaso' ? 'impact' : 'heal');
        renderMerc();
      });
      card.appendChild(btn);
    }
    host.appendChild(card);
  }

  // Ofertas: encargos sin destacamento en curso.
  for (const spec of ASSIGNMENT_SPECS) {
    if (active.some((a) => a.specId === spec.id)) continue;
    const card = document.createElement('div');
    card.className = 'acard';
    const xpBits = Object.entries(spec.xp).map(([t, n]) => `${SPEC_LABEL[t as SpecializationId]} +${n}`).join(' · ');
    card.innerHTML =
      `<div class="aname">${spec.name}</div>` +
      `<div class="ablurb">${spec.blurb}</div>` +
      `<div class="ameta">${spec.days} jornadas · paga ⌾${spec.reward} · XP ${xpBits}</div>`;
    // La compañera (hueco 1) no se separa de ti: destacables 2-4.
    const candidates = campaign!.roster
      .map((zoid, slot) => ({ zoid, slot }))
      .filter(({ zoid, slot }) => slot > 0 && !zoid.destroyed &&
        !isInjured(pilots[PILOT_IDS[slot]!]!) && !assignmentOf(slot));
    const btn = document.createElement('button');
    btn.textContent = candidates.length > 0 ? '📡 Destacar piloto…' : 'sin pilotos disponibles';
    btn.disabled = candidates.length === 0;
    btn.addEventListener('click', () => {
      void uiChoice(`¿A quién destacas? ${spec.name} (${spec.days} jornadas). Su máquina se va con él: no despliega hasta volver.`,
        candidates.map(({ zoid, slot }) => {
          const pilot = pilots[PILOT_IDS[slot]!]!;
          const levels = SPECIALIZATIONS.reduce((n, t) => n + trackLevel(pilot.tracks[t]), 0);
          return {
            id: String(slot),
            label: `${pilot.name} — ${ZOIDS[zoid.unitTypeId]!.name}`,
            detail: `${levels} niveles de pista (a más experiencia, mejor grado de éxito)`,
          };
        })).then((slotId) => {
        if (!campaign) return;
        const slot = Number(slotId);
        campaign = {
          ...campaign,
          assignments: [...(campaign.assignments ?? []), startAssignment(spec, slot, `${spec.id}|${Date.now()}`)],
        };
        chronicle(`📡 ${pilots[PILOT_IDS[slot]!]!.name} parte destacado: ${spec.name} (${spec.days} jornadas).`);
        saveCampaign();
        renderMerc();
      });
    });
    card.appendChild(btn);
    host.appendChild(card);
  }
}

function renderReputation(): void {
  const host = $('merc-rep');
  host.innerHTML = '';
  for (const faction of FACTIONS) {
    const value = campaign!.reputation[faction.id] ?? 0;
    const tier = reputationTier(value);
    const half = Math.abs(value) / REPUTATION_MAX * 50; // % de media barra
    const color = value >= 0 ? 'var(--energy)' : 'var(--danger)';
    const card = document.createElement('div');
    card.className = 'repcard';
    card.innerHTML =
      `<div><span class="rname">${faction.name}</span>` +
      `<span class="rtier ${tier.id}">${tier.label} ${value > 0 ? '+' : ''}${value}</span></div>` +
      `<div class="rblurb">${faction.blurb}</div>` +
      `<div class="rbar"><span class="zero"></span>` +
      `<i style="${value >= 0 ? `left:50%` : `right:50%`};width:${half}%;background:${color}"></i></div>`;
    host.appendChild(card);
  }
}

function renderContracts(): void {
  const host = $('contracts');
  host.innerHTML = '';
  // El cupo de la mesa depende de cómo te mira el Gremio.
  const guildTier = reputationTier(campaign!.reputation['gremio'] ?? 0);
  const slots = contractSlots(guildTier.id);
  const all = contractOffers(campaign!.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL);
  const rot = campaign!.contractsDone % all.length;
  const offers = [...all.slice(rot), ...all.slice(0, rot)].slice(0, slots);
  if (slots < 3) {
    host.insertAdjacentHTML('beforeend',
      `<div class="cnote" style="grid-column:1/-1">⚖ El Gremio te mira con recelo (${guildTier.label}): solo ${slots === 1 ? 'un contrato' : `${slots} contratos`} sobre la mesa. La reputación se repara trabajando… o ayudando en la ruta.</div>`);
  }
  if (!offers.some((c) => c.id === selectedContractId)) selectedContractId = null;
  for (const contract of offers) {
    const card = document.createElement('div');
    card.className = 'ccard' + (contract.id === selectedContractId ? ' sel' : '');
    card.innerHTML =
      `<div class="ctier ${contract.tier}">${TIER_LABEL[contract.tier]}</div>` +
      `<div class="cname">${contract.name}</div>` +
      `<div class="creward">recompensa ⌾${contract.reward} · chatarra ⌾${contract.salvagePerKill}/baja</div>` +
      `<div class="csquad">contra: ${contract.enemySquad.map((id) => ZOIDS[id]!.name).join(' · ')}</div>`;
    card.addEventListener('click', () => {
      selectedContractId = contract.id;
      renderMerc();
    });
    host.appendChild(card);
  }
}

function renderMercHangar(): void {
  const host = $('merc-hangar');
  host.innerHTML = '';
  campaign!.roster.forEach((zoid, slot) => {
    const def = ZOIDS[zoid.unitTypeId]!;
    const pilot = pilots[PILOT_IDS[slot]!]!;
    const maxHp = campaignMaxHp(slot);
    const card = document.createElement('div');
    card.className = 'gcard';

    card.innerHTML =
      `<div class="ghead-row"><span class="gtag">P${slot + 1}${slot === 0 ? ' ❤' : ''}</span>` +
      `<b style="font-family:var(--mono);font-size:13px">${def.name}</b>` +
      (slot === 0 ? '<span class="gmuted" style="font-size:9px;letter-spacing:0.14em"> COMPAÑERA</span>' : '') +
      '</div>' +
      `<div class="gtracks">${escapeHtml(pilot.name)}${isInjured(pilot) ? ` <span class="symptom">🩹 ${pilot.injuryDays}j</span>` : ''}${assignmentOf(slot) ? ' <span class="symptom" style="border-color:var(--player);color:var(--player)">📡 destacado</span>' : ''} · ${pilotSummary(pilot)}</div>`;
    {
      const record = zoidRecord(zoid);
      const tier = serviceTier(record);
      const scars = scarLevel(record);
      card.insertAdjacentHTML('beforeend',
        `<div class="gservice"><span class="gsil">${unitSprite(zoid.unitTypeId, 'east', scars)}</span>` +
        `<span>📜 ${tier.label} · ${record.battles} batalla${record.battles === 1 ? '' : 's'} · ${record.kills} derribo${record.kills === 1 ? '' : 's'}` +
        `${record.rebuilds > 0 ? ` · ${record.rebuilds} ${record.rebuilds === 1 ? 'reconstrucción' : 'reconstrucciones'}` : ''}` +
        `${record.ejections > 0 ? ` · ${record.ejections} ${record.ejections === 1 ? 'eyección' : 'eyecciones'}` : ''}` +
        `${scars > 0 ? ` · <span class="symptom">${'✚'.repeat(scars)} cicatrices</span>` : ''}</span></div>`);
    }
    if (slot === 0) {
      const bio = document.createElement('div');
      bio.className = 'gbio';
      const companion = campaign!.companion;
      const tier = [...COMPANION_TABLE.rapportTiers].sort((a, b) => b.min - a.min)
        .find((t) => companion.rapport >= t.min);
      const chips = companion.markIds.map((id) => {
        const mark = COMPANION_TABLE.marks[id];
        return mark ? `<span class="pquirk" title="${escapeHtml(mark.description)}">${mark.name}</span>` : '';
      }).join('');
      const empty = Array.from({ length: Math.max(0, COMPANION_TABLE.markCap - companion.markIds.length) })
        .map(() => '<span class="pquirk empty" title="Espacio de núcleo libre: las marcas se graban viviendo.">· · ·</span>').join('');
      bio.innerHTML =
        `<div class="qtitle">Núcleo (${companion.markIds.length}/${COMPANION_TABLE.markCap})</div>${chips}${empty}` +
        `<div class="qtitle" style="margin-top:5px">Compenetración ${companion.rapport}/${COMPANION_TABLE.rapportCap}` +
        (tier ? ` · <span style="color:var(--energy)">${tier.label}</span>` : '') + '</div>';
      card.appendChild(bio);
    }

    if (zoid.destroyed) {
      const cost = rebuildCost(zoid, ECONOMY);
      const wreck = document.createElement('div');
      wreck.className = 'gwreck';
      wreck.textContent = '💥 DESTRUIDO — no se desplegará';
      card.appendChild(wreck);
      const btn = document.createElement('button');
      btn.className = 'gbtn';
      btn.textContent = `Reconstruir (⌾${cost})`;
      btn.disabled = campaign!.credits < cost;
      btn.addEventListener('click', () => {
        campaign = rebuildZoid(campaign!, slot, campaignMaxHp(slot), ECONOMY);
        if (slot === 0) {
          const marked = recordCompanionEvent(campaign.companion, 'reconstrucciones', COMPANION_TABLE);
          campaign = { ...campaign, companion: marked.companion };
        }
        saveCampaign();
        renderMerc();
      });
      card.appendChild(btn);
    } else {
      const hp = Math.min(zoid.hp, maxHp);
      const row = document.createElement('div');
      row.className = 'ghp';
      row.innerHTML =
        `<span>HP</span><span class="bar hp"><i style="width:${Math.round((hp / maxHp) * 100)}%"></i></span>` +
        `<span>${hp}/${maxHp}</span>`;
      card.appendChild(row);
      const cost = repairCost(zoid, maxHp, ECONOMY);
      if (cost > 0) {
        const btn = document.createElement('button');
        btn.className = 'gbtn';
        btn.textContent = `Reparar (⌾${cost})`;
        btn.disabled = campaign!.credits < cost;
        btn.addEventListener('click', () => {
          campaign = repairZoid(campaign!, slot, campaignMaxHp(slot), ECONOMY);
          saveCampaign();
          renderMerc();
        });
        card.appendChild(btn);
      }
    }

    // Refuerzo de blindaje: un búnker que absorbe antes que el casco, a
    // cambio de velocidad. Se monta, se repara y se quita en el taller.
    if (!zoid.destroyed) {
      const r = ECONOMY.reinforcement;
      if (zoid.reinforced) {
        const armor = Math.max(0, Math.min(zoid.armor ?? r.armor, r.armor));
        const note = document.createElement('div');
        note.className = 'gnote';
        note.textContent = `🛡 Blindaje de refuerzo: ${armor}/${r.armor}${armor < r.armor ? ' (gastado)' : ''} · −${r.movePenalty} MOV al desplegar`;
        card.appendChild(note);
        const repCost = armorRepairCost(zoid, ECONOMY);
        if (repCost > 0) {
          const rb = document.createElement('button');
          rb.className = 'gbtn';
          rb.textContent = `Reparar blindaje (⌾${repCost})`;
          rb.disabled = campaign!.credits < repCost;
          rb.addEventListener('click', () => { campaign = repairArmor(campaign!, slot, ECONOMY); saveCampaign(); renderMerc(); });
          card.appendChild(rb);
        }
        const sb = document.createElement('button');
        sb.className = 'gbtn';
        sb.textContent = 'Quitar refuerzo (recupera velocidad)';
        sb.addEventListener('click', () => { campaign = stripReinforcement(campaign!, slot); saveCampaign(); renderMerc(); });
        card.appendChild(sb);
      } else {
        const fb = document.createElement('button');
        fb.className = 'gbtn';
        fb.textContent = `🛡 Reforzar blindaje (⌾${r.fitCost}: +${r.armor} búnker, −${r.movePenalty} MOV)`;
        fb.disabled = campaign!.credits < r.fitCost;
        fb.addEventListener('click', () => { campaign = reinforceArmor(campaign!, slot, ECONOMY); saveCampaign(); renderMerc(); });
        card.appendChild(fb);
      }
    }

    const mkRow = (label: string, control: HTMLElement): void => {
      const row = document.createElement('label');
      row.className = 'grow';
      row.innerHTML = `<span>${label}</span>`;
      row.appendChild(control);
      card.appendChild(row);
    };

    // Cambiar de chasis (retoma incluida en el precio mostrado).
    const chassisSelect = document.createElement('select');
    const keep = document.createElement('option');
    keep.value = '';
    keep.textContent = `${def.name} (actual)`;
    chassisSelect.appendChild(keep);
    for (const unit of Object.values(ZOIDS)) {
      if (unit.id === zoid.unitTypeId) continue;
      const price = ECONOMY.zoidPrices[unit.id];
      if (price === undefined) continue;
      const probe = buyZoid(campaign!, slot, unit.id, maxHp, ECONOMY, factoryLoadout);
      const net = campaign!.credits - probe.credits;
      const opt = document.createElement('option');
      opt.value = unit.id;
      opt.textContent = `${unit.name} · neto ⌾${net}`;
      opt.disabled = probe === campaign; // no alcanzan los créditos
      chassisSelect.appendChild(opt);
    }
    chassisSelect.addEventListener('change', async () => {
      if (!chassisSelect.value) return;
      if (slot === 0 && (campaign!.companion.markIds.length > 0 || campaign!.companion.rapport > 0)) {
        if (!(await uiConfirm('Es tu COMPAÑERA. Cambiar de chasis borra sus marcas y la compenetración — la biografía no se compra de vuelta. ¿Seguro?'))) {
          renderMerc();
          return;
        }
      }
      const before = campaign!;
      campaign = buyZoid(campaign!, slot, chassisSelect.value, maxHp, ECONOMY, factoryLoadout);
      if (slot === 0 && campaign !== before) {
        campaign = { ...campaign, companion: newCompanion() };
      }
      saveCampaign();
      renderMerc();
    });
    mkRow('Cambiar chasis', chassisSelect);

    // Armas: solo las que se poseen y tienen unidad libre.
    if (!zoid.destroyed) {
      const legal = compatibleWeapons(zoid.unitTypeId);
      for (let wSlot = 0; wSlot < 3; wSlot++) {
        const current = zoid.weapons[wSlot] ?? '';
        const weaponSelect = document.createElement('select');
        const none = document.createElement('option');
        none.value = '';
        none.textContent = '— sin arma —';
        weaponSelect.appendChild(none);
        for (const weaponId of legal) {
          const owned = campaign!.armory[weaponId] ?? 0;
          if (owned === 0) continue;
          const spare = owned - mountedCount(campaign!, weaponId) + (current === weaponId ? 1 : 0);
          if (spare <= 0) continue;
          const weapon = CATALOGS.weaponCatalog[weaponId]!;
          const opt = document.createElement('option');
          opt.value = weaponId;
          opt.textContent = weapon.spec ? `${weapon.name} [${SPEC_LABEL[weapon.spec]}]` : weapon.name;
          if (current === weaponId) opt.selected = true;
          weaponSelect.appendChild(opt);
        }
        weaponSelect.addEventListener('change', () => {
          const picked = [0, 1, 2]
            .map((s) => (s === wSlot ? weaponSelect.value : zoid.weapons[s] ?? ''))
            .filter(Boolean);
          campaign = setMountedWeapons(campaign!, slot, picked);
          saveCampaign();
          renderMerc();
        });
        mkRow(`Arma ${wSlot + 1}`, weaponSelect);
      }

      // Módulos por slot del frame: solo la pieza de fábrica y los
      // planos comprados en fábricas de piezas.
      for (const entry of def.frame ?? []) {
        const options = (GARAGE_MODULE_OPTIONS[entry.slot] ?? [])
          .filter((id) => MODULES[id] && campaign!.moduleBlueprints.includes(id));
        if (options.length === 0) continue;
        const moduleSelect = document.createElement('select');
        for (const moduleId of [entry.moduleId, ...options]) {
          const module = MODULES[moduleId]!;
          const opt = document.createElement('option');
          opt.value = moduleId;
          opt.textContent = moduleId === entry.moduleId
            ? `${module.name} (fábrica)`
            : module.spec ? `${module.name} [${SPEC_LABEL[module.spec]}]` : module.name;
          if ((zoid.slots[entry.slot] ?? entry.moduleId) === moduleId) opt.selected = true;
          moduleSelect.appendChild(opt);
        }
        moduleSelect.addEventListener('change', () => {
          const slots = { ...zoid.slots };
          if (moduleSelect.value === entry.moduleId) delete slots[entry.slot];
          else slots[entry.slot] = moduleSelect.value;
          campaign = {
            ...campaign!,
            roster: campaign!.roster.map((z, i) => (i === slot ? { ...z, slots } : z)),
          };
          saveCampaign();
          renderMerc();
        });
        mkRow(entry.slot, moduleSelect);
      }

      // Stats en vivo con las piezas actuales.
      const stats = previewStats(
        { unitTypeId: zoid.unitTypeId, weapons: zoid.weapons, slots: zoid.slots },
        PILOT_IDS[slot]!,
      );
      if (stats) {
        const statsBox = document.createElement('div');
        statsBox.className = 'gstats';
        const rows: [string, keyof typeof stats][] = [
          ['HP', 'maxHp'], ['ATQ', 'atk'], ['ATQ.E', 'energyAtk'], ['DEF', 'def'],
          ['VEL', 'speed'], ['MOV', 'move'], ['EVA', 'evade'], ['PUNT', 'accuracy'],
        ];
        statsBox.innerHTML = rows.map(([label, stat]) =>
          `<span class="gstat"><i>${label}</i> <b>${stats[stat]}</b></span>`).join('');
        card.appendChild(statsBox);
      }
    }

    host.appendChild(card);
  });
}

function renderMercStore(): void {
  const host = $('merc-store');
  host.innerHTML = '';
  // Intendencia: suministros de expedición (una jornada por unidad).
  const supplies = document.createElement('div');
  supplies.className = 'srow';
  supplies.innerHTML = `<span class="sname">Suministros de expedición</span><span class="sown">×${campaign!.supplies}</span>`;
  for (const count of [1, 5]) {
    const buy = document.createElement('button');
    buy.className = 'gbtn';
    buy.textContent = `+${count} (⌾${count * ECONOMY.supplyPrice})`;
    buy.disabled = campaign!.credits < count * ECONOMY.supplyPrice;
    buy.addEventListener('click', () => {
      campaign = buySupplies(campaign!, count, ECONOMY);
      saveCampaign();
      renderMerc();
    });
    supplies.appendChild(buy);
  }
  host.appendChild(supplies);
  for (const [weaponId, price] of Object.entries(ECONOMY.weaponPrices)) {
    const weapon = CATALOGS.weaponCatalog[weaponId];
    if (!weapon) continue;
    const owned = campaign!.armory[weaponId] ?? 0;
    const spare = owned - mountedCount(campaign!, weaponId);
    const row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML =
      `<span class="sname">${weapon.name}${weapon.spec ? ` [${SPEC_LABEL[weapon.spec]}]` : ''}</span>` +
      (owned > 0 ? `<span class="sown">×${owned}</span>` : '');
    const buy = document.createElement('button');
    buy.className = 'gbtn';
    buy.textContent = `⌾${price}`;
    buy.title = 'comprar';
    buy.disabled = campaign!.credits < price;
    buy.addEventListener('click', () => {
      campaign = buyWeapon(campaign!, weaponId, ECONOMY);
      saveCampaign();
      renderMerc();
    });
    row.appendChild(buy);
    if (spare > 0) {
      const sell = document.createElement('button');
      sell.className = 'gbtn';
      sell.textContent = `vender ⌾${Math.round(price * ECONOMY.sellFactor)}`;
      sell.addEventListener('click', () => {
        campaign = sellWeapon(campaign!, weaponId, ECONOMY);
        saveCampaign();
        renderMerc();
      });
      row.appendChild(sell);
    }
    host.appendChild(row);
  }
}

/** Candidatos a salir (vivos, sanos y sin destacar), sin la compañera. */
function partyCandidates(): Array<{ slot: number; label: string; detail: string }> {
  return campaign!.roster
    .map((zoid, slot) => ({ zoid, slot }))
    .filter(({ zoid, slot }) => slot > 0 && !zoid.destroyed &&
      !isInjured(pilots[PILOT_IDS[slot]!]!) && !assignmentOf(slot))
    .map(({ zoid, slot }) => {
      const pilot = pilots[PILOT_IDS[slot]!]!;
      return {
        slot,
        label: `${pilot.name} — ${ZOIDS[zoid.unitTypeId]!.name}`,
        detail: `${Math.min(zoid.hp, campaignMaxHp(slot))}/${campaignMaxHp(slot)} HP · ${pilotSummary(pilot).replace(/<[^>]+>/g, '') || 'novato'}`,
      };
    });
}

/** Acepta el contrato seleccionado y abre la expedición hacia su lugar. */
function startContractExpedition(): void {
  if (!campaign || !selectedContractId) return;
  const offers = contractOffers(campaign.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL);
  const contract = offers.find((c) => c.id === selectedContractId);
  if (!contract) return;
  if (!campaign.roster.some((z) => !z.destroyed)) return;
  void uiParty(`Formación para "${contract.name}": ¿quiénes van? Solo podrás reorganizar en ciudad.`,
    partyCandidates(), [1, 2, 3]).then((party) => {
    if (!party) return; // se canceló la salida
    expedition = { ...startExpedition(homeRegion(), contract.id, contract.tier), party };
    syncRegion();
    saveExpedition();
    closeMerc();
    openWorld();
  });
}

/** Sale a recorrer la región sin contrato: explorar es un fin en sí. */
function startFreeRoam(): void {
  if (!campaign) return;
  if (!campaign.roster.some((z) => !z.destroyed)) return;
  void uiParty('Formación para salir a explorar: ¿quiénes van? Solo podrás reorganizar en ciudad.',
    partyCandidates(), [1, 2, 3]).then((party) => {
    if (!party) return;
    expedition = { ...startFreeExpedition(homeRegion(), String(Date.now())), party };
    syncRegion();
    saveExpedition();
    closeMerc();
    openWorld();
  });
}

/** Liquida el contrato al terminar la batalla; devuelve el HTML del parte. */
function settleContract(): string {
  const contract = activeContract!;
  activeContract = null;
  const isTavern = contract.id.startsWith('tav-');
  // Destino de vuelta fijado YA, antes de liquidar nada: pase lo que pase
  // (o falle) en el reparto, el jugador vuelve a donde toca — al mapa si la
  // expedición sigue, al cuartel si se cierra — NUNCA a una escaramuza
  // suelta. Las ramas de abajo lo confirman; este es el seguro.
  if (isTavern || (expedition && battle.winner === 'player')) {
    returnToWorld = true; returnToMerc = false;
  } else {
    returnToWorld = false; returnToMerc = true;
  }
  // La compañera (hueco 1) registra la batalla en su núcleo.
  companionMarkLines = [];
  const injuryLines = (): string[] =>
    injuredNames.map(({ name, days }) =>
      `<div class="mloss">${days === 1 ? '🪂' : '🩹'} ${name} ${days === 1 ? 'eyectó a tiempo' : 'sale herido'}: ${days} jornada${days === 1 ? '' : 's'} de baja</div>`);
  if (campaign && deployedSlots.includes(0)) {
    const unit = battle.units.find((u) => u.id === 'P1');
    if (unit) {
      const ratio = unit.hp / Math.max(1, battle.effectiveStats(unit).maxHp);
      const observed = observeCompanionBattle(campaign.companion, {
        events: allEvents, unitId: 'P1', finalHpRatio: ratio, weather: battle.weather,
      }, COMPANION_TABLE);
      campaign = { ...campaign, companion: observed.companion };
      for (const mark of observed.gained) {
        companionMarkLines.push(
          `<div>❤ La compañera graba una marca: <b class="lvlup">${mark.name}</b> — <span style="color:var(--muted)">${mark.description}</span></div>`);
        if (expedition) {
          expedition = {
            ...expedition,
            log: [...expedition.log, `Día ${expedition.day} — ❤ La compañera graba una marca: ${mark.name}.`],
          };
        }
      }
    }
  }
  // El precio humano: quien pierde su máquina en combate sale HERIDO —
  // 3 jornadas de baja y un golpe de estrés. Determinista, sin dados.
  const injuredNames: Array<{ name: string; days: number }> = [];
  if (campaign) {
    for (const slot of deployedSlots) {
      const unit = battle.units.find((u) => u.id === `P${slot + 1}`);
      const pilotId = PILOT_IDS[slot];
      if (!unit || !pilotId || unit.hp > 0) continue;
      // Eyectar a tiempo salva al piloto: 1 jornada frente a 3.
      const days = unit.ejected ? 1 : 3;
      pilots[pilotId] = adjustStress(injurePilot(pilots[pilotId]!, days), unit.ejected ? 8 : 15);
      injuredNames.push({ name: pilots[pilotId]!.name, days });
      if (expedition) {
        expedition = {
          ...expedition,
          log: [...expedition.log, unit.ejected
            ? `Día ${expedition.day} — 🪂 ${pilots[pilotId]!.name} eyectó a tiempo: 1 jornada de baja.`
            : `Día ${expedition.day} — 🩹 ${pilots[pilotId]!.name} sale herido del combate: 3 jornadas de baja.`],
        };
      }
    }
    if (injuredNames.length > 0) savePilots();
  }
  // La hoja de servicio del metal: cada batalla queda grabada en la
  // máquina que la peleó (batallas, derribos, eyecciones, retiradas).
  if (campaign) {
    const kills = new Map<string, number>();
    let lastAttacker: string | undefined;
    for (const event of allEvents) {
      if (event.type === 'damage-dealt') lastAttacker = event.unitId;
      else if (event.type === 'unit-destroyed' && lastAttacker && lastAttacker !== event.unitId) {
        kills.set(lastAttacker, (kills.get(lastAttacker) ?? 0) + 1);
      }
    }
    const serviceLines: string[] = [];
    campaign = {
      ...campaign,
      roster: campaign.roster.map((zoid, slot) => {
        if (!deployedSlots.includes(slot)) return zoid;
        const unit = battle.units.find((u) => u.id === `P${slot + 1}`);
        if (!unit) return zoid;
        const before = serviceTier(zoidRecord(zoid));
        const updated = updateZoidRecord(zoid, {
          battles: 1,
          kills: kills.get(unit.id) ?? 0,
          ejections: unit.ejected ? 1 : 0,
          retreats: unit.retreated ? 1 : 0,
        });
        const after = serviceTier(zoidRecord(updated));
        if (after.min > before.min) {
          const record = zoidRecord(updated);
          serviceLines.push(`⭐ El ${ZOIDS[zoid.unitTypeId]!.name} ya es ${after.label.toUpperCase()}: ${record.battles} batallas y ${record.kills} derribos a cuestas.`);
        }
        return updated;
      }),
    };
    if (expedition && serviceLines.length > 0) {
      expedition = {
        ...expedition,
        log: [...expedition.log, ...serviceLines.map((line) => `Día ${expedition!.day} — ${line}`)],
      };
    }
  }
  // Trabajo de taberna: paga y daña, pero no toca la misión oficial ni
  // el ciclo de contratos; gane o pierda, se vuelve al mapa.
  if (isTavern && expedition && campaign) {
    const finalHpT = campaign.roster.map((_, slot) =>
      deployedSlots.includes(slot) ? battle.unit(`P${slot + 1}`).hp : undefined);
    const finalArmorT = campaign.roster.map((z, slot) =>
      z.reinforced && deployedSlots.includes(slot) ? battle.unit(`P${slot + 1}`).armor ?? 0 : undefined);
    const enemiesDownT = battle.units.filter((u) => u.team === 'enemy' && u.hp <= 0).length;
    const settled = resolveContract(campaign, contract, {
      winner: battle.winner, finalHp: finalHpT, finalArmor: finalArmorT, enemiesDestroyed: enemiesDownT,
    });
    // resolveContract avanza el ciclo oficial: lo devolvemos a su sitio.
    campaign = { ...settled.state, contractsDone: campaign.contractsDone };
    expedition = {
      ...expedition,
      tavernJobsDone: [...(expedition.tavernJobsDone ?? []), expedition.at],
      log: [...expedition.log,
        `Día ${expedition.day} — Trabajo de taberna "${contract.name}": ${settled.report.rewardPaid ? `cumplido, +⌾${settled.report.creditsEarned}` : `salió mal (+⌾${settled.report.creditsEarned} de chatarra)`}.`],
    };
    returnToWorld = true;
    returnToMerc = false;
    saveCampaign();
    saveExpedition();
    const lines = [
      ...companionMarkLines,
      ...injuryLines(),
      `<div><b>${contract.name}</b> — trabajo de taberna</div>`,
      `<div class="mgain">+⌾${settled.report.creditsEarned}${settled.report.rewardPaid ? '' : ' (sin paga: solo chatarra)'}</div>`,
    ];
    if (settled.report.lost.length > 0) {
      lines.push(`<div class="mloss">bajas: ${settled.report.lost.map((id) => ZOIDS[id]!.name).join(', ')}</div>`);
    }
    return lines.join('');
  }
  // Con expedición en curso: la victoria devuelve al mapa (decidir si
  // seguir o volver); la derrota es retirada — la expedición se acaba.
  if (expedition) {
    if (battle.winner === 'player') {
      expedition = {
        ...expedition,
        missionDone: true,
        forcedWeather: undefined,
        log: [...expedition.log, `Día ${expedition.day} — Contrato cumplido: ${contract.name}.`],
      };
      returnToWorld = true;
      returnToMerc = false;
    } else {
      chronicle(...expedition.log,
        `✝ Día ${expedition.day} — Retirada en ${REGION.nodes.find((n) => n.id === expedition!.at)?.name ?? 'campo abierto'}: la expedición se pierde.`);
      expedition = null;
      returnToWorld = false;
      returnToMerc = true;
    }
    saveExpedition();
  } else {
    returnToMerc = true;
  }
  const finalHp = campaign!.roster.map((_, slot) =>
    deployedSlots.includes(slot) ? battle.unit(`P${slot + 1}`).hp : undefined);
  const finalArmor = campaign!.roster.map((z, slot) =>
    z.reinforced && deployedSlots.includes(slot) ? battle.unit(`P${slot + 1}`).armor ?? 0 : undefined);
  const enemiesDestroyed = battle.units.filter((u) => u.team === 'enemy' && u.hp <= 0).length;
  const { state, report } = resolveContract(campaign!, contract, {
    winner: battle.winner,
    finalHp,
    finalArmor,
    enemiesDestroyed,
  });
  campaign = state;
  saveCampaign();

  const lines = [
    ...companionMarkLines,
    ...injuryLines(),
    `<div><b>${contract.name}</b> — ${TIER_LABEL[contract.tier]}</div>`,
    `<div class="mgain">+⌾${report.creditsEarned} (${report.rewardPaid ? `recompensa ⌾${contract.reward} + ` : 'sin recompensa · '}chatarra ⌾${report.salvage})</div>`,
  ];
  if (report.lost.length > 0) {
    lines.push(`<div class="mloss">bajas: ${report.lost.map((id) => ZOIDS[id]!.name).join(', ')} — reconstruir cuesta el 60%</div>`);
  }
  lines.push(`<div class="pv-muted" style="color:var(--muted)">saldo: ⌾${campaign.credits}</div>`);
  return lines.join('');
}

// ── Expedición: el mapa de mundo ─────────────────────────────────────────

let REGION = SALT_PASS_REGION;

const WEATHER_BADGE: Record<WeatherId, string> = {
  clear: '☀ despejado', rain: '🌧 lluvia', sandstorm: '🌪 tormenta de arena',
};

/** La base de operaciones: el último taller donde se cerró expedición. */
function homeRegion(): WorldRegion {
  try {
    return regionOf(WORLD_ATLAS, campaign?.homeRegionId ?? SALT_PASS_REGION.id);
  } catch {
    return SALT_PASS_REGION;
  }
}

/** La región activa sigue a la expedición; sin expedición, el cuartel. */
function syncRegion(): void {
  try {
    REGION = regionOf(WORLD_ATLAS, expedition?.regionId ?? SALT_PASS_REGION.id);
  } catch {
    REGION = SALT_PASS_REGION;
  }
}
const EXPEDITION_KEY = 'gea-expedition-v1';
const CARGO_CAPACITY = 4;
/** Daño de marcha forzada por jornada sin suministros (fracción de maxHp). */
const FORCED_MARCH_DAMAGE = 0.08;

function loadExpedition(): ExpeditionState | null {
  try {
    const raw = localStorage.getItem(EXPEDITION_KEY);
    if (!raw) return null;
    const exp = JSON.parse(raw) as ExpeditionState;
    // Expediciones de antes del atlas: vivían en el Paso de Sal.
    if (typeof exp.regionId !== 'string') exp.regionId = SALT_PASS_REGION.id;
    const home = WORLD_ATLAS.regions.find((r) => r.id === exp.regionId);
    if (!home) return null;
    const validNode = (id: string): boolean => home.nodes.some((n) => n.id === id);
    if (!validNode(exp.at) || !Array.isArray(exp.log)) return null;
    return exp;
  } catch {
    return null;
  }
}

let expedition: ExpeditionState | null = loadExpedition();
syncRegion();
let worldOpen = false;
/** Tras liquidar un contrato de expedición ganado, se vuelve al mapa. */
let returnToWorld = false;

function saveExpedition(): void {
  try {
    if (expedition) localStorage.setItem(EXPEDITION_KEY, JSON.stringify(expedition));
    else localStorage.removeItem(EXPEDITION_KEY);
  } catch { /* almacenamiento privado */ }
}

function expeditionContract(): Contract | undefined {
  if (!campaign || !expedition) return undefined;
  return contractOffers(campaign.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL)
    .find((c) => c.id === expedition!.contractId);
}

function openWorld(): void {
  worldOpen = true;
  closeMerc();
  closeGarage();
  closeEditor();
  renderWorld();
  $('world').classList.add('show');
}

function closeWorld(): void {
  worldOpen = false;
  $('world').classList.remove('show');
}

function renderWorld(): void {
  if (!campaign || !expedition) return;
  const contract = expeditionContract();
  const target = REGION.nodes.find((n) => n.id === expedition!.targetNodeId)!;
  const here = REGION.nodes.find((n) => n.id === expedition!.at)!;
  const discovered = campaign.discovered ?? [];
  const continent = WORLD_ATLAS.continents.find((c) => c.id === REGION.continentId);
  $('world-title').textContent = `${continent ? `${continent.name} · ` : ''}${REGION.name}`;
  const sky = expedition.forcedWeather ?? weatherFor(REGION, expedition.day);
  $('world-status').textContent =
    `Día ${expedition.day} · ${WEATHER_BADGE[sky]} · suministros ${campaign.supplies} · ⌾${campaign.credits}` +
    (contract ? ` · misión: ${contract.name} → ${target.name}${expedition.missionDone ? ' ✔' : ''}` : '');

  // Tramos como líneas SVG (los rotos, discontinuos).
  // Tramos: solo los que unen dos lugares YA visibles (los latentes de un
  // secreto no descubierto no se dibujan).
  const svg = $('world-svg');
  svg.innerHTML = REGION.edges.filter((e) => isEdgeVisible(REGION, e, discovered)).map((e) => {
    const a = REGION.nodes.find((n) => n.id === e.a)!;
    const b = REGION.nodes.find((n) => n.id === e.b)!;
    const blocked = expedition!.blockedEdges.includes(edgeKey(e.a, e.b));
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"${blocked ? ' class="blocked"' : ''}/>`;
  }).join('');

  // Nodos: los ocultos no se dibujan hasta descubrirlos.
  const nodesHost = $('world-nodes');
  nodesHost.innerHTML = '';
  for (const node of REGION.nodes) {
    if (!isNodeVisible(node, discovered)) continue;
    const el = document.createElement('div');
    el.className = 'wnode' +
      (node.id === expedition.at ? ' cur' : '') +
      (node.id === expedition.targetNodeId && !expedition.missionDone ? ' target' : '') +
      (node.id === REGION.hq ? ' hq' : '') +
      (node.kind === 'ruinas' ? ' ruin' : '');
    el.style.left = `${node.x}%`;
    el.style.top = `${node.y}%`;
    el.title = node.description;
    const glyph = node.secret ? '✦ ' : node.kind === 'ruinas' ? '🏛 ' : '';
    el.innerHTML = `<div class="dot"></div><span class="tag">${node.id === REGION.hq ? '⚒ ' : ''}${node.id === expedition.targetNodeId && !expedition.missionDone ? '🎯 ' : ''}${glyph}</span>${node.name}`;
    nodesHost.appendChild(el);
  }

  // Rutas disponibles desde aquí. Sin suministros, la tripulación solo
  // acepta moverse hacia la civilización.
  const routes = $('world-routes');
  routes.innerHTML = '';
  const starving = campaign.supplies <= 0;
  const allowed = starving
    ? new Set(edgesTowardCivilization(expedition, REGION).map((e) => edgeKey(e.a, e.b)))
    : null;
  if (starving) {
    routes.insertAdjacentHTML('beforeend',
      '<div class="wwarn">⚠ SIN SUMINISTROS: la tripulación solo acepta rutas hacia la ciudad más cercana.</div>');
  }
  for (const edge of neighbors(REGION, expedition.at)) {
    const destination = REGION.nodes.find((n) => n.id === otherEnd(edge, expedition!.at))!;
    if (!isNodeVisible(destination, discovered)) continue; // destino aún oculto
    const broken = expedition.blockedEdges.includes(edgeKey(edge.a, edge.b));
    const locked = allowed !== null && !allowed.has(edgeKey(edge.a, edge.b));
    const days = edge.days + (broken ? 1 : 0);
    const btn = document.createElement('button');
    btn.className = 'wroute' + (locked ? ' locked' : '');
    btn.disabled = locked;
    btn.innerHTML = `${locked ? '🔒 ' : broken ? '⛏ ' : '→ '}<b>${destination.name}</b> · ${broken ? 'vadear el puente caído' : edge.flavor} · <span class="cost">${days} jornada${days > 1 ? 's' : ''}</span>`;
    if (!locked) btn.addEventListener('click', () => doTravel(edge));
    routes.appendChild(btn);
  }

  // Transportes interregionales desde este lugar: caminos, ferris y
  // lanzaderas. Con horario y pasaje a la vista; sin sorpresas a bordo.
  for (const link of linksFrom(WORLD_ATLAS, REGION.id, expedition.at)) {
    const to = linkDestination(link, REGION.id, expedition.at);
    const destRegion = regionOf(WORLD_ATLAS, to.regionId);
    const destNode = destRegion.nodes.find((n) => n.id === to.nodeId)!;
    const destContinent = WORLD_ATLAS.continents.find((c) => c.id === destRegion.continentId);
    const icon = link.kind === 'ferry' ? '⛴' : link.kind === 'lanzadera' ? '🚀' : '🛤';
    const btn = document.createElement('button');
    btn.className = 'wroute wlink';
    const broke = link.fare > 0 && campaign.credits < link.fare;
    btn.disabled = broke;
    btn.innerHTML = `${icon} <b>${destNode.name}</b> · ${destRegion.name}` +
      `${destContinent && destContinent.id !== REGION.continentId ? ` (${destContinent.name})` : ''}` +
      ` · ${link.flavor} · <span class="cost">${link.days} jornada${link.days > 1 ? 's' : ''}${link.fare > 0 ? ` · pasaje ⌾${link.fare}` : ''}</span>` +
      (broke ? ' · sin fondos' : '');
    if (!broke) btn.addEventListener('click', () => doUseLink(link));
    routes.appendChild(btn);
  }

  // Acciones del lugar.
  const actions = $('world-actions');
  actions.innerHTML = '';
  if (expedition.at === expedition.targetNodeId && !expedition.missionDone && contract) {
    const fight = document.createElement('button');
    fight.textContent = `⚔ Entablar combate — ${contract.name}`;
    fight.addEventListener('click', fightExpeditionBattle);
    actions.appendChild(fight);
  }
  if (expedition.at === REGION.hq) {
    const home = document.createElement('button');
    home.className = 'calm';
    home.textContent = expedition.missionDone
      ? '⚒ Entrar al taller (vender bodega y cerrar la expedición)'
      : '⚒ Entrar al taller (ABANDONAR la expedición)';
    home.addEventListener('click', endExpedition);
    actions.appendChild(home);
  }
  if (canExplore(expedition, REGION, discovered)) {
    const explore = document.createElement('button');
    explore.textContent = here.kind === 'ruinas'
      ? (here.secret ? '✦ Registrar la ruina secreta (1 día)' : '🔦 Explorar las ruinas (1 día)')
      : '🧭 Registrar el lugar (1 día)';
    explore.addEventListener('click', doExplore);
    actions.appendChild(explore);
  }
  if (here.city) {
    const enter = document.createElement('button');
    enter.className = 'calm';
    enter.textContent = `🏙 Entrar a ${here.name} (nivel ${here.city.level}${here.city.factory ? ` · fábrica de ${here.city.factory}` : ''})`;
    enter.addEventListener('click', () => openCity());
    actions.appendChild(enter);
  }
  $('world-cargo').innerHTML = campaign.cargo.length > 0
    ? campaign.cargo.map((c) => `<div>${c.name} · ⌾${c.value}</div>`).join('') +
      `<div>(${campaign.cargo.length}/${CARGO_CAPACITY})</div>`
    : `<div>vacía (0/${CARGO_CAPACITY})</div>`;
  $('world-log').innerHTML = [...expedition.log].reverse()
    .map((line) => `<div${line.includes('⚠') ? ' class="warn"' : ''}>${line}</div>`).join('');
  void here;
}

// ── La ciudad: una pantalla propia, agrupada por establecimientos ───────

let cityOpen = false;

function cityNode(): (typeof REGION.nodes)[number] | undefined {
  if (!expedition) return undefined;
  const node = REGION.nodes.find((n) => n.id === expedition!.at);
  return node?.city ? node : undefined;
}

function openCity(): void {
  if (!cityNode()) return;
  cityOpen = true;
  cityBuilding = null; // siempre se llega a la plaza
  renderCity();
  $('city').classList.add('show');
}

/** Reorganizar la formación: solo en ciudad, como manda la regla. */
function editParty(): void {
  if (!campaign || !expedition) return;
  void uiParty('Reorganizar la formación: ¿quiénes siguen el viaje desde aquí?',
    partyCandidates(), (expedition.party ?? [0, 1, 2, 3]).filter((n) => n !== 0)).then((party) => {
    if (!party || !expedition) return;
    expedition = {
      ...expedition,
      party,
      log: [...expedition.log, `Día ${expedition.day} — Formación reorganizada en ${cityNode()?.name ?? 'ciudad'}: van ${party.length} máquinas.`],
    };
    saveExpedition();
    renderCity();
  });
}

function closeCity(): void {
  cityOpen = false;
  $('city').classList.remove('show');
  renderWorld();
}

/** Un establecimiento de la ciudad (sección de la pantalla). */
/** Edificio abierto (null = la plaza). Se entra y se sale, como en DD. */
let cityBuilding: string | null = null;

/**
 * Con edificio abierto, solo la sección que casa se muestra; el resto
 * se construye suelto (y se descarta). En la plaza no se llama.
 */
function citySection(title: string): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'csec';
  sec.innerHTML = `<h3>${title}</h3>`;
  if (cityBuilding === null || title.startsWith(cityBuilding)) {
    $('city-body').appendChild(sec);
  }
  return sec;
}

/** Horizonte de la ciudad: atardecer y tejados en capas, todo por id. */
function citySkyline(nodeId: string, level: number, accent: string): string {
  let h = 2166136261;
  for (const ch of nodeId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = (n: number): number => {
    h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
    return h % n;
  };
  const layer = (base: number, fill: string, windows: boolean): string => {
    const parts: string[] = [];
    let x = -2;
    while (x < 102) {
      const w = 5 + rand(9);
      const tall = 12 + rand(22) + level * 6;
      const y = base - tall;
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${tall + 4}" fill="${fill}"/>`);
      if (rand(4) === 0) parts.push(`<polygon points="${x},${y} ${x + w / 2},${y - 4 - rand(4)} ${x + w},${y}" fill="${fill}"/>`);
      if (windows) {
        for (let wx = x + 1; wx < x + w - 1; wx += 3) {
          if (rand(3) === 0) parts.push(`<rect x="${wx}" y="${y + 3 + rand(Math.max(1, tall - 8))}" width="1.4" height="2" fill="${accent}" opacity="0.6"/>`);
        }
        if (rand(3) === 0) parts.push(`<rect x="${x + rand(Math.max(1, w - 2))}" y="${y - 6}" width="0.8" height="6" fill="#233240"/>`);
      }
      x += w + 1 + rand(3);
    }
    return parts.join('');
  };
  const sunX = 15 + (h % 70);
  return `<svg viewBox="0 0 100 80" preserveAspectRatio="none">` +
    `<defs><linearGradient id="csky-${nodeId}" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#0a1117"/><stop offset="0.62" stop-color="#152230"/>` +
    `<stop offset="0.82" stop-color="#2b2b30"/></linearGradient>` +
    `<radialGradient id="csun-${nodeId}"><stop offset="0" stop-color="${accent}" stop-opacity="0.85"/>` +
    `<stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient></defs>` +
    `<rect width="100" height="80" fill="url(#csky-${nodeId})"/>` +
    `<circle cx="${sunX}" cy="46" r="16" fill="url(#csun-${nodeId})"/>` +
    `<circle cx="${sunX}" cy="46" r="5.5" fill="${accent}" opacity="0.8"/>` +
    layer(66, '#0e161d', false) +
    layer(78, '#131b23', true) +
    `<rect y="77" width="100" height="3" fill="${accent}" opacity="0.35"/></svg>`;
}

/** Fachadas dibujadas para las puertas de la plaza (nada de emojis planos). */
function cityDoorArt(key: string, accent: string): string {
  const A = accent;
  const body: Record<string, string> = {
    '⚒ Taller': `<path d="M6 26 L6 14 L20 5 L34 14 L34 26 Z" fill="#141d26" stroke="#2c3d4c"/>
      <rect x="15" y="17" width="10" height="9" fill="#0a1117"/>
      <path d="M12 12 l4 -2 m-2 -1 v4" stroke="${A}" stroke-width="1.4"/>
      <circle cx="27" cy="12" r="2.6" fill="none" stroke="${A}" stroke-width="1.2"/>`,
    '🏪 Mercader': `<rect x="5" y="12" width="30" height="14" fill="#141d26" stroke="#2c3d4c"/>
      <path d="M4 12 h32 l-2 -5 h-28 Z" fill="#1a252f"/>
      <g stroke="${A}" stroke-width="2"><path d="M6 12 v-4 M12 12 v-4 M18 12 v-4 M24 12 v-4 M30 12 v-4 M36 12 v-4"/></g>
      <rect x="9" y="16" width="7" height="10" fill="#0a1117"/>
      <rect x="21" y="16" width="10" height="6" fill="#0a1117"/>`,
    '🏭 Fábrica': `<path d="M5 26 V12 L13 17 V12 L21 17 V12 L29 17 V10 H35 V26 Z" fill="#141d26" stroke="#2c3d4c"/>
      <rect x="30" y="2" width="4" height="8" fill="#1a252f"/>
      <circle cx="32" cy="1" r="1.6" fill="${A}" opacity="0.6"/>
      <rect x="9" y="20" width="5" height="4" fill="${A}" opacity="0.5"/>
      <rect x="18" y="20" width="5" height="4" fill="${A}" opacity="0.35"/>`,
    '🏗 Fabricación': `<rect x="6" y="20" width="28" height="6" fill="#141d26" stroke="#2c3d4c"/>
      <path d="M10 20 V6 H30 M30 6 V12" stroke="#2c3d4c" stroke-width="2" fill="none"/>
      <path d="M30 12 v4" stroke="${A}" stroke-width="1.4"/>
      <rect x="27" y="16" width="6" height="4" fill="${A}" opacity="0.5"/>
      <path d="M10 6 L6 10 M10 10 L14 6" stroke="#2c3d4c"/>`,
    '🔧 Modificación': `<rect x="5" y="10" width="30" height="16" fill="#141d26" stroke="#2c3d4c"/>
      <g stroke="#0a1117" stroke-width="2"><path d="M8 13 h24 M8 17 h24 M8 21 h24"/></g>
      <circle cx="20" cy="6" r="3.4" fill="none" stroke="${A}" stroke-width="1.6"/>
      <path d="M20 3 v-2 M20 9 v2 M17 6 h-2 M23 6 h2" stroke="${A}"/>`,
    '😴 Descansos': `<path d="M6 26 V13 L20 5 L34 13 V26 Z" fill="#141d26" stroke="#2c3d4c"/>
      <rect x="10" y="16" width="6" height="6" fill="${A}" opacity="0.45"/>
      <rect x="24" y="16" width="6" height="10" fill="#0a1117"/>
      <path d="M14 9 q2 -2 0 -4 M18 9 q2 -2 0 -4" stroke="#8598a8" fill="none" opacity="0.7"/>`,
    '🍻 Taberna': `<rect x="5" y="11" width="30" height="15" fill="#141d26" stroke="#2c3d4c"/>
      <path d="M5 11 L20 4 L35 11" fill="#1a252f" stroke="#2c3d4c"/>
      <rect x="24" y="15" width="8" height="11" fill="#0a1117"/>
      <path d="M12 13 v5 h5 v-5 Z" fill="none" stroke="${A}" stroke-width="1.3"/>
      <path d="M17 14 h2 v2 h-2" fill="none" stroke="${A}"/>
      <circle cx="14" cy="22" r="1.4" fill="${A}" opacity="0.7"/>`,
    '🧭 Formación': `<rect x="7" y="8" width="26" height="18" rx="2" fill="#141d26" stroke="#2c3d4c"/>
      <path d="M11 26 V6 l7 3 -7 3" fill="none" stroke="${A}" stroke-width="1.4"/>
      <g fill="#0c2b31" stroke="${A}" stroke-width="0.5" transform="translate(16 13) scale(0.55)">
        <path d="M4 20 L7 12 L14 10 L22 9 L29 10 L33 7 L38 9 L37 13 L33 15 L30 17 L28 22 L26 28 L23 28 L24 21 L18 20 L14 22 L13 28 L10 28 L10 21 L6 24 Z"/>
      </g>`,
  };
  const art = body[key] ?? `<rect x="6" y="8" width="28" height="18" fill="#141d26" stroke="#2c3d4c"/>`;
  return `<svg viewBox="0 0 40 28" class="bart" aria-hidden="true">${art}</svg>`;
}

/** Las puertas de la plaza: qué edificios tiene ESTA ciudad. */
function cityDoors(city: { level: number; factory?: string }): Array<{ key: string; icon: string; name: string; sub: string }> {
  const doors = [
    { key: '⚒ Taller', icon: '⚒', name: 'Taller', sub: 'arreglos básicos del casco' },
    { key: '🏪 Mercader', icon: '🏪', name: 'Mercader', sub: 'suministros, bodega y jornal' },
  ];
  if (city.factory === 'armas') doors.push({ key: '🏭 Fábrica', icon: '🏭', name: 'Fábrica de armas', sub: 'armamento con descuento local' });
  if (city.factory === 'piezas') doors.push({ key: '🏭 Fábrica', icon: '🏭', name: 'Fábrica de piezas', sub: 'planos de módulos' });
  if (city.level >= 2) doors.push({ key: '🏗 Fabricación', icon: '🏗', name: 'Fabricación de Zoids', sub: 'encargar chasis con retoma' });
  doors.push(
    { key: '🔧 Modificación', icon: '🔧', name: 'Modificación', sub: 'tunear armas y módulos' },
    { key: '😴 Descansos', icon: '😴', name: 'Descansos', sub: 'pensión, desahogos y consultorio' },
    { key: '🍻 Taberna', icon: '🍻', name: 'Taberna', sub: 'encargos no tan oficiales' },
    { key: '🧭 Formación', icon: '🧭', name: 'Formación', sub: 'reorganizar quiénes siguen el viaje' },
  );
  return doors;
}

function cityButton(host: HTMLElement, label: string, disabled: boolean, onClick: () => void): void {
  const btn = document.createElement('button');
  btn.className = 'gbtn';
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener('click', () => { onClick(); renderCity(); });
  host.appendChild(btn);
}

/** Un día pasa en la ciudad (descansos, jornales, terapias). */
/** Hueco → destacamento activo (si su piloto está fuera de servicio). */
function assignmentOf(slot: number): import('../game/assignment.js').ActiveAssignment | undefined {
  return campaign?.assignments?.find((a) => a.slot === slot);
}

/** El tiempo cura Y hace avanzar los destacamentos, jornada a jornada. */
function healingDays(days: number): void {
  if (days <= 0) return;
  let changed = false;
  for (const id of PILOT_IDS) {
    const healed = healInjury(pilots[id]!, days);
    if (healed !== pilots[id]) { pilots[id] = healed; changed = true; }
  }
  if (changed) savePilots();
  if (campaign && (campaign.assignments ?? []).length > 0) {
    campaign = {
      ...campaign,
      assignments: campaign.assignments!.map((a) => {
        const spec = ASSIGNMENT_SPECS.find((sp) => sp.id === a.specId);
        return spec ? advanceAssignment(a, spec, days) : a;
      }),
    };
    saveCampaign();
  }
}

function cityDay(days: number, line: string): void {
  expedition = {
    ...expedition!,
    day: expedition!.day + days,
    log: [...expedition!.log, `Día ${expedition!.day + days} — ${line}`],
  };
  healingDays(days);
  saveExpedition();
}

function renderCity(): void {
  const node = cityNode();
  if (!campaign || !expedition || !node?.city) return;
  const city = node.city;
  const tier = CITY_TIERS[city.level];
  $('city-name').textContent = `${node.name} — nivel ${city.level}`;
  $('city-desc').textContent = node.description;
  const factionId = PLACE_FACTIONS[node.id];
  const faction = FACTIONS.find((f) => f.id === factionId);
  const standing = faction ? reputationTier(campaign.reputation[faction.id] ?? 0) : null;
  const priceMul = standing ? priceFactor(standing.id) : 1;
  $('city-status').textContent =
    `⌾${campaign.credits} · suministros ${campaign.supplies} · día ${expedition.day}` +
    (faction && standing ? ` · ${faction.name}: ${standing.label}` : '') +
    (priceMul !== 1 ? ` · precios ${priceMul > 1 ? '+' : '−'}${Math.round(Math.abs(priceMul - 1) * 100)}%` : '');
  const px = (base: number): number => Math.max(1, Math.round(base * priceMul));
  $('city-body').innerHTML = '';

  // El horizonte de ESTA ciudad, teñido por su facción.
  const accent = faction?.id === 'chatarreros' ? '#ff9f45' : faction?.id === 'gremio' ? '#53d1e0' : '#5fd9a4';
  $('city-sky').innerHTML = citySkyline(node.id, city.level, accent);

  // LA PLAZA: sin edificio abierto se ven las puertas, no los mostradores.
  const plaza = $('city-plaza');
  ($('city-back') as HTMLElement).style.display = cityBuilding === null ? 'none' : '';
  if (cityBuilding === null) {
    plaza.style.display = '';
    plaza.innerHTML = '';
    for (const door of cityDoors(city)) {
      const card = document.createElement('button');
      card.className = 'bldg';
      card.innerHTML = cityDoorArt(door.key, accent) +
        `<span class="bname">${door.name}</span><span class="bsub">${door.sub}</span>`;
      card.addEventListener('click', () => {
        playSfx('click');
        if (door.key === '🧭 Formación') { editParty(); return; }
        cityBuilding = door.key;
        renderCity();
      });
      plaza.appendChild(card);
    }
    return; // los mostradores no se montan hasta cruzar una puerta
  }
  plaza.style.display = 'none';

  // ⚒ TALLER — arreglos básicos, siempre; eliges cuánto gastar.
  const taller = citySection('⚒ Taller — arreglos básicos');
  taller.insertAdjacentHTML('beforeend',
    `<div class="cnote">Repara hasta el ${Math.round(tier.repairCapRatio * 100)}% del casco a ⌾${px(tier.repairCostPerHp)}/HP. La munición se repone al desplegar (incluida).</div>`);
  let anyRepair = false;
  campaign.roster.forEach((zoid, slot) => {
    if (zoid.destroyed) {
      taller.insertAdjacentHTML('beforeend',
        `<div class="cnote">💥 ${ZOIDS[zoid.unitTypeId]!.name}: destruido — la reconstrucción es cosa del cuartel.</div>`);
      return;
    }
    const maxHp = campaignMaxHp(slot);
    const cap = Math.round(maxHp * tier.repairCapRatio);
    const current = Math.min(zoid.hp, maxHp);
    const healable = Math.max(0, cap - current);
    if (healable <= 0) return;
    anyRepair = true;
    const row = document.createElement('div');
    row.className = 'crow';
    row.innerHTML = `<span class="lbl">${ZOIDS[zoid.unitTypeId]!.name} · ${current}/${maxHp} HP</span>`;
    for (const fraction of [0.25, 0.5, 1]) {
      const heal = Math.max(0, Math.round(healable * fraction));
      const cost = Math.round(heal * px(tier.repairCostPerHp));
      if (heal <= 0) continue;
      const btn = document.createElement('button');
      btn.className = 'gbtn';
      btn.textContent = `+${heal} HP (⌾${cost})`;
      btn.disabled = campaign!.credits < cost;
      btn.addEventListener('click', () => {
        campaign = cityRepair(campaign!, slot, campaignMaxHp(slot), px(tier.repairCostPerHp), tier.repairCapRatio, fraction);
        saveCampaign(); renderCity();
      });
      row.appendChild(btn);
    }
    taller.appendChild(row);
  });
  if (!anyRepair) taller.insertAdjacentHTML('beforeend', '<div class="cnote">Todo el metal en pie está dentro del tope de este taller.</div>');

  // 🏪 MERCADER — suministros, bodega, jornal y armas de segunda mano.
  const store = citySection('🏪 Mercader');
  for (const count of [1, 5]) {
    cityButton(store, `📦 +${count} suministro${count > 1 ? 's' : ''} (⌾${px(tier.supplyPrice) * count})`,
      campaign.credits < px(tier.supplyPrice) * count,
      () => { campaign = buySupplies(campaign!, count, ECONOMY, px(tier.supplyPrice)); saveCampaign(); });
  }
  if (campaign.cargo.length > 0) {
    const total = Math.round(campaign.cargo.reduce((n, c) => n + c.value, 0) * tier.cargoRate);
    cityButton(store, `💰 Vender bodega (${campaign.cargo.length} objetos) — ⌾${total} al ${Math.round(tier.cargoRate * 100)}%`, false, () => {
      const sold = sellCargo(campaign!, tier.cargoRate);
      campaign = sold.state;
      cityDay(0, `Bodega vendida en ${node.name}: +⌾${sold.earned}.`);
      saveCampaign();
    });
  }
  for (const [weaponId, owned] of Object.entries(campaign.armory)) {
    const spare = owned - mountedCount(campaign, weaponId);
    const price = ECONOMY.weaponPrices[weaponId];
    if (spare <= 0 || price === undefined) continue;
    const weapon = CATALOGS.weaponCatalog[weaponId];
    if (!weapon) continue;
    cityButton(store, `♻ Vender ${weapon.name} (libre ×${spare}) — ⌾${Math.round(price * ECONOMY.sellFactor)}`, false,
      () => { campaign = sellWeapon(campaign!, weaponId, ECONOMY); saveCampaign(); });
  }
  cityButton(store, '🧰 Jornal en el muelle (+⌾40, 1 día)', false, () => {
    campaign = { ...campaign!, credits: campaign!.credits + 40 };
    cityDay(1, `Un día de jornal honrado en ${node.name}: +⌾40.`);
    saveCampaign();
  });

  // 🏭 FÁBRICA — armas con descuento o planos de piezas.
  if (city.factory === 'armas') {
    const factory = citySection(`🏭 Fábrica de armas (−${Math.round(tier.factoryDiscount * 100)}%)`);
    for (const [weaponId, price] of Object.entries(ECONOMY.weaponPrices)) {
      const weapon = CATALOGS.weaponCatalog[weaponId];
      if (!weapon || !weapon.spec) continue;
      const local = Math.round(price * (1 - tier.factoryDiscount));
      cityButton(factory, `${weapon.name} [${SPEC_LABEL[weapon.spec]}] — ⌾${local} (cat. ⌾${price})`,
        campaign!.credits < local,
        () => {
          campaign = { ...buyWeapon({ ...campaign!, credits: campaign!.credits + price - local }, weaponId, ECONOMY) };
          saveCampaign();
        });
    }
  }
  if (city.factory === 'piezas') {
    const factory = citySection(`🏭 Fábrica de piezas — planos (−${Math.round(tier.factoryDiscount * 100)}%)`);
    for (const [moduleId, price] of Object.entries(BLUEPRINT_PRICES)) {
      const module = MODULES[moduleId];
      if (!module) continue;
      const owned = campaign.moduleBlueprints.includes(moduleId);
      const local = Math.round(price * (1 - tier.factoryDiscount));
      cityButton(factory, owned ? `📐 ${module.name} — adquirido ✓` : `📐 Plano: ${module.name} — ⌾${local}`,
        owned || campaign!.credits < local,
        () => { campaign = buyBlueprint(campaign!, moduleId, local); saveCampaign(); });
    }
  }

  // 🏗 FABRICACIÓN DE ZOIDS — encargar chasis (nivel 2+).
  if (city.level >= 2) {
    const yard = citySection('🏗 Fabricación de Zoids — encargo con retoma');
    campaign.roster.forEach((zoid, slot) => {
      const maxHp = campaignMaxHp(slot);
      const select = document.createElement('select');
      const keep = document.createElement('option');
      keep.value = '';
      keep.textContent = `P${slot + 1} ${ZOIDS[zoid.unitTypeId]!.name}${slot === 0 ? ' ❤' : ''} (mantener)`;
      select.appendChild(keep);
      for (const unit of Object.values(ZOIDS)) {
        if (unit.id === zoid.unitTypeId) continue;
        const price = ECONOMY.zoidPrices[unit.id];
        if (price === undefined) continue;
        const probe = buyZoid(campaign!, slot, unit.id, maxHp, ECONOMY, factoryLoadout);
        const net = campaign!.credits - probe.credits;
        const opt = document.createElement('option');
        opt.value = unit.id;
        opt.textContent = `${unit.name} · neto ⌾${net}`;
        opt.disabled = probe === campaign;
        select.appendChild(opt);
      }
      select.addEventListener('change', async () => {
        if (!select.value) return;
        if (slot === 0 && (campaign!.companion.markIds.length > 0 || campaign!.companion.rapport > 0)) {
          if (!(await uiConfirm('Es tu COMPAÑERA. Cambiar de chasis borra sus marcas y la compenetración. ¿Seguro?'))) {
            renderCity();
            return;
          }
        }
        const before = campaign!;
        campaign = buyZoid(campaign!, slot, select.value, maxHp, ECONOMY, factoryLoadout);
        if (slot === 0 && campaign !== before) campaign = { ...campaign, companion: newCompanion() };
        saveCampaign(); renderCity();
      });
      yard.appendChild(select);
    });
  }

  // 🔧 MODIFICACIÓN — tunear: armas del arsenal y módulos con plano.
  const mod = citySection('🔧 Modificación (tunear)');
  campaign.roster.forEach((zoid, slot) => {
    if (zoid.destroyed) return;
    const def = ZOIDS[zoid.unitTypeId]!;
    mod.insertAdjacentHTML('beforeend',
      `<div class="cnote"><b style="color:var(--ink)">P${slot + 1} ${def.name}${slot === 0 ? ' ❤' : ''}</b></div>`);
    const legal = compatibleWeapons(zoid.unitTypeId);
    for (let wSlot = 0; wSlot < 3; wSlot++) {
      const current = zoid.weapons[wSlot] ?? '';
      const select = document.createElement('select');
      select.innerHTML = '<option value="">— sin arma —</option>';
      for (const weaponId of legal) {
        const owned = campaign!.armory[weaponId] ?? 0;
        if (owned === 0) continue;
        const spare = owned - mountedCount(campaign!, weaponId) + (current === weaponId ? 1 : 0);
        if (spare <= 0) continue;
        const weapon = CATALOGS.weaponCatalog[weaponId]!;
        const opt = document.createElement('option');
        opt.value = weaponId;
        opt.textContent = weapon.spec ? `${weapon.name} [${SPEC_LABEL[weapon.spec]}]` : weapon.name;
        if (current === weaponId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        const picked = [0, 1, 2].map((i) => (i === wSlot ? select.value : zoid.weapons[i] ?? '')).filter(Boolean);
        campaign = setMountedWeapons(campaign!, slot, picked);
        saveCampaign(); renderCity();
      });
      mod.appendChild(select);
    }
    for (const entry of def.frame ?? []) {
      const options = (GARAGE_MODULE_OPTIONS[entry.slot] ?? [])
        .filter((id) => MODULES[id] && campaign!.moduleBlueprints.includes(id));
      if (options.length === 0) continue;
      const select = document.createElement('select');
      for (const moduleId of [entry.moduleId, ...options]) {
        const module = MODULES[moduleId]!;
        const opt = document.createElement('option');
        opt.value = moduleId;
        opt.textContent = moduleId === entry.moduleId ? `${module.name} (fábrica)` : module.name;
        if ((zoid.slots[entry.slot] ?? entry.moduleId) === moduleId) opt.selected = true;
        select.appendChild(opt);
      }
      select.addEventListener('change', () => {
        const slots = { ...zoid.slots };
        if (select.value === entry.moduleId) delete slots[entry.slot];
        else slots[entry.slot] = select.value;
        campaign = { ...campaign!, roster: campaign!.roster.map((z, i) => (i === slot ? { ...z, slots } : z)) };
        saveCampaign(); renderCity();
      });
      mod.appendChild(select);
    }
  });

  // 😴 DESCANSOS — de la vela al Farol Rojo, y el consultorio.
  const rest = citySection('😴 Descansos y consultorio');
  // Descansar SIEMPRE es útil: pasa una jornada (cura heridas y avanza
  // destacamentos), alivia el estrés que haya, y la vela es un momento con
  // la compañera. No se bloquea por estar tranquilos — solo por el bolsillo.
  const restDay = (relief: number, cost: number, line: string): void => {
    campaign = { ...campaign!, credits: campaign!.credits - cost };
    for (const id of PILOT_IDS) pilots[id] = adjustStress(pilots[id]!, -relief);
    cityDay(1, line);
    savePilots(); saveCampaign();
  };
  cityButton(rest, `😴 Pensión (−${tier.restRelief} estrés, ⌾${px(tier.restCost)}, 1 día)`,
    campaign.credits < px(tier.restCost),
    () => restDay(tier.restRelief, px(tier.restCost), `Descanso en ${node.name}.`));
  for (const leisure of LEISURE_OPTIONS) {
    if (city.level < leisure.minLevel) continue;
    const icon = leisure.id === 'vela' ? '🕯' : leisure.id === 'cantina' ? '🍺' : '🏮';
    // La vela es GRATIS de verdad (0, no el mínimo de px): un momento con la
    // compañera siempre al alcance, aun sin un crédito.
    const leisureCost = leisure.cost === 0 ? 0 : px(leisure.cost);
    cityButton(rest, `${icon} ${leisure.name} (−${leisure.relief}, ${leisureCost === 0 ? 'gratis' : `⌾${leisureCost}`}, 1 día)`,
      campaign.credits < leisureCost,
      () => {
        let cost = leisureCost;
        let line = `${leisure.name} en ${node.name}.`;
        if (leisure.rowdy) {
          const roll = (Math.imul(expedition!.day * 2654435761 ^ node.id.length * 97, 668265263) >>> 0) / 4294967296;
          if (roll < 0.3 && campaign!.credits >= Math.round(cost * 1.5)) {
            cost = Math.round(cost * 1.5);
            line += ' La ronda se alargó: la cuenta también.';
          }
          for (const id of PILOT_IDS) {
            const marked = recordPilotEvent(pilots[id]!, 'parrandas', PERKS);
            pilots[id] = marked.pilot;
            for (const quirk of marked.gained) line += ` ${pilots[id]!.name} vuelve con la manía ${quirk.name}.`;
          }
        }
        restDay(leisure.relief, cost, line);
      });
  }
  if (city.level >= THERAPY.minLevel) {
    for (const pilotId of PILOT_IDS) {
      const pilot = pilots[pilotId]!;
      for (const quirkId of pilot.quirks ?? []) {
        const quirk = PERKS.quirks?.[quirkId];
        const target = quirk?.reframedTo ? PERKS.quirks?.[quirk.reframedTo] : undefined;
        if (!quirk || !target) continue;
        cityButton(rest, `🛋 Terapia — ${pilot.name}: "${quirk.name}" → "${target.name}" (⌾${THERAPY.cost}, ${THERAPY.days} días)`,
          campaign!.credits < THERAPY.cost,
          () => {
            const reframed = reframeQuirk(pilots[pilotId]!, quirkId, PERKS);
            if (!reframed) return;
            pilots[pilotId] = adjustStress(reframed, -THERAPY.stressRelief);
            campaign = { ...campaign!, credits: campaign!.credits - THERAPY.cost };
            cityDay(THERAPY.days, `${pilots[pilotId]!.name} sale del consultorio: "${quirk.name}" ahora es "${target.name}".`);
            savePilots(); saveCampaign();
          });
      }
    }
  }

  // 🍻 TABERNA / GREMIO — misiones oficiales y no tan oficiales.
  const tavern = citySection('🍻 Taberna y gremio');
  tavern.insertAdjacentHTML('beforeend',
    '<div class="cnote">Los contratos OFICIALES del gremio se firman en el cuartel (Base Arcadia). Aquí, entre jarras, se consiguen otros encargos…</div>');
  const jobDone = (expedition.tavernJobsDone ?? []).includes(node.id);
  let job = tavernJob(node.id, city.level, campaign.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL);
  // En ciudad de clanes, el trabajo sucio paga como lo que es.
  if (faction?.id === 'chatarreros') {
    job = { ...job, reward: Math.round(job.reward * 1.25) };
    tavern.insertAdjacentHTML('beforeend',
      '<div class="cnote">🔩 Ciudad de clanes: aquí el trabajo sucio paga un 25% mejor y nadie hace preguntas.</div>');
  }
  if (standing && standing.id === 'odiado') {
    tavern.insertAdjacentHTML('beforeend',
      `<div class="cnote">🚫 El tabernero señala la puerta sin mediar palabra. Aquí no se sirve a los tuyos (${faction!.name}: Odiado).</div>`);
  } else if (standing && standing.id === 'hostil') {
    tavern.insertAdjacentHTML('beforeend',
      `<div class="cnote">🥃 Te sirven, de lejos y sin conversación. Nadie te confiaría un encargo (${faction!.name}: Hostil).</div>`);
  } else if (jobDone) {
    tavern.insertAdjacentHTML('beforeend', '<div class="cnote">✓ Ya hiciste el trabajo sucio de esta ciudad. El tabernero te sirve gratis la primera.</div>');
  } else {
    cityButton(tavern,
      `🤫 "${job.name}" — contra ${job.enemySquad.map((id) => ZOIDS[id]!.name).join(', ')} · paga ⌾${job.reward} + chatarra`,
      !campaign.roster.some((z) => !z.destroyed),
      () => fightTavernBattle(job, node.id));
  }
}

/** El trabajo no oficial: un combate local, aquí y ahora. */
function fightTavernBattle(job: Contract, nodeId: string): void {
  if (!campaign || !expedition) return;
  const party = expedition.party ?? [0, 1, 2, 3];
  const alive = campaign.roster
    .map((zoid, slot) => ({ zoid, slot }))
    .filter(({ zoid, slot }) => party.includes(slot) && !zoid.destroyed &&
      !isInjured(pilots[PILOT_IDS[slot]!]!) && !assignmentOf(slot));
  if (alive.length === 0) return;
  const node = REGION.nodes.find((n) => n.id === nodeId)!;
  let field = generatedField(`${job.id}|${nodeId}|${expedition.day}`, job.tier);
  const custom = customMaps[node.name];
  if (custom) {
    try {
      field = { map: GameMap.fromAscii(custom.rows), playerPos: custom.playerSpawns, enemyPos: custom.enemySpawns };
    } catch { /* cae al generado */ }
  }
  const spawns: UnitSpawn[] = [
    ...alive.map(({ zoid, slot }, k) => {
      // El refuerzo de blindaje da búnker (UnitSpawn.armor) a cambio de
      // velocidad (modificadores), sumado a las marcas de la compañera.
      const mods = [
        ...(slot === 0 ? companionModifiers(campaign!.companion, COMPANION_TABLE) : []),
        ...(zoid.reinforced ? reinforcementModifiers(ECONOMY) : []),
      ];
      return {
        id: `P${slot + 1}`,
        name: ZOIDS[zoid.unitTypeId]!.name,
        unitTypeId: zoid.unitTypeId,
        team: 'player' as Team,
        position: field.playerPos[k]!,
        hp: zoid.hp,
        loadout: {
          weapons: [...zoid.weapons],
          ...(Object.keys(zoid.slots).length > 0 ? { slots: { ...zoid.slots } } : {}),
        },
        ...(zoid.reinforced ? { armor: zoid.armor ?? ECONOMY.reinforcement.armor } : {}),
        ...(mods.length > 0 ? { modifiers: mods } : {}),
        ...(k === 0 ? { commander: true } : {}),
      };
    }),
    ...job.enemySquad.map((unitTypeId, i) => ({
      id: `E${i + 1}`,
      name: ZOIDS[unitTypeId]!.name,
      unitTypeId,
      team: 'enemy' as Team,
      position: field.enemyPos[i]!,
      ...(i === 0 ? { commander: true } : {}),
    })),
  ];
  deployedSlots = alive.map(({ slot }) => slot);
  activeContract = job;
  returnToMerc = false;
  returnToWorld = false;
  closeCity();
  closeWorld();
  const seed = (Number(($('seed') as HTMLInputElement).value) || 42) + expedition.day * 131 + nodeId.length * 17;
  const weather = expedition.forcedWeather ?? weatherFor(REGION, expedition.day);
  startBattle(spawns, seed, weather, field.map);
}

/** Explorar las ruinas: un día, y lo que haya dentro. */
function doExplore(): void {
  if (!campaign || !expedition) return;
  const result = exploreSite(expedition, REGION, campaign.discovered ?? []);
  expedition = result.expedition;
  healingDays(1);
  // Un secreto hallado se queda en el mapa PARA SIEMPRE (persiste en la campaña).
  if (result.discovered && result.discovered.length > 0) {
    campaign = { ...campaign, discovered: [...(campaign.discovered ?? []), ...result.discovered] };
  }
  if (result.cargo) {
    const before = campaign.cargo.length;
    campaign = stashCargo(campaign, result.cargo, CARGO_CAPACITY);
    if (campaign.cargo.length === before) {
      expedition = { ...expedition, log: [...expedition.log, `⚠ La bodega está llena: ${result.cargo.name} se quedó atrás.`] };
    }
  }
  if (result.stressDelta > 0) {
    for (const id of PILOT_IDS) pilots[id] = adjustStress(pilots[id]!, result.stressDelta);
    savePilots();
  }
  saveCampaign(); saveExpedition(); renderWorld();
}

function doTravel(edge: WorldEdge): void {
  if (!campaign || !expedition) return;
  const dayBefore = expedition.day;
  const stormToll = weatherFor(REGION, dayBefore) === 'sandstorm' ? 1 : 0;
  const result = travel(expedition, REGION, edge);
  expedition = result.expedition;
  if (stormToll > 0) {
    expedition = {
      ...expedition,
      log: [...expedition.log, `Día ${expedition.day} — 🌪 Viajar bajo la tormenta de arena come raciones: +1 suministro.`],
    };
  }
  healingDays(expedition.day - dayBefore);
  const consumed = consumeSupplies(campaign, result.supplyCost + stormToll);
  campaign = consumed.state;
  if (consumed.shortage > 0) {
    // Marcha forzada: sin suministros, las máquinas sufren (nunca mueren
    // en ruta: se quedan a 1 HP como mucho de castigo).
    campaign = {
      ...campaign,
      roster: campaign.roster.map((zoid, slot) => {
        if (zoid.destroyed) return zoid;
        const maxHp = campaignMaxHp(slot);
        const hp = Math.max(1, Math.min(zoid.hp, maxHp) - Math.ceil(maxHp * FORCED_MARCH_DAMAGE * consumed.shortage));
        return { ...zoid, hp };
      }),
    };
    for (const id of PILOT_IDS) pilots[id] = adjustStress(pilots[id]!, 5 * consumed.shortage);
    savePilots();
    expedition = {
      ...expedition,
      log: [...expedition.log, `⚠ Día ${expedition.day} — Sin suministros: marcha forzada. Máquinas y pilotos sufren.`],
    };
  }
  if (result.cargo) {
    const before = campaign.cargo.length;
    campaign = stashCargo(campaign, result.cargo, CARGO_CAPACITY);
    if (campaign.cargo.length === before) {
      expedition = {
        ...expedition,
        log: [...expedition.log, `⚠ La bodega está llena: hubo que dejar ${result.cargo.name} atrás.`],
      };
    }
  }
  saveCampaign();
  saveExpedition();
  renderWorld();

  // Encrucijada: la ruta pregunta, el jugador responde, y solo entonces
  // se aplican las consecuencias (todas anunciadas en el botón).
  if (result.encounter) {
    const encounter = result.encounter;
    void uiChoice(encounter.prompt, encounter.options).then((optionId) => {
      if (!campaign || !expedition) return;
      const dayBeforeChoice = expedition.day;
      const outcome = resolveEncounter(expedition, encounter, optionId);
      expedition = outcome.expedition;
      healingDays(expedition.day - dayBeforeChoice);
      if (outcome.supplyDelta > 0) {
        campaign = { ...campaign, supplies: campaign.supplies + outcome.supplyDelta };
      } else if (outcome.supplyDelta < 0) {
        campaign = consumeSupplies(campaign, -outcome.supplyDelta).state;
      }
      if (outcome.stressDelta !== 0) {
        for (const id of PILOT_IDS) pilots[id] = adjustStress(pilots[id]!, outcome.stressDelta);
        savePilots();
      }
      if (outcome.cargo) {
        const before = campaign.cargo.length;
        campaign = stashCargo(campaign, outcome.cargo, CARGO_CAPACITY);
        if (campaign.cargo.length === before) {
          expedition = {
            ...expedition,
            log: [...expedition.log, `⚠ La bodega está llena: hubo que renunciar a ${outcome.cargo.name}.`],
          };
        }
      }
      for (const change of outcome.reputation ?? []) {
        campaign = { ...campaign, reputation: adjustReputation(campaign.reputation, change.factionId, change.delta) };
      }
      saveCampaign();
      saveExpedition();
      renderWorld();
    });
  }
}

/** Tomar un transporte interregional: pasaje por delante, sin eventos. */
function doUseLink(link: import('../game/expedition.js').WorldLink): void {
  if (!campaign || !expedition) return;
  if (link.fare > 0 && campaign.credits < link.fare) return;
  const dayBefore = expedition.day;
  const result = useLink(expedition, WORLD_ATLAS, link);
  expedition = result.expedition;
  if (link.fare > 0) campaign = { ...campaign, credits: campaign.credits - link.fare };
  if (result.supplyCost > 0) {
    const consumed = consumeSupplies(campaign, result.supplyCost);
    campaign = consumed.state;
  }
  healingDays(expedition.day - dayBefore);
  syncRegion();
  saveCampaign();
  saveExpedition();
  renderWorld();
}

/**
 * Ancla libre más cercana a `want` donde quepa una huella de `size`
 * (mismo barrido determinista por anillos que usa el motor con los
 * refuerzos). `taken` son casillas ya reservadas por otros spawns.
 */
function freeAnchorFor(
  map: GameMap, want: Position, size: number, taken: Set<string>,
): Position | null {
  for (let radius = 0; radius <= 6; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) !== radius) continue;
        const anchor = { x: want.x + dx, y: want.y + dy };
        const stamp: Position[] = [];
        for (let sy = 0; sy < size; sy++) {
          for (let sx = 0; sx < size; sx++) stamp.push({ x: anchor.x + sx, y: anchor.y + sy });
        }
        if (stamp.some((t) => !map.inBounds(t))) continue;
        if (stamp.some((t) => !isFinite(map.entryCost(t, 'ground')))) continue;
        if (stamp.some((t) => taken.has(posKey(t)))) continue;
        return anchor;
      }
    }
  }
  return null;
}

/** Oleada enemiga de refuerzo: dos máquinas más del mismo encargo. */
function enemyWave(
  contract: Contract,
  spawns: UnitSpawn[],
  field: { enemyPos: Position[] },
  round: number,
): ReinforcementWave {
  return {
    round,
    spawns: contract.enemySquad.slice(0, 2).map((unitTypeId, i) => ({
      id: `E${spawns.filter((s) => s.team === 'enemy').length + i + 1}`,
      name: ZOIDS[unitTypeId]!.name,
      unitTypeId,
      team: 'enemy' as Team,
      position: field.enemyPos[i] ?? field.enemyPos[0]!,
    })),
  };
}

/** El combate del contrato, al llegar al lugar. */
function fightExpeditionBattle(): void {
  if (!campaign || !expedition) return;
  const contract = expeditionContract();
  if (!contract) return;
  const party = expedition.party ?? [0, 1, 2, 3];
  const alive = campaign.roster
    .map((zoid, slot) => ({ zoid, slot }))
    .filter(({ zoid, slot }) => party.includes(slot) && !zoid.destroyed &&
      !isInjured(pilots[PILOT_IDS[slot]!]!) && !assignmentOf(slot));
  if (alive.length === 0) return;

  // El lugar elige el mapa: un mapa del editor con el nombre del nodo
  // manda; si no existe, se GENERA uno propio de este contrato, este
  // lugar y este día — nunca dos batallas sobre el mismo terreno.
  const node = REGION.nodes.find((n) => n.id === expedition!.at)!;
  let field = generatedField(`${expedition.contractId}|${expedition.at}|${expedition.day}`, contract.tier);
  const custom = customMaps[node.name];
  if (custom) {
    try {
      field = { map: GameMap.fromAscii(custom.rows), playerPos: custom.playerSpawns, enemyPos: custom.enemySpawns };
    } catch { /* mapa corrupto: cae al generado */ }
  }

  const spawns: UnitSpawn[] = [
    ...alive.map(({ zoid, slot }, k) => {
      // La compañera (hueco 1) lleva su biografía; el refuerzo de blindaje
      // añade búnker a cambio de velocidad.
      const mods = [
        ...(slot === 0 ? companionModifiers(campaign!.companion, COMPANION_TABLE) : []),
        ...(zoid.reinforced ? reinforcementModifiers(ECONOMY) : []),
      ];
      return {
        id: `P${slot + 1}`,
        name: ZOIDS[zoid.unitTypeId]!.name,
        unitTypeId: zoid.unitTypeId,
        team: 'player' as Team,
        position: field.playerPos[k]!,
        hp: zoid.hp,
        loadout: {
          weapons: [...zoid.weapons],
          ...(Object.keys(zoid.slots).length > 0 ? { slots: { ...zoid.slots } } : {}),
        },
        ...(zoid.reinforced ? { armor: zoid.armor ?? ECONOMY.reinforcement.armor } : {}),
        ...(mods.length > 0 ? { modifiers: mods } : {}),
        ...(k === 0 ? { commander: true } : {}),
      };
    }),
    ...contract.enemySquad.map((unitTypeId, i) => ({
      id: `E${i + 1}`,
      name: ZOIDS[unitTypeId]!.name,
      unitTypeId,
      team: 'enemy' as Team,
      position: field.enemyPos[i]!,
      ...(i === 0 ? { commander: true } : {}),
    })),
  ];

  // Cada tipo de contrato juega distinto (no solo mapa y enemigos):
  // caza = derriba al cabecilla; escolta = el carguero no puede caer;
  // asalto = aguanta la segunda oleada. Consecuencias anunciadas.
  const brief: BattleBrief = {};
  const taken = new Set(spawns.flatMap((s) => {
    const size = ZOIDS[s.unitTypeId]?.size ?? 1;
    const tiles: string[] = [];
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) tiles.push(posKey({ x: s.position.x + dx, y: s.position.y + dy }));
    }
    return tiles;
  }));
  if (contract.tier === 'caza') {
    const lead = spawns.find((s) => s.id === 'E1');
    const anchor = lead && freeAnchorFor(field.map, lead.position,
      ZOIDS['gran-brontes']!.size ?? 2, new Set([...taken].filter((k) => k !== posKey(lead.position))));
    if (lead && anchor) {
      lead.unitTypeId = 'gran-brontes';
      lead.name = ZOIDS['gran-brontes']!.name;
      lead.position = anchor;
      brief.objective = { kind: 'assassinate', targetUnitId: 'E1' };
      brief.briefing = 'Caza mayor: derriba al cabecilla (E1) y el resto se dispersará.';
    }
  } else if (contract.tier === 'escolta') {
    const spot = freeAnchorFor(field.map, field.playerPos[3] ?? field.playerPos[0]!, 1, taken);
    if (spot) {
      spawns.push({
        id: 'W1', name: ZOIDS['carguero-colono']!.name, unitTypeId: 'carguero-colono',
        team: 'player', position: spot,
      });
      brief.objective = { kind: 'protect', wardUnitId: 'W1' };
      brief.briefing = 'Escolta: el carguero (W1) no puede caer — si cae, el contrato se pierde.';
    }
  } else if (contract.tier === 'asalto') {
    brief.reinforcements = [enemyWave(contract, spawns, field, 3)];
    brief.briefing = 'Asalto: posición defendida — llegará una segunda oleada enemiga en la ronda 3.';
  } else if (contract.tier === 'incursion') {
    // La zona: la línea del fondo del mapa (columnas transitables).
    const zone: Position[] = [];
    for (let y = 0; y < field.map.height; y++) {
      for (let x = field.map.width - 2; x < field.map.width; x++) {
        if (isFinite(field.map.entryCost({ x, y }, 'ground'))) zone.push({ x, y });
      }
    }
    brief.objective = { kind: 'reach', zone };
    brief.briefing = 'Incursión: planta CUALQUIER máquina en la línea del fondo (⚑) y la misión está hecha — no hace falta derribar a nadie.';
  } else if (contract.tier === 'defensa') {
    brief.objective = { kind: 'survive', rounds: 4 };
    brief.reinforcements = [enemyWave(contract, spawns, field, 2)];
    brief.briefing = 'Defensa: aguanta 4 rondas en pie — la oleada del asedio llegará en la ronda 2.';
  }

  deployedSlots = alive.map(({ slot }) => slot);
  activeContract = contract;
  returnToMerc = false;
  returnToWorld = false;
  closeWorld();
  const seed = (Number(($('seed') as HTMLInputElement).value) || 42) + campaign.contractsDone * 1009 + expedition.day * 97;
  // El cielo del día de la región; la tormenta que nos siguió aún manda.
  const weather = expedition.forcedWeather ?? weatherFor(REGION, expedition.day);
  startBattle(spawns, seed, weather, field.map, brief);
}

/** Cierra la expedición en el taller: vende la bodega y abre el cuartel. */
function endExpedition(): void {
  if (!campaign || !expedition) return;
  const sold = sellCargo(campaign);
  campaign = sold.state;
  if (expedition.missionDone) {
    campaign = { ...campaign, companion: bondExpedition(campaign.companion, COMPANION_TABLE) };
  }
  const closingRegion = regionOf(WORLD_ATLAS, expedition.regionId);
  const moved = campaign.homeRegionId !== undefined && campaign.homeRegionId !== expedition.regionId;
  campaign = { ...campaign, homeRegionId: expedition.regionId };
  chronicle(...expedition.log,
    `⚒ Día ${expedition.day} — De vuelta al taller${sold.earned > 0 ? `: la bodega paga ⌾${sold.earned}` : ''}. La expedición se cierra.`,
    ...(moved ? [`⚑ La compañía asienta su base en ${closingRegion.nodes.find((n) => n.id === closingRegion.hq)?.name ?? closingRegion.name} (${closingRegion.name}).`] : []),
    '· · ·');
  expedition = null;
  saveCampaign();
  saveExpedition();
  closeWorld();
  openMerc();
  if (sold.earned > 0) {
    $('merc-status').textContent += ` · bodega vendida: +⌾${sold.earned}`;
  }
}

// ── Sistema de guardado: ranuras + archivo (mentalidad de juego de PC) ──

const SAVE_SLOT_KEYS = ['gea-save-slot-1', 'gea-save-slot-2', 'gea-save-slot-3'];
let savesOpen = false;

/** Fotografía de la partida viva (todo lo que hay en memoria). */
function collectSave(name: string): SaveGame {
  return createSave({
    name,
    pilots,
    campaign,
    expedition,
    client: {
      garage,
      maps: customMaps,
      selectedMap: currentMapName,
    },
  });
}

/**
 * Aplica una partida: vuelca todas las claves vivas y recarga la
 * página — el arranque normal reconstruye el estado completo, que es
 * exactamente el camino ya probado.
 */
function applySave(save: SaveGame): void {
  try {
    localStorage.setItem(PILOTS_KEY, JSON.stringify(save.pilots));
    if (save.campaign) localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(save.campaign));
    else localStorage.removeItem(CAMPAIGN_KEY);
    if (save.expedition) localStorage.setItem(EXPEDITION_KEY, JSON.stringify(save.expedition));
    else localStorage.removeItem(EXPEDITION_KEY);
    const client = save.client;
    if (Array.isArray(client['garage'])) localStorage.setItem(GARAGE_KEY, JSON.stringify(client['garage']));
    if (client['maps'] && typeof client['maps'] === 'object') localStorage.setItem(MAPS_KEY, JSON.stringify(client['maps']));
    localStorage.setItem(MAP_SEL_KEY, typeof client['selectedMap'] === 'string' ? client['selectedMap'] : '');
  } catch { /* almacenamiento privado */ }
  try { sessionStorage.setItem(SKIP_MENU_FLAG, '1'); } catch { /* privado */ }
  window.location.reload();
}

function slotSave(index: number): SaveGame | null {
  try {
    return validateSave(localStorage.getItem(SAVE_SLOT_KEYS[index]!) ?? '');
  } catch {
    return null;
  }
}

function downloadSave(save: SaveGame): void {
  const blob = new Blob([serializeSave(save)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `gea-${save.name.toLowerCase().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'partida'}.json`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function fmtDate(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function renderSaves(): void {
  const host = $('save-slots');
  host.innerHTML = '';

  // La partida viva: exportable directamente.
  const live = document.createElement('div');
  live.className = 'slot current';
  const liveName = campaign ? 'Partida en curso' : 'Estado actual (sin campaña)';
  live.innerHTML =
    `<div class="sinfo"><b>▶ ${liveName}</b><br>` +
    (campaign ? `⌾${campaign.credits} · ${campaign.contractsDone} contratos` : 'garaje y pilotos') +
    (expedition ? ` · expedición día ${expedition.day}` : '') + '</div>';
  const liveBtns = document.createElement('div');
  liveBtns.className = 'sbtns';
  const exportLive = document.createElement('button');
  exportLive.textContent = '⇩ Exportar a archivo';
  exportLive.addEventListener('click', async () => {
    const name = await uiPrompt('Nombre de la partida para el archivo:', localStorage.getItem(COMPANY_KEY) ?? 'Mi campaña');
    if (name === null) return;
    downloadSave(collectSave(name.trim() || 'Mi campaña'));
  });
  liveBtns.appendChild(exportLive);
  live.appendChild(liveBtns);
  host.appendChild(live);

  SAVE_SLOT_KEYS.forEach((key, index) => {
    const save = slotSave(index);
    const row = document.createElement('div');
    row.className = 'slot';
    if (save) {
      const summary = describeSave(save, trackLevel);
      row.innerHTML =
        `<div class="sinfo"><b>${index + 1}. ${escapeHtml(summary.name)}</b><br>` +
        `${fmtDate(summary.savedAt)}` +
        (summary.credits !== undefined ? ` · ⌾${summary.credits} · ${summary.contractsDone} contratos` : ' · sin campaña') +
        (summary.expeditionDay !== undefined ? ` · expedición día ${summary.expeditionDay}` : '') +
        `<br>pilotos: ${summary.pilotNames.map(escapeHtml).join(', ')} · ${summary.totalPilotLevels} niveles</div>`;
    } else {
      row.innerHTML = `<div class="sinfo"><b>${index + 1}.</b> <span class="sempty">ranura vacía</span></div>`;
    }
    const btns = document.createElement('div');
    btns.className = 'sbtns';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Guardar aquí';
    saveBtn.addEventListener('click', async () => {
      if (save && !(await uiConfirm(`¿Sobrescribir "${save.name}"?`))) return;
      const name = await uiPrompt('Nombre de la partida:', save?.name ?? localStorage.getItem(COMPANY_KEY) ?? `Campaña ${index + 1}`);
      if (name === null) return;
      try {
        localStorage.setItem(key, serializeSave(collectSave(name.trim() || `Campaña ${index + 1}`)));
      } catch { /* privado */ }
      renderSaves();
    });
    btns.appendChild(saveBtn);

    if (save) {
      const loadBtn = document.createElement('button');
      loadBtn.textContent = '⌁ Cargar';
      loadBtn.addEventListener('click', async () => {
        if (!(await uiConfirm(`¿Cargar "${save.name}"? La partida en curso se reemplaza (expórtala antes si quieres conservarla).`))) return;
        applySave(save);
      });
      btns.appendChild(loadBtn);

      const exportBtn = document.createElement('button');
      exportBtn.textContent = '⇩ Exportar';
      exportBtn.addEventListener('click', () => downloadSave(save));
      btns.appendChild(exportBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'danger';
      deleteBtn.textContent = '✕ Borrar';
      deleteBtn.addEventListener('click', async () => {
        if (!(await uiConfirm(`¿Borrar la ranura "${save.name}"?`))) return;
        localStorage.removeItem(key);
        renderSaves();
      });
      btns.appendChild(deleteBtn);
    }
    row.appendChild(btns);
    host.appendChild(row);
  });
}

function openSaves(): void {
  savesOpen = true;
  renderSaves();
  $('saves').classList.add('show');
}

function closeSaves(): void {
  savesOpen = false;
  $('saves').classList.remove('show');
}

// ── Ficha de pilotos: árbol de especialización y manías ─────────────────

let pilotsOpen = false;

function openPilots(): void {
  pilotsOpen = true;
  renderPilots();
  $('pilots').classList.add('show');
}

function closePilots(): void {
  pilotsOpen = false;
  $('pilots').classList.remove('show');
}

function renderPilots(hostId = 'pilots-body'): void {
  const host = $(hostId);
  host.innerHTML = '';
  for (const pilotId of PILOT_IDS) {
    const pilot = pilots[pilotId]!;
    const card = document.createElement('div');
    card.className = 'pcard';
    card.innerHTML = `<h3>${escapeHtml(pilot.name)}` +
      (isInjured(pilot) ? `<span class="symptom">🩹 herido: ${pilot.injuryDays} jornada${pilot.injuryDays! > 1 ? 's' : ''}</span>` : '') +
      (pilot.mainSpec
        ? `<span class="dom">★ ${SPEC_LABEL[pilot.mainSpec]}${pilot.sideSpec ? ` · ☆ ${SPEC_LABEL[pilot.sideSpec]}` : ''}</span>`
        : '<span class="dom" style="color:var(--muted)">sin escuela</span>') + '</h3>';

    // Pista BÁSICA: siempre activa, aprende de todo.
    {
      const xp = pilot.basics ?? 0;
      const level = trackLevel(xp);
      const next = TRACK_LEVEL_THRESHOLDS[level];
      const track = document.createElement('div');
      track.className = 'ptrack';
      track.innerHTML =
        `<div class="plabel"><b>🧭 Pilotaje</b>` +
        `<span class="pxp">N${level}${next !== undefined ? ` · ${xp}/${next} XP` : ' · MÁX'} · +${level} puntería/evasión</span></div>` +
        '<div class="pnodes"><span class="pnode unlocked" title="La básica aprende de todo lo que pasa ahí fuera: el 30% de cada ganancia, más toda la XP de pistas sin elegir."><b>oficio puro: crece con cualquier trabajo</b></span></div>';
      card.appendChild(track);
    }

    for (const spec of SPECIALIZATIONS) {
      const xp = pilot.tracks[spec];
      const level = trackLevel(xp);
      const next = TRACK_LEVEL_THRESHOLDS[level];
      const isMain = pilot.mainSpec === spec;
      const isSide = pilot.sideSpec === spec;
      const dormant = !isMain && !isSide;
      const track = document.createElement('div');
      track.className = 'ptrack' + (dormant ? ' dormant' : '');
      const tag = isMain ? ' <span class="dom">★ principal</span>'
        : isSide ? ' <span class="dom">☆ secundaria (XP al 60%)</span>'
        : ' <span class="gmuted" style="font-size:9px">dormida: su XP fluye a pilotaje</span>';
      track.innerHTML =
        `<div class="plabel"><b>${SPEC_LABEL[spec]}</b>${tag}` +
        `<span class="pxp">N${level}${next !== undefined ? ` · ${xp}/${next} XP` : ' · MÁX'}</span></div>`;
      const nodes = document.createElement('div');
      nodes.className = 'pnodes';
      (PERKS.perkNames?.[spec] ?? []).forEach((perk, index) => {
        const node = document.createElement('span');
        node.className = 'pnode' +
          (!dormant && index < level ? ' unlocked' : !dormant && index === level ? ' next' : '');
        node.title = dormant ? `${perk.description} (dormido: elige esta escuela para activarlo)` : perk.description;
        node.innerHTML = `<b>${index + 1}. ${perk.name}</b>`;
        nodes.appendChild(node);
      });
      track.appendChild(nodes);
      card.appendChild(track);
    }

    // Elegir escuela: UNA principal y UNA secundaria. La XP bancada en
    // pistas que dejan de estar elegidas queda dormida, no se borra.
    const choose = document.createElement('button');
    choose.className = 'gbtn';
    choose.textContent = pilot.mainSpec ? '⚙ Cambiar especialización' : '⚙ Elegir especialización';
    choose.addEventListener('click', () => {
      void uiChoice(`${pilot.name} — elige la escuela PRINCIPAL (su árbol entero se activa y su XP entra al 100%):`,
        SPECIALIZATIONS.map((s) => ({
          id: s,
          label: `${pilot.mainSpec === s ? '★ ' : ''}${SPEC_LABEL[s]} N${trackLevel(pilot.tracks[s])}`,
          detail: `${pilot.tracks[s]} XP bancada`,
        }))).then((main) => {
        const mainSpec = main as SpecializationId;
        void uiChoice(`Y la SECUNDARIA (árbol activo, XP al 60%):`,
          [...SPECIALIZATIONS.filter((s) => s !== mainSpec).map((s) => ({
            id: s,
            label: `${pilot.sideSpec === s ? '☆ ' : ''}${SPEC_LABEL[s]} N${trackLevel(pilot.tracks[s])}`,
            detail: `${pilot.tracks[s]} XP bancada`,
          })), { id: '__none__', label: 'Sin secundaria', detail: 'toda esa XP fluirá a pilotaje' }],
        ).then((side) => {
          pilots = {
            ...pilots,
            [pilotId]: chooseSpecs(pilot, mainSpec, side === '__none__' ? undefined : side as SpecializationId),
          };
          savePilots();
          renderPilots(hostId);
        });
      });
    });
    card.appendChild(choose);

    const stress = pilot.stress ?? 0;
    const label = stressLabel(stress);
    const stressBox = document.createElement('div');
    stressBox.className = 'pstress';
    stressBox.innerHTML =
      `<span class="qtitle">Estrés</span>` +
      `<span class="bar ht"><i style="width:${stress}%"></i></span>` +
      `<span class="pxp">${stress}/100${label ? ` · ${label}` : ''}</span>`;
    card.appendChild(stressBox);

    const quirksBox = document.createElement('div');
    quirksBox.className = 'pquirks';
    quirksBox.innerHTML = '<div class="qtitle">Manías</div>';
    const owned = pilot.quirks ?? [];
    for (const quirkId of owned) {
      const quirk = PERKS.quirks?.[quirkId];
      if (!quirk) continue;
      const chip = document.createElement('span');
      chip.className = 'pquirk';
      chip.textContent = quirk.name;
      chip.title = quirk.description;
      quirksBox.appendChild(chip);
    }
    for (let i = owned.length; i < (PERKS.quirkCap ?? 4); i++) {
      const chip = document.createElement('span');
      chip.className = 'pquirk empty';
      chip.textContent = '· · ·';
      chip.title = 'Espacio libre: las manías se graban viviendo.';
      quirksBox.appendChild(chip);
    }
    card.appendChild(quirksBox);
    host.appendChild(card);
  }
}

// ── Editor de mapas ──────────────────────────────────────────────────────

type EditorTool =
  | { kind: 'terrain'; terrain: 'plain' | 'rough' | 'forest' | 'water' | 'wall' }
  | { kind: 'spawn'; team: Team };

let editorOpen = false;
let edRows: string[] = [];
let edPlayer: Position[] = [];
let edEnemy: Position[] = [];
let edTool: EditorTool = { kind: 'terrain', terrain: 'plain' };
let edHeight = 0;
let painting = false;

/** Carácter ASCII del motor para un terreno con altura. */
function charFor(terrain: string, height: number): string {
  switch (terrain) {
    case 'plain': return String(Math.min(9, height));
    case 'rough': return String.fromCharCode(97 + Math.min(9, height));
    case 'forest': return String.fromCharCode(65 + Math.min(9, height));
    case 'water': return '~';
    default: return '#';
  }
}

function edNewMap(width: number, height: number): void {
  edRows = Array.from({ length: height }, () => '0'.repeat(width));
  // Spawns por defecto: columnas extremas, como el valle.
  const clampY = (y: number): number => Math.min(height - 1, y);
  edPlayer = [{ x: 1, y: clampY(3) }, { x: 0, y: clampY(5) }, { x: 1, y: clampY(height - 2) }, { x: 0, y: clampY(4) }];
  edEnemy = [{ x: width - 2, y: clampY(3) }, { x: width - 1, y: clampY(5) }, { x: width - 2, y: clampY(6) }, { x: width - 1, y: clampY(2) }];
  renderEditor();
}

function edPaint(x: number, y: number): void {
  if (edTool.kind === 'terrain') {
    const row = edRows[y]!;
    edRows[y] = row.slice(0, x) + charFor(edTool.terrain, edHeight) + row.slice(x + 1);
  } else {
    // Colocar spawn: quita cualquier spawn previo en esa casilla y rota
    // el más antiguo del bando para mantener exactamente 4.
    const same = (p: Position): boolean => p.x === x && p.y === y;
    edPlayer = edPlayer.filter((p) => !same(p));
    edEnemy = edEnemy.filter((p) => !same(p));
    const list = edTool.team === 'player' ? edPlayer : edEnemy;
    list.push({ x, y });
    while (list.length > 4) list.shift();
  }
  renderEditor();
}

function renderEditorTools(): void {
  const host = $('ed-tools');
  host.innerHTML = '';
  const mk = (label: string, on: boolean, onClick: () => void): void => {
    const btn = document.createElement('button');
    btn.className = 'edtool' + (on ? ' on' : '');
    btn.textContent = label;
    btn.addEventListener('click', () => { onClick(); renderEditor(); });
    host.appendChild(btn);
  };
  const terrains: Array<[EditorTool & { kind: 'terrain' }, string]> = [
    [{ kind: 'terrain', terrain: 'plain' }, 'llanura'],
    [{ kind: 'terrain', terrain: 'rough' }, '▒ abrupto'],
    [{ kind: 'terrain', terrain: 'forest' }, '♣ bosque'],
    [{ kind: 'terrain', terrain: 'water' }, '~ agua'],
    [{ kind: 'terrain', terrain: 'wall' }, '# muro'],
  ];
  for (const [tool, label] of terrains) {
    mk(label, edTool.kind === 'terrain' && edTool.terrain === tool.terrain, () => { edTool = tool; });
  }
  for (let h = 0; h <= 4; h++) {
    mk(`altura ${h}`, edHeight === h && edTool.kind === 'terrain' && edTool.terrain !== 'water' && edTool.terrain !== 'wall',
      () => { edHeight = h; });
  }
  mk('P spawn', edTool.kind === 'spawn' && edTool.team === 'player', () => { edTool = { kind: 'spawn', team: 'player' }; });
  mk('E spawn', edTool.kind === 'spawn' && edTool.team === 'enemy', () => { edTool = { kind: 'spawn', team: 'enemy' }; });
}

function renderEditorBoard(): void {
  const board = $('ed-board');
  const width = edRows[0]!.length;
  board.style.gridTemplateColumns = `repeat(${width}, 38px)`;
  board.innerHTML = '';
  let map: GameMap;
  try {
    map = GameMap.fromAscii(edRows);
  } catch {
    return;
  }
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tileAt({ x, y });
      const cell = document.createElement('button');
      cell.className = 'cell actionable';
      cell.style.background = shade(TERRAIN_BASE[tile.terrain]!, tile.height);
      if (tile.terrain === 'water') cell.textContent = '~';
      if (tile.terrain === 'rough') cell.textContent = '▒';
      if (tile.terrain === 'forest') cell.textContent = '♣';
      cell.style.color = 'rgba(255,255,255,0.25)';
      if (tile.height > 0 && tile.terrain !== 'wall') {
        const h = document.createElement('span');
        h.className = 'h';
        h.textContent = String(tile.height);
        cell.appendChild(h);
      }
      const pIdx = edPlayer.findIndex((p) => p.x === x && p.y === y);
      const eIdx = edEnemy.findIndex((p) => p.x === x && p.y === y);
      if (pIdx >= 0 || eIdx >= 0) {
        const badge = document.createElement('span');
        badge.className = `sp ${pIdx >= 0 ? 'p' : 'e'}`;
        badge.textContent = pIdx >= 0 ? `P${pIdx + 1}` : `E${eIdx + 1}`;
        cell.appendChild(badge);
      }
      cell.addEventListener('mousedown', (ev) => { ev.preventDefault(); painting = true; edPaint(x, y); });
      cell.addEventListener('mouseenter', () => { if (painting && edTool.kind === 'terrain') edPaint(x, y); });
      board.appendChild(cell);
    }
  }
}

function renderEditor(): void {
  renderEditorTools();
  renderEditorBoard();
  const loadSelect = $('ed-load') as HTMLSelectElement;
  const current = loadSelect.value;
  loadSelect.innerHTML = '<option value="">— cargar mapa —</option>';
  for (const name of Object.keys(customMaps).sort()) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    loadSelect.appendChild(opt);
  }
  loadSelect.value = customMaps[current] ? current : '';
}

/** Valida y guarda el mapa del editor; devuelve el nombre o null. */
function edSave(): string | null {
  const name = ($('ed-name') as HTMLInputElement).value.trim();
  if (!name) { void uiAlert('Ponle nombre al mapa.'); return null; }
  const bad = [...edPlayer, ...edEnemy].find((p) => {
    const ch = edRows[p.y]?.[p.x];
    return ch === undefined || ch === '#';
  });
  if (bad) { void uiAlert(`Hay un spawn sobre un muro o fuera del mapa (${bad.x},${bad.y}).`); return null; }
  customMaps[name] = {
    name,
    rows: [...edRows],
    playerSpawns: edPlayer.map((p) => ({ ...p })),
    enemySpawns: edEnemy.map((p) => ({ ...p })),
  };
  saveCustomMaps();
  refreshMapSelect();
  renderEditor();
  return name;
}

function openEditor(): void {
  editorOpen = true;
  closeGarage();
  closeMerc();
  if (edRows.length === 0) edNewMap(12, 9);
  renderEditor();
  $('editor').classList.add('show');
}

function closeEditor(): void {
  editorOpen = false;
  $('editor').classList.remove('show');
}

// ── Menú de inicio ───────────────────────────────────────────────────────

let startOpen = false;
const SKIP_MENU_FLAG = 'gea-skip-menu';
/** Sandbox de batallas (escaramuza libre); false = modo campaña/juego. */
let sandboxMode = false;

function inCampaign(): boolean {
  return campaign !== null && !sandboxMode;
}

/** Refleja el modo en la UI: la campaña esconde el sandbox de batallas. */
function applyModeUi(): void {
  document.body.classList.toggle('mode-campaign', inCampaign());
}

function enterSandbox(): void {
  sandboxMode = true;
  applyModeUi();
  closeStart();
  closeMerc();
  closeWorld();
  closeCity();
  openGarage();
}

function hasLiveGame(): boolean {
  return campaign !== null ||
    Object.values(pilots).some((p) => Object.values(p.tracks).some((xp) => xp > 0));
}

function openStart(): void {
  startOpen = true;
  const live = hasLiveGame();
  ($('st-continue') as HTMLButtonElement).disabled = !live;
  $('st-info').innerHTML = campaign
    ? `Partida en curso: ⌾${campaign.credits} · ${campaign.contractsDone} contratos` +
      (expedition ? ` · expedición día ${expedition.day}` : ' · en el cuartel')
    : live ? 'Hay progreso de escaramuzas y pilotos.' : 'Sin partida en curso.';
  $('start').classList.add('show');
}

function closeStart(): void {
  startOpen = false;
  $('start').classList.remove('show');
}

// ── Fundación de la compañía (asistente de juego nuevo) ────────────────

const COMPANY_KEY = 'gea-company';
let newGameOpen = false;
let ngDifficulty = 'mercenario';
let ngCompanion = STARTER_COMPANIONS[0]!.id;

async function openNewGame(): Promise<void> {
  if (hasLiveGame() &&
      !(await uiConfirm('¿Empezar un JUEGO NUEVO? La partida en curso se borra (las ranuras guardadas y tus mapas del editor se conservan — expórtala antes desde 💾 si quieres).'))) {
    return;
  }
  newGameOpen = true;
  closeStart();
  renderNewGame();
  $('newgame').classList.add('show');
}

function closeNewGame(): void {
  newGameOpen = false;
  $('newgame').classList.remove('show');
  openStart();
}

function renderNewGame(): void {
  // Dificultades.
  const diffHost = $('ng-diff');
  diffHost.innerHTML = '';
  for (const diff of DIFFICULTIES) {
    const btn = document.createElement('button');
    btn.className = 'ngopt' + (diff.id === ngDifficulty ? ' sel' : '');
    btn.dataset['diff'] = diff.id;
    btn.innerHTML = `<b>${diff.name}</b> · ⌾${diff.credits} · ${diff.supplies} suministros` +
      `<span class="sub">${diff.description}</span>`;
    btn.addEventListener('click', () => { ngDifficulty = diff.id; renderNewGame(); });
    diffHost.appendChild(btn);
  }
  // Compañeras elegibles, con sus stats de fábrica.
  const compHost = $('ng-companion');
  compHost.innerHTML = '';
  for (const option of STARTER_COMPANIONS) {
    const def = ZOIDS[option.id];
    if (!def) continue;
    const btn = document.createElement('button');
    btn.className = 'ngopt' + (option.id === ngCompanion ? ' sel' : '');
    btn.dataset['comp'] = option.id;
    btn.innerHTML = `<b>${option.id === ngCompanion ? '❤ ' : ''}${def.name}</b>` +
      ` · HP ${def.stats.maxHp} · ATQ ${def.stats.atk} · DEF ${def.stats.def} · MOV ${def.stats.move}` +
      `<span class="sub">${option.blurb}</span>`;
    btn.addEventListener('click', () => { ngCompanion = option.id; renderNewGame(); });
    compHost.appendChild(btn);
  }
  // Pilotos (inputs persistentes entre re-renders vía defaultValue).
  const pilotHost = $('ng-pilots');
  if (pilotHost.childElementCount === 0) {
    DEFAULT_PILOT_NAMES.forEach((name, i) => {
      const input = document.createElement('input');
      input.id = `ng-pilot-${i}`;
      input.maxLength = 18;
      input.value = name;
      input.placeholder = `Piloto ${i + 1}`;
      pilotHost.appendChild(input);
    });
  }
}

/** Funda la compañía: crea la partida desde cero y arranca en el cuartel. */
function foundCompany(): void {
  const diff = DIFFICULTIES.find((d) => d.id === ngDifficulty) ?? DIFFICULTIES[1]!;
  const company = ($('ng-name') as HTMLInputElement).value.trim() || 'Compañía sin nombre';
  try {
    localStorage.removeItem(CAMPAIGN_KEY);
    localStorage.removeItem(EXPEDITION_KEY);
    localStorage.removeItem(GARAGE_KEY);
    const freshPilots: Record<string, PilotState> = {};
    PILOT_IDS.forEach((id, i) => {
      const value = ($(`ng-pilot-${i}`) as HTMLInputElement | null)?.value.trim();
      freshPilots[id] = newPilot(id, value || DEFAULT_PILOT_NAMES[i]!);
    });
    localStorage.setItem(PILOTS_KEY, JSON.stringify(freshPilots));
    const founded = newCampaign(ECONOMY, factoryLoadout, {
      credits: diff.credits,
      supplies: diff.supplies,
      starterRoster: [ngCompanion, 'command-wolf', 'gun-sniper', 'gustav'],
      difficulty: diff.id,
    });
    founded.chronicle = [
      `⚑ Se funda ${company}. Dificultad ${diff.name}: ⌾${diff.credits} y ${diff.supplies} suministros. La compañera: ${ZOIDS[ngCompanion]?.name ?? ngCompanion}.`,
    ];
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(founded));
    localStorage.setItem(COMPANY_KEY, company);
    sessionStorage.setItem(SKIP_MENU_FLAG, '1');
  } catch { /* privado */ }
  window.location.reload();
}

// ── Arranque ─────────────────────────────────────────────────────────────

function restart(): void {
  // Cerrar SIEMPRE el overlay de fin de batalla: al volver al mapa o al
  // cuartel no se hacía (solo lo cerraba startBattle), y el cartel de
  // Victoria/Derrota se quedaba encima — parecía que no te mandaba de vuelta.
  $('overlay').classList.remove('show');
  if (returnToWorld && expedition && campaign) {
    returnToWorld = false;
    openWorld();
    return;
  }
  if (returnToMerc && campaign) {
    // La batalla de contrato ya se liquidó: vuelve al cuartel para reparar,
    // comprar y elegir el siguiente contrato.
    openMerc();
    return;
  }
  const seed = Number(($('seed') as HTMLInputElement).value) || 42;
  const weather = ($('weather') as HTMLSelectElement).value as WeatherId;
  newBattle(seed, weather);
}

$('restart').addEventListener('click', () => { returnToMerc = false; restart(); });
$('ov-restart').addEventListener('click', restart);
$('garage-btn').addEventListener('click', openGarage);
$('deploy').addEventListener('click', () => { closeGarage(); returnToMerc = false; restart(); });
$('merc-btn').addEventListener('click', () => {
  sandboxMode = false;
  applyModeUi();
  if (expedition) openWorld();
  else openMerc();
});
$('city-close').addEventListener('click', closeCity);
// Tres vistas de batalla: plana (DOM), mesa (CSS inclinado) y DIORAMA
// (canvas isométrico real, escalón 3). El botón cicla y se recuerda.
const VIEW_KEY = 'gea-view';
type ViewMode = 'plana' | 'mesa' | 'diorama';
function currentView(): ViewMode {
  const stored = localStorage.getItem(VIEW_KEY);
  if (stored === 'plana' || stored === 'mesa' || stored === 'diorama') return stored;
  if (localStorage.getItem('gea-iso') === 'on') return 'mesa'; // migración
  return 'diorama'; // la vista por defecto es el diorama
}
function applyViewMode(): void {
  const view = currentView();
  document.body.classList.toggle('iso-view', view === 'mesa');
  document.body.classList.toggle('diorama-view', view === 'diorama');
  ($('rot-btn') as HTMLElement).style.display = view === 'diorama' ? '' : 'none';
  $('iso-btn').classList.toggle('mode-on', view !== 'plana');
  $('iso-btn').textContent = view === 'plana' ? '🗺 plana' : view === 'mesa' ? '🧊 mesa' : '🏔 diorama';
}
$('rot-btn').addEventListener('click', rotateDiorama);
$('iso-btn').addEventListener('click', () => {
  const next: ViewMode = currentView() === 'plana' ? 'mesa' : currentView() === 'mesa' ? 'diorama' : 'plana';
  try { localStorage.setItem(VIEW_KEY, next); } catch { /* privado */ }
  applyViewMode();
  renderAll();
});
applyViewMode();

function wireSfxButton(id: string): void {
  const btn = $(id);
  const paint = (): void => { btn.textContent = sfxEnabled() ? '🔊' : '🔇'; };
  paint();
  btn.addEventListener('click', () => { toggleSfx(); paint(); (document.querySelectorAll('.sfxbtn') as NodeListOf<HTMLElement>).forEach((b) => { b.textContent = sfxEnabled() ? '🔊' : '🔇'; }); });
}
wireSfxButton('sfx-btn');
wireSfxButton('merc-sfx');
wireSfxButton('world-sfx');
wireSfxButton('city-sfx');
$('city-menu').addEventListener('click', () => { closeCity(); closeWorld(); openStart(); });
$('city-back').addEventListener('click', () => { cityBuilding = null; playSfx('click'); renderCity(); });

$('chronicle-close').addEventListener('click', closeChronicle);
$('merc-deploy').addEventListener('click', startContractExpedition);
$('merc-freeroam').addEventListener('click', startFreeRoam);
window.addEventListener('mouseup', () => { painting = false; });
$('saves-close').addEventListener('click', closeSaves);
$('save-import').addEventListener('click', () => { ($('save-file') as HTMLInputElement).click(); });
$('save-file').addEventListener('change', () => {
  const input = $('save-file') as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const save = validateSave(String(reader.result ?? ''));
    if (!save) { void uiAlert('Ese archivo no es una partida de Gea válida.'); return; }
    if (!(await uiConfirm(`¿Cargar "${save.name}" (${fmtDate(save.savedAt)})? La partida en curso se reemplaza.`))) return;
    applySave(save);
  };
  reader.readAsText(file);
});
$('pilots-btn-g').addEventListener('click', openPilots);
$('pilots-close').addEventListener('click', closePilots);
$('editor-btn').addEventListener('click', openEditor);
$('ed-close').addEventListener('click', closeEditor);
$('ed-new').addEventListener('click', () => {
  const width = Math.max(6, Math.min(18, Number(($('ed-w') as HTMLInputElement).value) || 12));
  const height = Math.max(5, Math.min(14, Number(($('ed-h') as HTMLInputElement).value) || 9));
  edNewMap(width, height);
});
$('ed-gen').addEventListener('click', () => {
  // Semilla nueva en cada pulsación: el generador propone, tú retocas.
  const gen = generateBattlefield(`editor-${Date.now()}`);
  edRows = [...gen.rows];
  edPlayer = gen.playerSpawns.map((p) => ({ ...p }));
  edEnemy = gen.enemySpawns.map((p) => ({ ...p }));
  ($('ed-name') as HTMLInputElement).value = gen.name;
  renderEditor();
});
$('ed-load').addEventListener('change', () => {
  const map = customMaps[($('ed-load') as HTMLSelectElement).value];
  if (!map) return;
  edRows = [...map.rows];
  edPlayer = map.playerSpawns.map((p) => ({ ...p }));
  edEnemy = map.enemySpawns.map((p) => ({ ...p }));
  ($('ed-name') as HTMLInputElement).value = map.name;
  renderEditor();
});
$('ed-delete').addEventListener('click', async () => {
  const name = ($('ed-load') as HTMLSelectElement).value;
  if (!name || !customMaps[name]) return;
  if (!(await uiConfirm(`¿Borrar el mapa "${name}"?`))) return;
  delete customMaps[name];
  if (currentMapName === name) currentMapName = '';
  saveCustomMaps();
  refreshMapSelect();
  renderEditor();
});
$('ed-save').addEventListener('click', () => { edSave(); });
$('ed-play').addEventListener('click', () => {
  const name = edSave();
  if (!name) return;
  currentMapName = name;
  saveCustomMaps();
  refreshMapSelect();
  closeEditor();
  returnToMerc = false;
  restart();
});
$('map-select').addEventListener('change', () => {
  currentMapName = ($('map-select') as HTMLSelectElement).value;
  saveCustomMaps();
});

$('menu-btn').addEventListener('click', openStart);
$('world-menu').addEventListener('click', openStart);
$('merc-menu').addEventListener('click', openStart);
$('world-saves').addEventListener('click', openSaves);
$('merc-saves').addEventListener('click', openSaves);
$('city-saves').addEventListener('click', openSaves);
$('st-continue').addEventListener('click', () => {
  if (!campaign) { enterSandbox(); return; }
  sandboxMode = false;
  applyModeUi();
  closeStart();
});
$('st-sandbox').addEventListener('click', enterSandbox);
$('st-new').addEventListener('click', openNewGame);
$('ng-cancel').addEventListener('click', closeNewGame);
$('ng-found').addEventListener('click', foundCompany);
$('st-load').addEventListener('click', () => { closeStart(); openSaves(); });

refreshMapSelect();
restart();
// Arranque del JUEGO: siempre en ciudad — el cuartel, o el lugar de la
// expedición (con su pantalla urbana si es ciudad). El tablero de
// batalla solo se alcanza jugando: contrato o exploración.
applyModeUi();
if (expedition && campaign) {
  openWorld();
  if (cityNode()) openCity();
} else if (campaign) {
  openMerc();
}
// Y encima de todo, el menú de inicio (salvo tras "juego nuevo"/carga).
try {
  if (sessionStorage.getItem(SKIP_MENU_FLAG)) sessionStorage.removeItem(SKIP_MENU_FLAG);
  else openStart();
} catch {
  openStart();
}
