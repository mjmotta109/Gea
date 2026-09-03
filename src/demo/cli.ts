/**
 * Demo de terminal: una escaramuza IA-vs-IA sobre el mapa del valle que
 * imprime el tablero y el log de eventos turno a turno. Sirve para ver el
 * motor funcionando de punta a punta sin ningún renderer.
 *
 *   npm run demo          — pausa entre turnos (pulsa Enter)
 *   npm run demo:auto     — corre la batalla entera de un tirón
 */
import readline from 'node:readline';
import { Battle } from '../core/battle.js';
import type { BattleEvent, UnitState } from '../core/types.js';
import { ABILITIES } from '../data/abilities.js';
import { VALLEY_CROSSING } from '../data/maps.js';
import { MODULES } from '../data/modules.js';
import { WEAPONS } from '../data/weapons.js';
import { ZOIDS } from '../data/zoids.js';
import { planTurn } from '../ai/simpleAi.js';
import { STATUS_INFO } from '../core/status.js';

const auto = process.argv.includes('--auto');
// La 42 luce especialmente bien el daño localizado: garras y tren
// delantero del Liger, y cañón/cabeza/piernas del Geno, caen por partes.
// La 30 (SEED=30 npm run demo:auto) luce la gestión de recursos: recarga
// del rifle de Naomi, boost, y el cañón del Geno ciclando enfriamientos.
const seed = Number(process.env.SEED ?? 42);

const battle = new Battle({
  map: VALLEY_CROSSING,
  unitCatalog: ZOIDS,
  abilityCatalog: ABILITIES,
  moduleCatalog: MODULES,
  weaponCatalog: WEAPONS,
  seed,
  spawns: [
    // P1 y E1 usan las versiones framed: daño localizado por módulos.
    { id: 'P1', name: 'Zarpa Coraza (Bit)', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 1, y: 3 } },
    { id: 'P2', name: 'Batidor (Irvine)', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 5 } },
    { id: 'P3', name: 'Aguja (Naomi)', unitTypeId: 'gun-sniper-naomi', team: 'player', position: { x: 1, y: 7 } },
    { id: 'P4', name: 'Acémila (Moonbay)', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 4 } },
    { id: 'E1', name: 'Basilisco Ígneo', unitTypeId: 'geno-saurer-cp', team: 'enemy', position: { x: 10, y: 3 } },
    { id: 'E2', name: 'Oruga', unitTypeId: 'molga', team: 'enemy', position: { x: 11, y: 5 } },
    { id: 'E3', name: 'Oruga', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 6 } },
    { id: 'E4', name: 'Vigía', unitTypeId: 'pteras', team: 'enemy', position: { x: 11, y: 2 } },
  ],
});

function renderBoard(): string {
  const rows: string[] = [];
  const header = '    ' + Array.from({ length: battle.map.width }, (_, x) => String(x).padStart(2)).join('');
  rows.push(header);
  for (let y = 0; y < battle.map.height; y++) {
    let row = String(y).padStart(3) + ' ';
    for (let x = 0; x < battle.map.width; x++) {
      const unit = battle.unitAt({ x, y });
      if (unit) {
        row += ' ' + unit.id[0]!.toLowerCase() + unit.id[1];
        continue;
      }
      const tile = battle.map.tileAt({ x, y });
      const glyph = tile.terrain === 'wall' ? ' #'
        : tile.terrain === 'water' ? ' ~'
        : tile.terrain === 'rough' ? ' *'
        : tile.terrain === 'forest' ? ' ♣'
        : tile.height > 0 ? ' ' + String(tile.height) : ' .';
      row += glyph;
    }
    rows.push(row);
  }
  return rows.join('\n');
}

function renderUnits(): string {
  return battle.units
    .map((u) => {
      const zoid = battle.definitionOf(u.unitTypeId);
      const statuses = u.statuses.map((s) => STATUS_INFO[s.id].name).join(', ');
      const state = u.hp > 0 ? `${u.hp}/${zoid.stats.maxHp} HP` : 'DESTRUIDO';
      let line = `  [${u.team === 'player' ? 'P' : 'E'}] ${u.id} ${u.name}: ${state}${statuses ? ` (${statuses})` : ''}`;
      if (u.hp > 0) {
        const extras: string[] = [];
        const { energy, heat, arsenal, frame } = u.components;
        if (energy) extras.push(`⚡${energy.current}/${energy.capacity}`);
        if (heat) extras.push(`🔥${heat.current}/${heat.max}`);
        if (arsenal) {
          for (const w of arsenal.weapons) {
            const def = WEAPONS[w.weaponId]!;
            if (def.magazine > 0) extras.push(`${def.name}: ${w.ammo}/${def.magazine} (+${w.reserves})`);
            else if (w.cooldown > 0) extras.push(`${def.name}: enfriando ${w.cooldown}t`);
          }
        }
        if (extras.length > 0) line += `  ${extras.join('  ')}`;
        if (frame) {
          const parts = frame.modules
            .map((m) => (m.destroyed ? `✗${m.slot}` : `${m.slot} ${m.hp}`))
            .join(' | ');
          line += `\n        [${parts}]`;
        }
      }
      return line;
    })
    .join('\n');
}

function unitLabel(id: string): string {
  return `${id} ${battle.unit(id).name}`;
}

function describe(event: BattleEvent): string | undefined {
  switch (event.type) {
    case 'turn-started': return `── Turno de ${unitLabel(event.unitId)} ──`;
    case 'unit-moved': {
      const to = event.path[event.path.length - 1]!;
      return `${event.unitId} se mueve a (${to.x},${to.y})`;
    }
    case 'ability-used': return `${event.unitId} usa ${ABILITIES[event.abilityId]!.name}`;
    case 'ability-missed': return `  ...pero ${event.targetUnitId} lo esquiva!`;
    case 'damage-dealt': return `  ${event.targetUnitId} recibe ${event.amount} de daño (${event.targetHp} HP)`;
    case 'unit-healed': return `  ${event.targetUnitId} repara ${event.amount} (${event.targetHp} HP)`;
    case 'status-applied': return `  ${event.targetUnitId} sufre ${STATUS_INFO[event.status].name} (${event.duration}t)`;
    case 'status-expired': return `  ${STATUS_INFO[event.status].name} expira en ${event.targetUnitId}`;
    case 'status-ticked': return `  ${event.targetUnitId} pierde ${event.damage} HP por ${STATUS_INFO[event.status].name}`;
    case 'hit-location-rolled': return undefined; // el module-damaged siguiente ya lo cuenta
    case 'unit-boosted': {
      const to = event.path[event.path.length - 1]!;
      return `${event.unitId} hace BOOST hasta (${to.x},${to.y})`;
    }
    case 'energy-changed':
      return event.reason === 'boost' || event.reason === 'ability'
        ? `    ⚡ energía de ${event.unitId}: ${event.current} (${event.delta})`
        : undefined;
    case 'heat-changed':
      return event.delta > 0
        ? `    🔥 calor de ${event.unitId}: ${event.current} (+${event.delta})`
        : undefined;
    case 'weapon-reloaded': return `${event.unitId} recarga (${event.ammo} disparos)`;
    case 'unit-shutdown': return `  ⚠️ ${unitLabel(event.unitId)} sufre APAGADO DE EMERGENCIA (${event.damage} daño interno)`;
    case 'module-damaged': return `    → impacto en ${event.slot} (${event.moduleHp} HP del módulo)`;
    case 'module-destroyed': return `    💔 ${event.slot} de ${event.targetUnitId} DESTRUIDO`;
    case 'unit-destroyed': return `  💥 ${unitLabel(event.unitId)} queda fuera de combate!`;
    case 'battle-ended': return `\n★ Victoria del equipo ${event.winner === 'player' ? 'JUGADOR' : 'ENEMIGO'} ★`;
    case 'turn-ended': return undefined;
  }
}

function log(events: BattleEvent[]): void {
  for (const e of events) {
    const line = describe(e);
    if (line) console.log(line);
  }
}

async function pause(): Promise<void> {
  if (auto) return;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  await new Promise<void>((resolve) => rl.question('  [Enter para continuar] ', () => resolve()));
  rl.close();
}

async function main(): Promise<void> {
  console.log(`Semilla: ${seed}\n`);
  let turnCount = 0;
  const MAX_TURNS = 200;

  while (!battle.isOver && turnCount < MAX_TURNS) {
    log(battle.nextTurn());
    const active = battle.getActiveUnit();
    if (!active) break;

    turnCount++;
    for (const action of planTurn(battle, active)) {
      if (battle.isOver) break;
      log(battle.execute(action));
    }

    console.log('\n' + renderBoard());
    console.log('\n' + renderUnits() + '\n');
    if (!battle.isOver) await pause();
  }

  if (!battle.isOver) console.log(`Batalla detenida tras ${MAX_TURNS} turnos.`);
}

main();
