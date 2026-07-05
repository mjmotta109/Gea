/**
 * Herramienta de balance por lotes: simula N batallas IA-vs-IA con
 * semillas consecutivas sobre el escenario estándar del valle y agrega
 * métricas. El determinismo del motor hace el experimento reproducible.
 *
 *   npm run balance            (200 batallas)
 *   npm run balance -- 1000    (las que quieras)
 */
import { runScriptedBattle } from '../tests/helpers/scriptedBattle.js';

const battles = Number(process.argv[2] ?? 200);

interface UnitAggregate {
  name: string;
  team: string;
  damageDealt: number;
  destroyed: number;
  survivedWins: number;
}

const units = new Map<string, UnitAggregate>();
let playerWins = 0;
let enemyWins = 0;
let totalTurns = 0;
let shutdowns = 0;

for (let seed = 1; seed <= battles; seed++) {
  const record = runScriptedBattle(seed);
  if (record.winner === 'player') playerWins++;
  else if (record.winner === 'enemy') enemyWins++;
  totalTurns += record.turns;

  for (const final of record.finalUnits) {
    if (!units.has(final.id)) {
      units.set(final.id, {
        name: final.id,
        team: final.id.startsWith('P') ? 'jugador' : 'enemigo',
        damageDealt: 0,
        destroyed: 0,
        survivedWins: 0,
      });
    }
    const agg = units.get(final.id)!;
    if (final.hp <= 0) agg.destroyed++;
    else if (record.winner === (final.id.startsWith('P') ? 'player' : 'enemy')) agg.survivedWins++;
  }

  for (const event of record.events) {
    if (event.type === 'damage-dealt') {
      units.get(event.unitId)!.damageDealt += event.amount;
    }
    if (event.type === 'unit-shutdown') shutdowns++;
  }
}

const pct = (n: number): string => `${((n / battles) * 100).toFixed(1)}%`;

console.log(`\n═══ Balance: ${battles} batallas en el valle (semillas 1-${battles}) ═══\n`);
console.log(`victorias jugador: ${playerWins} (${pct(playerWins)})   enemigo: ${enemyWins} (${pct(enemyWins)})`);
console.log(`turnos medios por batalla: ${(totalTurns / battles).toFixed(1)}   apagados térmicos: ${shutdowns}\n`);

console.log('unidad          equipo    daño medio   muere      sobrevive y gana');
for (const [id, agg] of [...units.entries()].sort()) {
  console.log(
    `${id.padEnd(3)} ${''.padEnd(11)} ${agg.team.padEnd(9)} ` +
    `${(agg.damageDealt / battles).toFixed(1).padStart(8)}   ` +
    `${pct(agg.destroyed).padStart(6)}   ${pct(agg.survivedWins).padStart(6)}`,
  );
}
console.log('\nRoster: P1 Liger Zero · P2 Command Wolf · P3 Gun Sniper · P4 Gustav');
console.log('        E1 Geno Saurer · E2/E3 Molga · E4 Pteras');
