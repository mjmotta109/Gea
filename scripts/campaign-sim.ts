/**
 * Simulador de campaña: juega ~100 contratos seguidos para validar el ARCO —
 * ¿la curva de dificultad hace el arranque asequible y el final exigente pero
 * justo? ¿la adaptación de facción cambia la composición enemiga con el tiempo?
 *
 *   npx tsx scripts/campaign-sim.ts [contratos]   (100 por defecto)
 *
 * Un "jugador" competente (IA a tope, skill 1) enfrenta las escuadras que
 * genera la campaña (contractOffers) con el enemigo subiendo por la CURVA
 * (aiSkill = contratos/15 + desfase de dificultad) y ADAPTÁNDOSE al dosier del
 * jugador (contras por chasis desde skill 0.45, por arma desde 0.7). Cada
 * contrato es una pelea fresca (el jugador repara entre contratos). Reporta la
 * tasa de victoria y la evolución por decenas de contratos, por dificultad.
 */
import { planTurn } from '../src/ai/simpleAi.js';
import { Battle, type UnitSpawn } from '../src/core/battle.js';
import { ABILITIES } from '../src/data/abilities.js';
import { VALLEY_CROSSING } from '../src/data/maps.js';
import { MODULES } from '../src/data/modules.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';
import { CONTRACT_ENEMY_POOL, DIFFICULTIES, ECONOMY } from '../src/data/economy.js';
import {
  campaignStrength, contractOffers, counterRoles, counterWeapons, readStyle, updateDossier,
  type Contract, type Dossier,
} from '../src/game/mercenary.js';

const CATALOGS = withWeaponLibrary(ABILITIES, WEAPONS);
const N = Number(process.argv[2] ?? 100);
const MAX_TURNS = 300;

/**
 * MODOS (2º argumento):
 *  - `campaign` (por defecto): el ARCO REALISTA. El jugador MEJORA su roster por
 *    tramos (arranque → veterano → élite) y TOMA encargos acordes a su progreso
 *    (no caza de élite con chatarra). Es lo que vive un humano competente.
 *  - `meta`: roster de élite CONGELADO contra TODOS los tramos — prueba de esfuerzo
 *    del TECHO (¿aprieta el final aun con gran equipo?).
 *  - `frozen`: roster de arranque CONGELADO contra todos los tramos — el SUELO
 *    (peor caso: el jugador nunca invierte).
 */
// Un jugador real REINVIERTE la chatarra de forma continua; se modela con una
// escalera SUAVE (5 tramos) que mantiene el roster ~a la par del presupuesto
// enemigo, para que la lectura refleje la PRESIÓN de la curva (destreza +
// adaptación + desgaste) y no baches artificiales por saltos de roster.
const PLAYER_STAGES: Array<{ from: number; team: string[] }> = [
  { from: 0, team: ['liger-zero', 'command-wolf', 'gun-sniper', 'gustav'] },                    // arranque ~4450
  { from: 10, team: ['liger-zero-cas', 'command-wolf', 'gun-sniper-naomi', 'shield-liger'] },   // veterano ~5350
  { from: 22, team: ['blade-liger', 'liger-zero-cas', 'gun-sniper-naomi', 'iron-kong'] },       // curtido ~6000
  { from: 36, team: ['gojulas', 'blade-liger', 'gun-sniper-naomi', 'iron-kong'] },              // élite ~6400
  { from: 52, team: ['gojulas', 'konig-wolf', 'gun-sniper-naomi', 'geno-saurer'] },             // leyenda ~7200
];
const FROZEN_ROSTERS: Record<string, string[]> = {
  meta: ['gojulas', 'blade-liger', 'gun-sniper-naomi', 'iron-kong'],
  frozen: ['liger-zero', 'command-wolf', 'gun-sniper', 'gustav'],
};
const MODE = process.argv[3] ?? 'campaign';
/** Roster del jugador para este contrato (crece por tramos en `campaign`). */
function playerRosterFor(contractsDone: number): string[] {
  if (FROZEN_ROSTERS[MODE]) return FROZEN_ROSTERS[MODE]!;
  return [...PLAYER_STAGES].reverse().find((s) => contractsDone >= s.from)!.team;
}
/** Tramos de contrato que el jugador ACEPTA según su progreso (juego sensato):
 *  la caza de ÉLITE (presupuesto alto) solo cuando ya tiene roster para ella. */
function allowedTiers(contractsDone: number): string[] {
  if (FROZEN_ROSTERS[MODE]) return ['escolta', 'asalto', 'caza', 'incursion', 'defensa'];
  if (contractsDone < 10) return ['escolta', 'asalto'];
  if (contractsDone < 26) return ['escolta', 'asalto', 'incursion'];
  if (contractsDone < 44) return ['asalto', 'caza', 'incursion'];
  return ['asalto', 'caza', 'defensa', 'incursion'];
}
const PLAYER_POS = [{ x: 1, y: 3 }, { x: 0, y: 5 }, { x: 1, y: 7 }, { x: 0, y: 4 }];
const ENEMY_POS = [{ x: 10, y: 3 }, { x: 11, y: 5 }, { x: 10, y: 6 }, { x: 11, y: 2 }];

function aiSkillFor(contractsDone: number, aiCurve: number): number {
  return Math.max(0, Math.min(1, contractsDone / 25 + aiCurve));
}

/** Mismo sesgo de composición que el cliente (gated por la curva). */
function adaptiveWeight(dossier: Dossier | undefined, skill: number): ((id: string) => number) | undefined {
  if (skill < 0.45) return undefined;
  const roles = counterRoles(readStyle(dossier));
  if (roles.length === 0) return undefined;
  return (id) => (roles.includes(ZOIDS[id]?.role ?? '') ? 2.2 : 1);
}
/** Contra por arma (gated a skill 0.7), como el cliente. */
function enemyCounter(dossier: Dossier | undefined, skill: number, unitTypeId: string, index: number): string[] | undefined {
  if (skill < 0.7 || index % 2 !== 0) return undefined;
  const cw = counterWeapons(readStyle(dossier));
  if (cw.length === 0) return undefined;
  const counter = cw[(index / 2) % cw.length]!;
  return [counter, ...(ZOIDS[unitTypeId]?.weapons ?? [])].filter((w, j, a) => a.indexOf(w) === j).slice(0, 3);
}

interface Bucket {
  n: number; wins: number; turns: number; playerLost: number; enemyLost: number;
  skill: number; adapted: number; wcounter: number; enemyRoles: Record<string, number>;
}
function emptyBucket(): Bucket {
  return { n: 0, wins: 0, turns: 0, playerLost: 0, enemyLost: 0, skill: 0, adapted: 0, wcounter: 0, enemyRoles: {} };
}

/** Semillas por contrato: cada decil junta 10·REPEATS batallas → lectura estable. */
const REPEATS = Number(process.argv[4] ?? 6);

interface BattleOutcome { win: boolean; turns: number; playerLost: number; enemyLost: number; melee: number; ranged: number }

/** Juega UN contrato con una semilla dada; devuelve el resultado + la táctica del
 *  jugador (cerca/lejos) que alimenta el dosier de facción. */
function simulateBattle(
  playerTeam: string[], contract: Contract, dossier: Dossier | undefined,
  skill: number, wear: number, seed: number,
): BattleOutcome {
  const spawns: UnitSpawn[] = [
    ...playerTeam.map((unitTypeId, i) => ({
      id: `P${i + 1}`, name: ZOIDS[unitTypeId]!.name, unitTypeId,
      team: 'player' as const, position: PLAYER_POS[i]!,
      ...(i === 0 ? { commander: true } : {}),
    })),
    ...contract.enemySquad.map((unitTypeId, i) => {
      const weapons = enemyCounter(dossier, skill, unitTypeId, i);
      return {
        id: `E${i + 1}`, name: ZOIDS[unitTypeId]!.name, unitTypeId,
        team: 'enemy' as const, position: ENEMY_POS[i]!,
        ...(weapons ? { loadout: { weapons } } : {}),
        ...(i === 0 ? { commander: true } : {}),
      };
    }),
  ];
  const battle = new Battle({
    map: VALLEY_CROSSING, unitCatalog: ZOIDS,
    abilityCatalog: CATALOGS.abilityCatalog, moduleCatalog: MODULES, weaponCatalog: CATALOGS.weaponCatalog,
    wear, seed, spawns,
  });
  let melee = 0, ranged = 0, turns = 0;
  while (!battle.isOver && turns < MAX_TURNS) {
    battle.nextTurn();
    const active = battle.getActiveUnit();
    turns++;
    if (!active) break;
    // Skill POR EQUIPO: jugador a tope (1), enemigo por la curva.
    const teamSkill = active.team === 'player' ? 1 : skill;
    for (const action of planTurn(battle, active, teamSkill)) {
      if (battle.isOver || battle.getActiveUnit()?.id !== active.id) break;
      if (action.type === 'ability' && active.team === 'player') {
        const r = battle.abilityOf(action.abilityId).range;
        if (r <= 1) melee++; else if (r >= 3) ranged++;
      }
      if (action.type !== 'wait' && battle.checkVetoes(action)) continue;
      try { battle.execute(action); } catch { /* plan obsoleto */ }
    }
  }
  return {
    win: battle.winner === 'player', turns,
    playerLost: battle.units.filter((u) => u.team === 'player' && u.hp <= 0).length,
    enemyLost: battle.units.filter((u) => u.team === 'enemy' && u.hp <= 0).length,
    melee, ranged,
  };
}

function runDifficulty(diffId: string): Bucket[] {
  const diff = DIFFICULTIES.find((d) => d.id === diffId)!;
  const buckets: Bucket[] = Array.from({ length: Math.ceil(N / 10) }, emptyBucket);
  let dossier: Dossier | undefined;

  for (let c = 0; c < N; c++) {
    const skill = aiSkillFor(c, diff.aiCurve ?? 0);
    const offers = contractOffers(c, ECONOMY, CONTRACT_ENEMY_POOL, adaptiveWeight(dossier, skill), campaignStrength(c));
    // El jugador ELIGE un encargo acorde a su progreso (no rota a ciegas por la
    // caza de élite con chatarra); dentro de lo permitido, va rotando.
    const eligible = offers.filter((o) => allowedTiers(c).includes(o.tier));
    const pool = eligible.length > 0 ? eligible : offers;
    const contract = pool[c % pool.length]!;
    const playerTeam = playerRosterFor(c);

    const b = buckets[Math.floor(c / 10)]!;
    let firstMelee = 0, firstRanged = 0;
    for (let r = 0; r < REPEATS; r++) {
      const res = simulateBattle(playerTeam, contract, dossier, skill, diff.wear, (c * REPEATS + r + 1) * 2654435761);
      b.n++;
      if (res.win) b.wins++;
      b.turns += res.turns;
      b.playerLost += res.playerLost;
      b.enemyLost += res.enemyLost;
      b.skill += skill;
      if (skill >= 0.45) b.adapted++;
      if (skill >= 0.7) b.wcounter++;
      if (r === 0) { firstMelee = res.melee; firstRanged = res.ranged; }
    }
    // El dosier evoluciona por la partida canónica (semilla 0) — traza única.
    dossier = updateDossier(dossier, { melee: firstMelee, ranged: firstRanged, overclocks: 0 });
    for (const id of contract.enemySquad) {
      const role = ZOIDS[id]!.role;
      b.enemyRoles[role] = (b.enemyRoles[role] ?? 0) + 1;
    }
  }
  return buckets;
}

const MODE_LABEL = MODE === 'meta' ? 'roster élite CONGELADO (techo)'
  : MODE === 'frozen' ? 'roster arranque CONGELADO (suelo)'
  : 'arco realista (roster crece + encargos sensatos)';
console.log(`\n═══ Simulación de campaña: ${N} contratos · ${MODE_LABEL} · jugador competente vs curva + adaptación ═══`);
for (const diff of DIFFICULTIES) {
  const buckets = runDifficulty(diff.id);
  console.log(`\n■ Dificultad ${diff.name} (wear ${diff.wear}, desfase IA ${diff.aiCurve ?? 0})`);
  console.log('  contratos   %victoria  skillEnem  turnos  bajas-jug  bajas-en  adapta  topRoles');
  buckets.forEach((b, i) => {
    if (b.n === 0) return;
    const lo = i * 10, hi = lo + b.n / REPEATS - 1;
    const roles = Object.entries(b.enemyRoles).sort((a, z) => z[1] - a[1]).slice(0, 3)
      .map(([r, n]) => `${r}:${n}`).join(' ');
    const flag = b.wcounter > 0 ? '⚔arma' : b.adapted > 0 ? '~chasis' : '·';
    console.log(
      `  ${String(lo).padStart(3)}-${String(hi).padEnd(3)}   ` +
      `${((b.wins / b.n) * 100).toFixed(0).padStart(6)}%   ` +
      `${(b.skill / b.n).toFixed(2).padStart(6)}   ` +
      `${(b.turns / b.n).toFixed(0).padStart(5)}   ` +
      `${(b.playerLost / b.n).toFixed(1).padStart(7)}   ` +
      `${(b.enemyLost / b.n).toFixed(1).padStart(6)}   ` +
      `${flag.padEnd(7)} ${roles}`,
    );
  });
}
console.log('\n(skillEnem = competencia media del enemigo; adapta: ~chasis desde skill 0.45, ⚔arma desde 0.7)');
