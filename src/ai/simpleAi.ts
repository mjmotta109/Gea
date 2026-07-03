import type { Battle } from '../core/battle.js';
import { manhattan, samePos } from '../core/grid.js';
import type { BattleAction, Position, UnitState } from '../core/types.js';

/**
 * IA básica para el turno de una unidad. Estrategia:
 *  1. Si desde alguna casilla alcanzable (incluida la actual) puede usar una
 *     habilidad ofensiva contra un rival, elige la combinación que más daño
 *     esperado promete y la ejecuta.
 *  2. Si no, avanza hacia el rival más cercano y espera.
 *
 * Devuelve la secuencia de acciones del turno completo (termina en wait).
 * Es deliberadamente simple: sirve de sparring y de referencia para IAs
 * más serias (evaluación de amenaza, coberturas, focus fire...).
 */
export function planTurn(battle: Battle, unit: UnitState): BattleAction[] {
  const enemies = battle.units.filter((u) => u.team !== unit.team && u.hp > 0);
  if (enemies.length === 0) return [{ type: 'wait', unitId: unit.id }];

  const zoid = battle.zoidOf(unit.zoidId);
  const offensiveAbilities = zoid.abilityIds
    .map((id) => battle.abilityOf(id))
    .filter((a) => a.effects.some((e) => e.kind === 'damage'));

  // Posiciones candidatas: quedarse quieto o cualquier tile alcanzable.
  const moveOptions: Array<{ to: Position | null; from: Position }> = [
    { to: null, from: unit.position },
    ...battle.legalMoves(unit.id).map((t) => ({ to: t.pos, from: t.pos })),
  ];

  let best:
    | { to: Position | null; abilityId: string; target: Position; score: number }
    | undefined;

  for (const option of moveOptions) {
    for (const ability of offensiveAbilities) {
      for (const enemy of enemies) {
        const dist = manhattan(option.from, enemy.position);
        if (dist < ability.minRange || dist > ability.range) continue;
        if (ability.shape === 'line'
          && option.from.x !== enemy.position.x
          && option.from.y !== enemy.position.y) continue;

        const damage = ability.effects.find((e) => e.kind === 'damage');
        const power = damage && damage.kind === 'damage' ? damage.power : 0;
        // Puntuación simple: potencia, rematar bajos de vida y precisión.
        const score = power + (100 - (enemy.hp / battle.zoidOf(enemy.zoidId).stats.maxHp) * 100) + ability.accuracy / 10;
        if (!best || score > best.score) {
          best = { to: option.to, abilityId: ability.id, target: { ...enemy.position }, score };
        }
      }
    }
  }

  if (best) {
    const actions: BattleAction[] = [];
    if (best.to) actions.push({ type: 'move', unitId: unit.id, to: best.to });
    actions.push({ type: 'ability', unitId: unit.id, abilityId: best.abilityId, target: best.target });
    actions.push({ type: 'wait', unitId: unit.id });
    return actions;
  }

  // Sin ataque posible: acercarse al enemigo más cercano.
  const nearest = enemies.reduce((a, b) =>
    manhattan(unit.position, a.position) <= manhattan(unit.position, b.position) ? a : b);
  const reachable = battle.legalMoves(unit.id);
  let bestTile: Position | undefined;
  let bestDist = manhattan(unit.position, nearest.position);
  for (const tile of reachable) {
    const d = manhattan(tile.pos, nearest.position);
    if (d < bestDist) {
      bestDist = d;
      bestTile = tile.pos;
    }
  }

  const actions: BattleAction[] = [];
  if (bestTile && !samePos(bestTile, unit.position)) {
    actions.push({ type: 'move', unitId: unit.id, to: bestTile });
  }
  actions.push({ type: 'wait', unitId: unit.id });
  return actions;
}
