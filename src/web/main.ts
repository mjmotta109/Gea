/**
 * Cliente web jugable del motor, con flujo estilo XCOM:
 * seleccionar → previsualizar → confirmar, manejable por completo con
 * teclado (WASD/flechas + E/Enter) o ratón sobre el mismo cursor.
 *
 * Consume solo la API pública del motor (Battle + BattleEvent).
 * Build: npm run web  →  dist/web/gea.html (autocontenido).
 */
import { planTurn } from '../ai/simpleAi.js';
import { Battle } from '../core/battle.js';
import { attackArc, damageRange, hitChance, type AttackArc } from '../core/combat.js';
import { posKey, terrainLabel } from '../core/grid.js';
import { reachableTiles, type ReachableTile } from '../core/pathfinding.js';
import { STATUS_DEFINITIONS } from '../core/status.js';
import type { BattleEvent, Facing, Position, UnitState } from '../core/types.js';
import { ABILITIES } from '../data/abilities.js';
import { VALLEY_CROSSING } from '../data/maps.js';
import { MODULES } from '../data/modules.js';
import { WEAPONS } from '../data/weapons.js';
import { ZOIDS } from '../data/zoids.js';

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

const $ = (id: string): HTMLElement => document.getElementById(id)!;

const FACING_ARROW: Record<Facing, string> = { north: '▲', east: '▶', south: '▼', west: '◀' };
const ARC_LABEL: Record<AttackArc, string> = { front: 'FRENTE', side: 'FLANCO', back: 'ESPALDA' };
const FACING_OFFSET: Record<Facing, Position> = {
  north: { x: 0, y: -1 }, east: { x: 1, y: 0 }, south: { x: 0, y: 1 }, west: { x: -1, y: 0 },
};

function newBattle(seed: number): void {
  battle = new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed,
    spawns: [
      { id: 'P1', name: 'Liger Zero CAS', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 1, y: 3 } },
      { id: 'P2', name: 'Command Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 5 } },
      { id: 'P3', name: 'Gun Sniper', unitTypeId: 'gun-sniper-naomi', team: 'player', position: { x: 1, y: 7 } },
      { id: 'P4', name: 'Gustav', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 4 } },
      { id: 'E1', name: 'Geno Saurer CP', unitTypeId: 'geno-saurer-cp', team: 'enemy', position: { x: 10, y: 3 } },
      { id: 'E2', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 11, y: 5 } },
      { id: 'E3', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 6 } },
      { id: 'E4', name: 'Pteras', unitTypeId: 'pteras', team: 'enemy', position: { x: 11, y: 2 } },
    ],
  });
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
    const usable = abilities.filter((ability) => {
      const dist = Math.abs(from.x - enemy.position.x) + Math.abs(from.y - enemy.position.y);
      if (dist < ability.minRange || dist > ability.range) return false;
      if (ability.shape === 'line' && from.x !== enemy.position.x && from.y !== enemy.position.y) return false;
      return true;
    });
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

/** % de impacto (o ✚ para aliados) mostrado sobre un objetivo. */
function targetLabel(unit: UnitState | undefined, pos: Position): string | undefined {
  if (!unit || mode.kind !== 'ability') return undefined;
  const target = battle.unitAt(pos);
  if (!target) return undefined;
  const ability = battle.abilityOf(mode.abilityId);
  if (target.team === unit.team) return ability.targetsAllies ? '✚' : undefined;
  if (!ability.effects.some((e) => e.kind === 'damage')) return undefined;
  const arc = attackArc(unit.position, target.position, target.facing);
  const chance = hitChance({
    accuracy: ability.accuracy,
    attackerAccuracy: battle.effectiveStats(unit).accuracy,
    arc,
    defenderEvade: battle.effectiveStats(target).evade,
  });
  return `${chance}%`;
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
    const damaging = ability.effects.find((e) => e.kind === 'damage');
    if (damaging && damaging.kind === 'damage' && occupant.team !== unit.team) {
      const userStats = battle.effectiveStats(unit);
      const targetStats = battle.effectiveStats(occupant);
      const arc = attackArc(unit.position, occupant.position, occupant.facing);
      const heightAdvantage = battle.map.tileAt(unit.position).height - tile.height;
      const chance = hitChance({
        accuracy: ability.accuracy, attackerAccuracy: userStats.accuracy,
        arc, defenderEvade: targetStats.evade,
      });
      const range = damageRange({
        attackerStats: userStats, defenderStats: targetStats,
        power: damaging.power, damageType: damaging.damageType,
        arc, heightAdvantage,
      });
      lines.push(`<div class="pv-title">${ability.name} → ${occupant.id} ${occupant.name}</div>`);
      lines.push(`<div>impacto <b>${chance}%</b> · daño <b>${range.min}–${range.max}</b> · arco <b class="${arc === 'back' ? 'pv-good' : arc === 'side' ? 'pv-warn' : ''}">${ARC_LABEL[arc]}</b>${heightAdvantage !== 0 ? ` · altura ${heightAdvantage > 0 ? '+' : ''}${heightAdvantage}` : ''}</div>`);
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
  lines.push(`<div class="pv-muted">(${cursor.x},${cursor.y}) · ${terrainLabel(tile.terrain)} · altura ${tile.height}</div>`);
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
    name.innerHTML = `<span class="tag">${unit.id}</span> ${unit.name}` +
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
    case 'ability-used': return { text: `${event.unitId} usa ${ABILITIES[event.abilityId]!.name}` };
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
  for (const event of events) {
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
  $('overlay').classList.add('show');
}

// ── Arranque ─────────────────────────────────────────────────────────────

function restart(): void {
  const seed = Number(($('seed') as HTMLInputElement).value) || 42;
  newBattle(seed);
}

$('restart').addEventListener('click', restart);
$('ov-restart').addEventListener('click', restart);
restart();
