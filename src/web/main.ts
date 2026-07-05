/**
 * Cliente web jugable del motor, con flujo estilo XCOM:
 * seleccionar → previsualizar → confirmar, manejable por completo con
 * teclado (WASD/flechas + E/Enter) o ratón sobre el mismo cursor.
 *
 * Consume solo la API pública del motor (Battle + BattleEvent).
 * Build: npm run web  →  dist/web/gea.html (autocontenido).
 */
import { planTurn } from '../ai/simpleAi.js';
import { Battle, type UnitSpawn } from '../core/battle.js';
import { attackArc, type AttackArc } from '../core/combat.js';
import { posKey, terrainLabel, TERRAIN_COVER } from '../core/grid.js';
import { reachableTiles, type ReachableTile } from '../core/pathfinding.js';
import {
  applyXp, awardXp, dominantTrack, newPilot, trackLevel, TRACK_LEVEL_THRESHOLDS,
  type PilotState, type SpecializationId,
} from '../core/progression.js';
import { STATUS_DEFINITIONS } from '../core/status.js';
import type { BattleEvent, Facing, Position, Team, UnitState, WeatherId } from '../core/types.js';
import { ABILITIES } from '../data/abilities.js';
import { CONTRACT_ENEMY_POOL, ECONOMY } from '../data/economy.js';
import { VALLEY_CROSSING } from '../data/maps.js';
import { GARAGE_MODULE_OPTIONS, MODULES } from '../data/modules.js';
import { PERKS } from '../data/progression.js';
import { withWeaponLibrary } from '../data/weaponLibrary.js';
import { WEAPONS } from '../data/weapons.js';
import { ZOIDS } from '../data/zoids.js';
import {
  buyWeapon, buyZoid, contractOffers, mountedCount, newCampaign, rebuildCost,
  rebuildZoid, repairCost, repairZoid, resolveContract, sellWeapon, setMountedWeapons,
  type CampaignState, type Contract,
} from '../game/mercenary.js';

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

/** Escaramuza libre: el equipo del garaje contra un equipo por semilla. */
function newBattle(seed: number, weather: WeatherId): void {
  activeContract = null; // empezar escaramuza abandona el contrato en curso
  deployedSlots = [];
  returnToMerc = false;
  const spawns: UnitSpawn[] = [
    ...garage.map((config, i) => ({
      id: PLAYER_IDS[i]!,
      name: ZOIDS[config.unitTypeId]!.name,
      unitTypeId: config.unitTypeId,
      team: 'player' as Team,
      position: PLAYER_POSITIONS[i]!,
      loadout: spawnLoadout(config),
      ...(i === 0 ? { commander: true } : {}),
    })),
    ...enemyTeam(seed),
  ];
  startBattle(spawns, seed, weather);
}

function startBattle(spawns: UnitSpawn[], seed: number, weather: WeatherId): void {
  battle = new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog,
    moduleCatalog: MODULES,
    weaponCatalog: CATALOGS.weaponCatalog,
    weather,
    seed,
    spawns,
    // El id Pn conserva el hueco n aunque falten unidades (campaña con
    // bajas): el piloto n siempre tripula el hueco n.
    pilots: Object.fromEntries(
      spawns.filter((s) => s.team === 'player')
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
    if (battle.isOver || i >= actions.length) {
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
  advance();
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
        logEvents(battle.execute({ type: 'ability', unitId: unit.id, abilityId: mode.abilityId, target: cursor }));
        pending = null;
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

// ── Teclado ──────────────────────────────────────────────────────────────

document.addEventListener('keydown', (event) => {
  if (garageOpen) {
    if (event.key === 'Escape') closeGarage();
    return;
  }
  if (mercOpen) {
    if (event.key === 'Escape') closeMerc();
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
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${battle.map.width}, 46px)`;
  board.innerHTML = '';
  const active = battle.getActiveUnit();
  const unit = playerUnit();
  const path = previewPath();
  const faces = facingCells();

  for (let y = 0; y < battle.map.height; y++) {
    for (let x = 0; x < battle.map.width; x++) {
      const pos = { x, y };
      const key = posKey(pos);
      const tile = battle.map.tileAt(pos);
      const cell = document.createElement('button');
      cell.className = 'cell';
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
      if (occupant) {
        const chip = document.createElement('div');
        chip.className = `chip ${occupant.team}`;
        if (active?.id === occupant.id) chip.classList.add('active-unit');
        chip.innerHTML = `<span>${occupant.id}${FACING_ARROW[occupant.facing]}</span>`;
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
  return preview ? `${preview.chance}%` : undefined;
}

function renderBanner(): void {
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
    ? `▶ ${active.id} ${active.name} — ${modeText}<span class="kbd-hint">M mover · B boost · 1-9 armas · R recargar · F/espacio fin de turno</span>`
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
      lines.push(`<div>impacto <b>${chance}%</b> · daño <b>${min}–${max}</b> · arco <b class="${arc === 'back' ? 'pv-good' : arc === 'side' ? 'pv-warn' : ''}">${ARC_LABEL[arc]}</b>${heightAdvantage !== 0 ? ` · altura ${heightAdvantage > 0 ? '+' : ''}${heightAdvantage}` : ''}${cover > 0 ? ` · <span class="pv-warn">cobertura −${cover}</span>` : ''}${weatherPenalty > 0 ? ` · <span class="pv-warn">clima −${weatherPenalty}</span>` : ''}</div>`);
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
      (unit.hp <= 0 ? ' <span class="dead">DESTRUIDO</span>' : '') +
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
        const mods = document.createElement('div');
        mods.className = 'mods';
        for (const module of frame.modules) {
          const span = document.createElement('span');
          if (module.destroyed) span.classList.add('destroyed');
          span.textContent = module.destroyed ? module.slot : `${module.slot} ${module.hp}`;
          mods.appendChild(span);
        }
        card.appendChild(mods);
      }
    }
    el.appendChild(card);
  }
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
      return event.delta > 0 ? { text: `🔥 calor de ${event.unitId}: ${event.current} (+${event.delta})`, cls: 'warn' } : undefined;
    case 'weapon-reloaded': return { text: `${event.unitId} recarga (${event.ammo} disparos)`, cls: 'good' };
    case 'unit-shutdown': return { text: `⚠ ${unitLabel(event.unitId)}: APAGADO DE EMERGENCIA (${event.damage} daño interno)`, cls: 'warn' };
    case 'projectile-fired': return undefined; // el renderer 3D lo animará
    case 'unit-pushed': return { text: `${event.unitId} sale despedido a (${event.to.x},${event.to.y})`, cls: 'warn' };
    case 'terrain-destroyed': return { text: `💥 muro derribado en (${event.pos.x},${event.pos.y})`, cls: 'warn' };
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
    }
    if (event.type === 'unit-pushed') {
      pendingMoveAnim = { unitId: event.unitId, path: [event.from, event.to] };
    }
    if (event.type === 'damage-dealt' || event.type === 'status-ticked' || event.type === 'unit-shutdown') {
      pendingHits.add(event.type === 'damage-dealt' ? event.targetUnitId
        : event.type === 'status-ticked' ? event.targetUnitId : event.unitId);
    }
    const line = describe(event);
    if (line) log(line.text, line.cls);
  }
}

function showOverlay(): void {
  const won = battle.winner === 'player';
  $('ov-title').textContent = won ? 'Victoria' : 'Derrota';
  $('ov-title').style.color = won ? 'var(--player)' : 'var(--enemy)';
  $('ov-sub').textContent = won
    ? 'El equipo cian controla el valle. [Enter] para otra batalla.'
    : 'Tus Zoids quedan fuera de combate. [Enter] para reintentar.';
  $('ov-merc').innerHTML = activeContract ? settleContract() : '';
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
    savePilots();

    const lines: string[] = [];
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

/** Piezas montadas cuya spec casa con la pista dominante del piloto. */
function synergyPieces(config: SlotConfig, pilot: PilotState): { spec: SpecializationId; count: number } | undefined {
  const dominant = dominantTrack(pilot);
  if (trackLevel(pilot.tracks[dominant]) === 0) return undefined;
  const def = ZOIDS[config.unitTypeId]!;
  const specs: (SpecializationId | undefined)[] = [
    ...config.weapons.map((w) => CATALOGS.weaponCatalog[w]?.spec),
    ...(def.frame ?? []).map((entry) => MODULES[config.slots[entry.slot] ?? entry.moduleId]?.spec),
  ];
  const count = Math.min(PERKS.synergyCap, specs.filter((s) => s === dominant).length);
  return count > 0 ? { spec: dominant, count } : undefined;
}

function pilotSummary(pilot: PilotState): string {
  const bits: string[] = [];
  for (const spec of Object.keys(pilot.tracks) as SpecializationId[]) {
    const xp = pilot.tracks[spec];
    const level = trackLevel(xp);
    if (xp <= 0) continue;
    const next = TRACK_LEVEL_THRESHOLDS[level];
    bits.push(`${SPEC_LABEL[spec]} <b>N${level}</b>${next !== undefined ? ` <span class="gmuted">${xp}/${next}</span>` : ''}`);
  }
  return bits.length > 0 ? bits.join(' · ') : '<span class="gmuted">piloto novato — la XP se gana en batalla</span>';
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

    // Chasis.
    const zoidSelect = document.createElement('select');
    for (const unit of Object.values(ZOIDS)) {
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
const TIER_LABEL: Record<Contract['tier'], string> = { escolta: 'Escolta', asalto: 'Asalto', caza: 'Caza' };

const factoryLoadout = (unitTypeId: string): { weapons: string[]; slots: Record<string, string> } =>
  ({ weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])], slots: {} });

function loadCampaign(): CampaignState | null {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as CampaignState;
    if (!Array.isArray(state.roster) || typeof state.credits !== 'number') return null;
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
  $('merc-status').textContent =
    `⌾ ${campaign.credits} créditos · contratos completados: ${campaign.contractsDone}`;
  renderContracts();
  renderMercHangar();
  renderMercStore();
  const anyAlive = campaign.roster.some((z) => !z.destroyed);
  ($('merc-deploy') as HTMLButtonElement).disabled = !selectedContractId || !anyAlive;
}

function renderContracts(): void {
  const host = $('contracts');
  host.innerHTML = '';
  const offers = contractOffers(campaign!.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL);
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
      `<div class="ghead-row"><span class="gtag">P${slot + 1}${slot === 0 ? ' ★' : ''}</span>` +
      `<b style="font-family:var(--mono);font-size:13px">${def.name}</b></div>` +
      `<div class="gtracks">${escapeHtml(pilot.name)} · ${pilotSummary(pilot)}</div>`;

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
    chassisSelect.addEventListener('change', () => {
      if (!chassisSelect.value) return;
      campaign = buyZoid(campaign!, slot, chassisSelect.value, maxHp, ECONOMY, factoryLoadout);
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

      // Módulos por slot del frame (recambios gratis en esta rebanada).
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

/** Despliega el contrato seleccionado con los Zoids operativos. */
function deployContract(): void {
  if (!campaign || !selectedContractId) return;
  const offers = contractOffers(campaign.contractsDone, ECONOMY, CONTRACT_ENEMY_POOL);
  const contract = offers.find((c) => c.id === selectedContractId);
  if (!contract) return;
  const alive = campaign.roster
    .map((zoid, slot) => ({ zoid, slot }))
    .filter(({ zoid }) => !zoid.destroyed);
  if (alive.length === 0) return;

  const spawns: UnitSpawn[] = [
    ...alive.map(({ zoid, slot }, k) => ({
      id: `P${slot + 1}`,
      name: ZOIDS[zoid.unitTypeId]!.name,
      unitTypeId: zoid.unitTypeId,
      team: 'player' as Team,
      position: PLAYER_POSITIONS[k]!,
      hp: zoid.hp,
      loadout: {
        weapons: [...zoid.weapons],
        ...(Object.keys(zoid.slots).length > 0 ? { slots: { ...zoid.slots } } : {}),
      },
      ...(k === 0 ? { commander: true } : {}),
    })),
    ...contract.enemySquad.map((unitTypeId, i) => ({
      id: `E${i + 1}`,
      name: ZOIDS[unitTypeId]!.name,
      unitTypeId,
      team: 'enemy' as Team,
      position: ENEMY_POSITIONS[i]!,
      ...(i === 0 ? { commander: true } : {}),
    })),
  ];

  deployedSlots = alive.map(({ slot }) => slot);
  activeContract = contract;
  returnToMerc = false;
  closeMerc();
  // Semilla distinta por ciclo de contratos: reproducible, no farmeable.
  const seed = (Number(($('seed') as HTMLInputElement).value) || 42) + campaign.contractsDone * 1009;
  const weather = ($('weather') as HTMLSelectElement).value as WeatherId;
  startBattle(spawns, seed, weather);
}

/** Liquida el contrato al terminar la batalla; devuelve el HTML del parte. */
function settleContract(): string {
  const contract = activeContract!;
  activeContract = null;
  returnToMerc = true;
  const finalHp = campaign!.roster.map((_, slot) =>
    deployedSlots.includes(slot) ? battle.unit(`P${slot + 1}`).hp : undefined);
  const enemiesDestroyed = battle.units.filter((u) => u.team === 'enemy' && u.hp <= 0).length;
  const { state, report } = resolveContract(campaign!, contract, {
    winner: battle.winner,
    finalHp,
    enemiesDestroyed,
  });
  campaign = state;
  saveCampaign();

  const lines = [
    `<div><b>${contract.name}</b> — ${TIER_LABEL[contract.tier]}</div>`,
    `<div class="mgain">+⌾${report.creditsEarned} (${report.rewardPaid ? `recompensa ⌾${contract.reward} + ` : 'sin recompensa · '}chatarra ⌾${report.salvage})</div>`,
  ];
  if (report.lost.length > 0) {
    lines.push(`<div class="mloss">bajas: ${report.lost.map((id) => ZOIDS[id]!.name).join(', ')} — reconstruir cuesta el 60%</div>`);
  }
  lines.push(`<div class="pv-muted" style="color:var(--muted)">saldo: ⌾${campaign.credits}</div>`);
  return lines.join('');
}

// ── Arranque ─────────────────────────────────────────────────────────────

function restart(): void {
  if (returnToMerc && campaign) {
    // La batalla de contrato ya se liquidó: "Nueva batalla" vuelve al
    // cuartel para reparar, comprar y elegir el siguiente contrato.
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
$('merc-btn').addEventListener('click', openMerc);
$('merc-deploy').addEventListener('click', deployContract);
$('merc-skirmish').addEventListener('click', () => { closeMerc(); openGarage(); });
$('merc-reset').addEventListener('click', () => {
  if (!window.confirm('¿Empezar una campaña nueva? Se pierden créditos, hangar y arsenal (los pilotos se conservan).')) return;
  campaign = newCampaign(ECONOMY, factoryLoadout);
  selectedContractId = null;
  saveCampaign();
  renderMerc();
});
restart();
// El primer contacto: la campaña si existe; si no, el garaje libre.
if (campaign) openMerc();
else openGarage();
