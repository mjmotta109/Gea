import type { Battle } from '../core/battle.js';
import { manhattan, samePos } from '../core/grid.js';
import { reachableTiles } from '../core/pathfinding.js';
import type { BattleAction, Position, UnitState } from '../core/types.js';

/**
 * IA básica para el turno de una unidad. Estrategia:
 *  1. Si desde alguna casilla alcanzable (incluida la actual) puede usar una
 *     habilidad ofensiva PAGABLE contra un rival, elige la combinación que
 *     más daño esperado promete y la ejecuta.
 *  2. Si no, avanza hacia el rival más cercano (boost incluido si hay
 *     energía de sobra), recarga el arma vacía si la tiene, y espera.
 *
 * Consulta checkVetoes antes de planear: no intenta disparar sin energía
 * ni munición. Devuelve la secuencia de acciones del turno completo
 * (termina en wait). Es deliberadamente simple: sirve de sparring y de
 * referencia para IAs más serias.
 */
export function planTurn(battle: Battle, unit: UnitState): BattleAction[] {
  const enemies = battle.units.filter((u) => u.team !== unit.team && u.hp > 0);
  if (enemies.length === 0) return [{ type: 'wait', unitId: unit.id }];

  // Solo habilidades ofensivas que los sistemas no vetan (energía,
  // munición, enfriamiento, montaje destruido...).
  const offensiveAbilities = battle.knownAbilityIds(unit)
    .map((id) => battle.abilityOf(id))
    .filter((a) => a.effects.some((e) => e.kind === 'damage'))
    .filter((a) => battle.checkVetoes({
      type: 'ability', unitId: unit.id, abilityId: a.id, target: unit.position,
    }) === null);

  const canMove = battle.checkVetoes({
    type: 'move', unitId: unit.id, to: unit.position,
  }) === null;

  // Posiciones candidatas: quedarse quieto o cualquier tile alcanzable.
  const moveOptions: Array<{ to: Position | null; from: Position }> = [
    { to: null, from: unit.position },
    ...(canMove ? battle.legalMoves(unit.id).map((t) => ({ to: t.pos, from: t.pos })) : []),
  ];

  let best:
    | { to: Position | null; abilityId: string; target: Position; score: number }
    | undefined;

  for (const option of moveOptions) {
    for (const ability of offensiveAbilities) {
      for (const enemy of enemies) {
        // Alcance, alineación y línea de visión, igual que el motor.
        if (!battle.canTargetFrom(unit, option.from, ability.id, enemy.position)) continue;

        const damage = ability.effects.find((e) => e.kind === 'damage');
        const power = damage && damage.kind === 'damage' ? damage.power : 0;
        // Puntuación simple: potencia, rematar bajos de vida y precisión.
        const score = power + (100 - (enemy.hp / battle.effectiveStats(enemy).maxHp) * 100) + ability.accuracy / 10;
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
  const actions: BattleAction[] = [];
  const nearest = enemies.reduce((a, b) =>
    manhattan(unit.position, a.position) <= manhattan(unit.position, b.position) ? a : b);

  let standAt = unit.position;
  if (canMove) {
    const reachable = battle.legalMoves(unit.id);
    let bestDist = manhattan(unit.position, nearest.position);
    let bestTile: Position | undefined;
    for (const tile of reachable) {
      const d = manhattan(tile.pos, nearest.position);
      if (d < bestDist) {
        bestDist = d;
        bestTile = tile.pos;
      }
    }
    if (bestTile && !samePos(bestTile, unit.position)) {
      actions.push({ type: 'move', unitId: unit.id, to: bestTile });
      standAt = bestTile;
    }
  }

  // Boost para seguir cerrando distancia si hay energía y sigue lejos.
  const boostTo = planBoost(battle, unit, standAt, nearest.position);
  if (boostTo) actions.push({ type: 'boost', unitId: unit.id, to: boostTo });

  // Sin tiro este turno: momento ideal para recargar el arma vacía.
  const emptyWeapon = unit.components.arsenal?.weapons.find((w) => {
    const def = battle.weaponOf(w.weaponId);
    return def.magazine > 0 && w.ammo === 0 && w.reserves > 0;
  });
  if (emptyWeapon && !unit.hasActed) {
    actions.push({ type: 'reload', unitId: unit.id, weaponId: emptyWeapon.weaponId });
  }

  actions.push({ type: 'wait', unitId: unit.id });
  return actions;
}

/** Tile de boost que más acerca al objetivo, o undefined si no compensa. */
function planBoost(
  battle: Battle,
  unit: UnitState,
  from: Position,
  target: Position,
): Position | undefined {
  const energy = unit.components.energy;
  if (!energy || energy.boostedThisTurn) return undefined;
  if (battle.checkVetoes({ type: 'boost', unitId: unit.id, to: from })) return undefined;

  const stats = battle.effectiveStats(unit);
  const currentDist = manhattan(from, target);
  if (currentDist <= 2) return undefined; // ya está encima; ahorra energía

  const options = reachableTiles(battle.map, from, {
    move: Math.max(1, Math.ceil(stats.move / 2)),
    jump: stats.jump,
    moveType: battle.definitionOf(unit.unitTypeId).moveType,
    team: unit.team,
  }, battle.units.filter((u) => u.id !== unit.id));

  let bestTile: Position | undefined;
  let bestDist = currentDist;
  for (const option of options) {
    if (samePos(option.pos, from)) continue;
    const d = manhattan(option.pos, target);
    if (d < bestDist) {
      bestDist = d;
      bestTile = option.pos;
    }
  }
  return bestTile;
}
