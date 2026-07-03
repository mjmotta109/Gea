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
import { ZOIDS } from '../data/zoids.js';
import { planTurn } from '../ai/simpleAi.js';
import { STATUS_INFO } from '../core/status.js';

const auto = process.argv.includes('--auto');
const seed = Number(process.env.SEED ?? 20260703);

const battle = new Battle({
  map: VALLEY_CROSSING,
  unitCatalog: ZOIDS,
  abilityCatalog: ABILITIES,
  seed,
  spawns: [
    { id: 'P1', name: 'Liger Zero (Bit)', unitTypeId: 'liger-zero', team: 'player', position: { x: 1, y: 3 } },
    { id: 'P2', name: 'Command Wolf (Irvine)', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 5 } },
    { id: 'P3', name: 'Gun Sniper (Naomi)', unitTypeId: 'gun-sniper', team: 'player', position: { x: 1, y: 7 } },
    { id: 'P4', name: 'Gustav (Moonbay)', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 4 } },
    { id: 'E1', name: 'Geno Saurer', unitTypeId: 'geno-saurer', team: 'enemy', position: { x: 10, y: 3 } },
    { id: 'E2', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 11, y: 5 } },
    { id: 'E3', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 6 } },
    { id: 'E4', name: 'Pteras', unitTypeId: 'pteras', team: 'enemy', position: { x: 11, y: 2 } },
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
      return `  [${u.team === 'player' ? 'P' : 'E'}] ${u.id} ${u.name}: ${state}${statuses ? ` (${statuses})` : ''}`;
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
