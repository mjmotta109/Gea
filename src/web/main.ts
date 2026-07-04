/**
 * Cliente web jugable del motor: tú controlas al equipo jugador con clics
 * y la IA de sparring lleva al enemigo. Consume la misma API pública que
 * cualquier otro renderer (Battle + BattleEvent), sin tocar el core.
 *
 * Build: npm run web  →  dist/web/gea.html (autocontenido).
 */
import { planTurn } from '../ai/simpleAi.js';
import { Battle } from '../core/battle.js';
import { attackArc, hitChance } from '../core/combat.js';
import { posKey } from '../core/grid.js';
import { reachableTiles } from '../core/pathfinding.js';
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
  | { kind: 'move' }
  | { kind: 'boost' }
  | { kind: 'ability'; abilityId: string };

let battle: Battle;
let mode: Mode = { kind: 'idle' };
/** Casillas resaltadas para el modo actual: clase CSS + etiqueta opcional. */
let highlights = new Map<string, { cls: string; label?: string }>();
/** true mientras la IA enemiga anima su turno: bloquea la entrada. */
let busy = false;

const $ = (id: string): HTMLElement => document.getElementById(id)!;

const FACING_ARROW: Record<Facing, string> = { north: '▲', east: '▶', south: '▼', west: '◀' };

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
  highlights.clear();
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
  renderAll();
  if (!active) return;
  if (active.team === 'enemy') {
    runEnemyTurn(active);
  } else {
    mode = { kind: 'idle' };
    highlights.clear();
    renderAll();
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
    window.setTimeout(step, 360);
  };
  window.setTimeout(step, 360);
}

// ── Acciones del jugador ─────────────────────────────────────────────────

function playerUnit(): UnitState | undefined {
  const active = battle.getActiveUnit();
  return active && active.team === 'player' && !busy ? active : undefined;
}

function enterMove(): void {
  const unit = playerUnit();
  if (!unit) return;
  mode = { kind: 'move' };
  highlights.clear();
  for (const tile of battle.legalMoves(unit.id)) {
    highlights.set(posKey(tile.pos), { cls: 'hl-move' });
  }
  renderAll();
}

function enterBoost(): void {
  const unit = playerUnit();
  if (!unit) return;
  mode = { kind: 'boost' };
  highlights.clear();
  const stats = battle.effectiveStats(unit);
  const tiles = reachableTiles(battle.map, unit.position, {
    move: Math.max(1, Math.ceil(stats.move / 2)),
    jump: stats.jump,
    moveType: battle.definitionOf(unit.unitTypeId).moveType,
    team: unit.team,
  }, battle.units);
  for (const tile of tiles) {
    if (tile.pos.x === unit.position.x && tile.pos.y === unit.position.y) continue;
    highlights.set(posKey(tile.pos), { cls: 'hl-boost' });
  }
  renderAll();
}

function enterAbility(abilityId: string): void {
  const unit = playerUnit();
  if (!unit) return;
  mode = { kind: 'ability', abilityId };
  highlights.clear();
  const ability = battle.abilityOf(abilityId);
  const stats = battle.effectiveStats(unit);
  const damaging = ability.effects.some((e) => e.kind === 'damage');
  for (const pos of battle.legalTargets(unit.id, abilityId)) {
    const target = battle.unitAt(pos);
    let label: string | undefined;
    if (target && target.team !== unit.team && damaging) {
      const arc = attackArc(unit.position, target.position, target.facing);
      const chance = hitChance({
        accuracy: ability.accuracy,
        attackerAccuracy: stats.accuracy,
        arc,
        defenderEvade: battle.effectiveStats(target).evade,
      });
      label = `${chance}%`;
    } else if (target && target.team === unit.team && ability.targetsAllies) {
      label = '✚';
    }
    highlights.set(posKey(pos), { cls: 'hl-target', label });
  }
  renderAll();
}

function onTileClick(pos: Position): void {
  const unit = playerUnit();
  if (!unit || mode.kind === 'idle') return;
  if (!highlights.has(posKey(pos))) return;

  try {
    if (mode.kind === 'move') {
      logEvents(battle.execute({ type: 'move', unitId: unit.id, to: pos }));
    } else if (mode.kind === 'boost') {
      logEvents(battle.execute({ type: 'boost', unitId: unit.id, to: pos }));
    } else {
      logEvents(battle.execute({ type: 'ability', unitId: unit.id, abilityId: mode.abilityId, target: pos }));
    }
  } catch (error) {
    log(`⚠ ${(error as Error).message}`, 'warn');
  }
  mode = { kind: 'idle' };
  highlights.clear();
  if (battle.isOver) { renderAll(); showOverlay(); return; }
  renderAll();
}

function doReload(weaponId: string): void {
  const unit = playerUnit();
  if (!unit) return;
  try {
    logEvents(battle.execute({ type: 'reload', unitId: unit.id, weaponId }));
  } catch (error) {
    log(`⚠ ${(error as Error).message}`, 'warn');
  }
  mode = { kind: 'idle' };
  highlights.clear();
  renderAll();
}

function doWait(facing?: Facing): void {
  const unit = playerUnit();
  if (!unit) return;
  logEvents(battle.execute({ type: 'wait', unitId: unit.id, facing }));
  mode = { kind: 'idle' };
  highlights.clear();
  advance();
}

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

function renderBoard(): void {
  const board = $('board');
  board.style.gridTemplateColumns = `repeat(${battle.map.width}, 46px)`;
  board.innerHTML = '';
  const active = battle.getActiveUnit();

  for (let y = 0; y < battle.map.height; y++) {
    for (let x = 0; x < battle.map.width; x++) {
      const pos = { x, y };
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

      const hl = highlights.get(posKey(pos));
      if (hl) {
        cell.classList.add(hl.cls, 'actionable');
        if (hl.label) {
          const label = document.createElement('span');
          label.className = 'hl-label';
          label.textContent = hl.label;
          cell.appendChild(label);
        }
      }

      const unit = battle.unitAt(pos);
      if (unit) {
        const chip = document.createElement('div');
        chip.className = `chip ${unit.team}`;
        if (active?.id === unit.id) chip.classList.add('active-unit');
        chip.innerHTML = `<span>${unit.id}${FACING_ARROW[unit.facing]}</span>`;
        const bar = document.createElement('div');
        bar.className = 'hpbar';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round((unit.hp / battle.effectiveStats(unit).maxHp) * 100)}%`;
        bar.appendChild(fill);
        chip.appendChild(bar);
        cell.appendChild(chip);
      }

      cell.addEventListener('click', () => onTileClick(pos));
      board.appendChild(cell);
    }
  }
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

function renderCommand(): void {
  const el = $('command');
  el.innerHTML = '';
  const unit = playerUnit();

  if (!unit) {
    const active = battle.getActiveUnit();
    el.innerHTML = `<div class="hint">${busy || active ? 'Turno enemigo en curso...' : 'Resolviendo...'}</div>`;
    return;
  }

  const mkRow = (): HTMLDivElement => {
    const row = document.createElement('div');
    row.className = 'row';
    el.appendChild(row);
    return row;
  };
  const mkBtn = (
    row: HTMLElement, text: string, onClick: () => void,
    opts: { disabled?: boolean; title?: string; on?: boolean } = {},
  ): void => {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.disabled = Boolean(opts.disabled);
    if (opts.title) btn.title = opts.title;
    if (opts.on) btn.classList.add('mode-on');
    btn.addEventListener('click', onClick);
    row.appendChild(btn);
  };

  const title = document.createElement('div');
  title.className = 'hint';
  title.style.marginBottom = '6px';
  title.textContent = `Turno de ${unit.id} ${unit.name}`;
  el.appendChild(title);

  // Movimiento y boost.
  const moveRow = mkRow();
  const moveVeto = battle.checkVetoes({ type: 'move', unitId: unit.id, to: unit.position });
  mkBtn(moveRow, 'Mover', enterMove, {
    disabled: unit.hasMoved || moveVeto !== null,
    title: moveVeto?.reason ?? (unit.hasMoved ? 'ya se movió' : undefined),
    on: mode.kind === 'move',
  });
  if (unit.components.energy) {
    const boostVeto = battle.checkVetoes({ type: 'boost', unitId: unit.id, to: unit.position });
    mkBtn(moveRow, 'Boost ⚡20', enterBoost, {
      disabled: unit.components.energy.boostedThisTurn || boostVeto !== null,
      title: boostVeto?.reason ?? (unit.components.energy.boostedThisTurn ? 'ya hizo boost' : undefined),
      on: mode.kind === 'boost',
    });
  }

  // Habilidades y armas.
  const abilityRow = mkRow();
  for (const abilityId of battle.knownAbilityIds(unit)) {
    const ability = battle.abilityOf(abilityId);
    const veto = battle.checkVetoes({ type: 'ability', unitId: unit.id, abilityId, target: unit.position });
    const entry = battle.weaponEntry(unit, abilityId);
    const cost = entry?.def.costs;
    const costText = [
      cost?.energy ? `⚡${cost.energy}` : '',
      cost?.heat ? `🔥${cost.heat}` : '',
      entry && entry.def.magazine > 0 ? `${entry.state.ammo}/${entry.def.magazine}` : '',
    ].filter(Boolean).join(' ');
    mkBtn(abilityRow, costText ? `${ability.name} ${costText}` : ability.name, () => enterAbility(abilityId), {
      disabled: unit.hasActed || veto !== null,
      title: veto?.reason ?? (unit.hasActed ? 'ya actuó' : ability.description),
      on: mode.kind === 'ability' && mode.abilityId === abilityId,
    });
  }

  // Recargas disponibles.
  const reloadable = unit.components.arsenal?.weapons.filter((w) => {
    const def = battle.weaponOf(w.weaponId);
    return def.magazine > 0 && w.ammo < def.magazine && w.reserves > 0;
  }) ?? [];
  if (reloadable.length > 0) {
    const row = mkRow();
    for (const weapon of reloadable) {
      mkBtn(row, `Recargar ${battle.weaponOf(weapon.weaponId).name} (+${weapon.reserves})`,
        () => doReload(weapon.weaponId), { disabled: unit.hasActed });
    }
  }

  // Esperar, con orientación opcional.
  const waitRow = mkRow();
  mkBtn(waitRow, 'Esperar', () => doWait());
  for (const facing of ['north', 'east', 'south', 'west'] as Facing[]) {
    mkBtn(waitRow, FACING_ARROW[facing], () => doWait(facing), { title: `esperar mirando al ${facing}` });
  }

  const hint = document.createElement('div');
  hint.className = 'hint';
  hint.textContent = mode.kind === 'idle'
    ? 'Elige una orden; mover y actuar, en cualquier orden. Terminar sin gastar todo devuelve CT.'
    : 'Pulsa una casilla resaltada (o elige otra orden).';
  el.appendChild(hint);
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
  renderBoard();
  renderForecast();
  renderCommand();
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
  ($('ov-title').style as CSSStyleDeclaration).color = won ? 'var(--player)' : 'var(--enemy)';
  $('ov-sub').textContent = won
    ? 'El equipo cian controla el valle.'
    : 'Tus Zoids quedan fuera de combate.';
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
