/**
 * Balance del hangar completo: enfrenta equipos ALEATORIOS (deterministas
 * por semilla) de 4 Zoids por bando, sobre el valle, IA contra IA, y
 * agrega métricas por chasis y por arma para detectar outliers.
 *
 *   npm run balance:hangar            (300 batallas)
 *   npm run balance:hangar -- 1000    (las que quieras)
 *
 * La tasa de victoria por chasis mezcla el efecto de sus compañeros de
 * equipo, pero con suficientes batallas converge: sirve para señalar
 * outliers, no para ordenar el meta con decimales.
 */
import { planTurn } from '../src/ai/simpleAi.js';
import { Battle, type UnitSpawn } from '../src/core/battle.js';
import type { Team } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { VALLEY_CROSSING } from '../src/data/maps.js';
import { MODULES } from '../src/data/modules.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

const CATALOGS = withWeaponLibrary(ABILITIES, WEAPONS);
const battles = Number(process.argv[2] ?? 300);
const MAX_TURNS = 300;

/** mulberry32 local: el muestreo de equipos es reproducible por semilla. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Solo chasis PILOTABLES: fuera las unidades de escenario — bestias 2×2
// (no caben en los spawns del flanco) y el carguero inmóvil (speed 0). No
// son combatientes que se compren ni se balanceen.
const POOL = Object.keys(ZOIDS).filter((id) => {
  const z = ZOIDS[id]!;
  return (z.size ?? 1) === 1 && z.stats.speed > 0;
});

function pickTeam(rand: () => number): string[] {
  const pool = [...POOL];
  const team: string[] = [];
  for (let i = 0; i < 4; i++) {
    team.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
  }
  return team;
}

interface ZoidAggregate {
  games: number; wins: number; draws: number; destroyed: number;
  damage: number; kills: number;
}
interface WeaponAggregate { carried: number; uses: number; damage: number }

const zoids = new Map<string, ZoidAggregate>();
const weaponStats = new Map<string, WeaponAggregate>();

const zoidAgg = (id: string): ZoidAggregate => {
  let agg = zoids.get(id);
  if (!agg) { agg = { games: 0, wins: 0, draws: 0, destroyed: 0, damage: 0, kills: 0 }; zoids.set(id, agg); }
  return agg;
};
const weaponAgg = (id: string): WeaponAggregate => {
  let agg = weaponStats.get(id);
  if (!agg) { agg = { carried: 0, uses: 0, damage: 0 }; weaponStats.set(id, agg); }
  return agg;
};

let draws = 0;
let totalTurns = 0;

const PLAYER_POS = [{ x: 1, y: 3 }, { x: 0, y: 5 }, { x: 1, y: 7 }, { x: 0, y: 4 }];
const ENEMY_POS = [{ x: 10, y: 3 }, { x: 11, y: 5 }, { x: 10, y: 6 }, { x: 11, y: 2 }];

for (let seed = 1; seed <= battles; seed++) {
  const rand = mulberry32(seed * 2654435761);
  const teams: Record<Team, string[]> = { player: pickTeam(rand), enemy: pickTeam(rand) };
  const spawns: UnitSpawn[] = [
    ...teams.player.map((unitTypeId, i): UnitSpawn => ({
      id: `P${i + 1}`, name: unitTypeId, unitTypeId, team: 'player', position: PLAYER_POS[i]!,
    })),
    ...teams.enemy.map((unitTypeId, i): UnitSpawn => ({
      id: `E${i + 1}`, name: unitTypeId, unitTypeId, team: 'enemy', position: ENEMY_POS[i]!,
    })),
  ];

  const battle = new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog,
    moduleCatalog: MODULES,
    weaponCatalog: CATALOGS.weaponCatalog,
    seed,
    spawns,
  });

  const typeOf = new Map(spawns.map((s) => [s.id, s.unitTypeId]));
  // Atribución por unidad: una habilidad solo cuenta para el arma si la
  // unidad la porta (la misma habilidad puede ser innata en otro chasis).
  const weaponOfAbility = new Map<string, Map<string, string>>();
  for (const spawn of spawns) {
    zoidAgg(spawn.unitTypeId).games++;
    const byAbility = new Map<string, string>();
    for (const weaponId of ZOIDS[spawn.unitTypeId]!.weapons ?? []) {
      weaponAgg(weaponId).carried++;
      byAbility.set(CATALOGS.weaponCatalog[weaponId]!.abilityId, weaponId);
    }
    weaponOfAbility.set(spawn.id, byAbility);
  }

  /** Última habilidad usada por unidad: atribuye el daño posterior. */
  const lastAbility = new Map<string, string>();
  let lastAttacker: string | undefined;
  let turns = 0;
  while (!battle.isOver && turns < MAX_TURNS) {
    const events = battle.nextTurn();
    const active = battle.getActiveUnit();
    turns++;
    const handle = (batch: typeof events): void => {
      for (const event of batch) {
        if (event.type === 'ability-used') {
          lastAbility.set(event.unitId, event.abilityId);
          lastAttacker = event.unitId;
          const weaponId = weaponOfAbility.get(event.unitId)?.get(event.abilityId);
          if (weaponId) weaponAgg(weaponId).uses++;
        } else if (event.type === 'damage-dealt') {
          zoidAgg(typeOf.get(event.unitId)!).damage += event.amount;
          const weaponId = weaponOfAbility.get(event.unitId)?.get(lastAbility.get(event.unitId) ?? '');
          if (weaponId) weaponAgg(weaponId).damage += event.amount;
        } else if (event.type === 'unit-destroyed') {
          if (lastAttacker && lastAttacker !== event.unitId) {
            zoidAgg(typeOf.get(lastAttacker)!).kills++;
          }
        }
      }
    };
    handle(events);
    if (!active) break;
    for (const action of planTurn(battle, active)) {
      // Un contraataque letal puede cerrar el turno del actor a mitad de su
      // plan: el resto de acciones muere con él (mismo guard que scriptedBattle).
      if (battle.isOver || battle.getActiveUnit()?.id !== active.id) break;
      handle(battle.execute(action));
    }
  }

  totalTurns += turns;
  const winner = battle.winner;
  if (!winner) draws++;
  for (const spawn of spawns) {
    const agg = zoidAgg(spawn.unitTypeId);
    if (!winner) agg.draws++;
    else if (winner === spawn.team) agg.wins++;
    const unit = battle.units.find((u) => u.id === spawn.id)!;
    if (unit.hp <= 0) agg.destroyed++;
  }
}

// ── Informe ──────────────────────────────────────────────────────────────

console.log(`\n═══ Balance del hangar: ${battles} batallas 4v4 aleatorias (${POOL.length} chasis) ═══\n`);
console.log(`turnos medios: ${(totalTurns / battles).toFixed(1)}   empates por límite de turnos: ${draws} (${((draws / battles) * 100).toFixed(1)}%)\n`);

console.log('chasis                 partidas   %victoria   %muere   daño/p   kills/p');
const rows = [...zoids.entries()].sort((a, b) => {
  const rateA = a[1].wins / Math.max(1, a[1].games - a[1].draws);
  const rateB = b[1].wins / Math.max(1, b[1].games - b[1].draws);
  return rateB - rateA;
});
for (const [id, agg] of rows) {
  const decided = Math.max(1, agg.games - agg.draws);
  const winRate = (agg.wins / decided) * 100;
  const flag = agg.games >= 20 && (winRate >= 58 ? ' ◄ FUERTE' : winRate <= 42 ? ' ◄ DÉBIL' : '');
  console.log(
    `${id.padEnd(24)} ${String(agg.games).padStart(5)}   ` +
    `${winRate.toFixed(1).padStart(8)}%   ${((agg.destroyed / agg.games) * 100).toFixed(0).padStart(5)}%   ` +
    `${(agg.damage / agg.games).toFixed(1).padStart(6)}   ${(agg.kills / agg.games).toFixed(2).padStart(6)}${flag}`,
  );
}

console.log('\narma                          portada   disparos/p   daño/uso');
const weaponRows = [...weaponStats.entries()].sort((a, b) => b[1].uses / Math.max(1, b[1].carried) - a[1].uses / Math.max(1, a[1].carried));
for (const [id, agg] of weaponRows) {
  const name = CATALOGS.weaponCatalog[id]!.name;
  const flag = agg.carried >= 15 && agg.uses === 0 ? ' ◄ NUNCA DISPARADA' : '';
  console.log(
    `${name.padEnd(30)} ${String(agg.carried).padStart(5)}   ` +
    `${(agg.uses / Math.max(1, agg.carried)).toFixed(2).padStart(8)}   ` +
    `${(agg.damage / Math.max(1, agg.uses)).toFixed(1).padStart(8)}${flag}`,
  );
}
console.log('\nNota: %victoria = batallas decididas ganadas por el equipo del chasis.');
console.log('Umbral de outlier: ≥58% fuerte, ≤42% débil (con ≥20 partidas).');
