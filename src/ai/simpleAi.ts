import type { Battle } from '../core/battle.js';
import { manhattan, samePos } from '../core/grid.js';
import { reachableTiles } from '../core/pathfinding.js';
import type { AIProfile, BattleAction, Position, UnitState } from '../core/types.js';

/** Perfil neutro: reproduce aproximadamente la IA greedy clásica. */
const NEUTRAL_PROFILE: AIProfile = { aggression: 0.5, selfPreservation: 0.5, riskTolerance: 0.5 };

function profileOf(battle: Battle, unit: UnitState): AIProfile {
  return { ...NEUTRAL_PROFILE, ...battle.definitionOf(unit.unitTypeId).aiProfile };
}

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

  // Habilidades pagables (los sistemas no vetan: energía, munición,
  // enfriamiento, montaje destruido...), separadas por intención.
  const usableAbilities = battle.knownAbilityIds(unit)
    .map((id) => battle.abilityOf(id))
    .filter((a) => battle.checkVetoes({
      type: 'ability', unitId: unit.id, abilityId: a.id, target: unit.position,
    }) === null);
  const offensiveAbilities = usableAbilities.filter((a) => a.effects.some((e) => e.kind === 'damage'));
  // Soporte puro: curaciones y buffs a aliados (incluido uno mismo).
  const supportAbilities = usableAbilities.filter((a) =>
    a.targetsAllies &&
    !a.effects.some((e) => e.kind === 'damage') &&
    a.effects.some((e) => e.kind === 'heal' || e.kind === 'status'));
  const allies = battle.units.filter((u) => u.team === unit.team && u.hp > 0);

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

  const profile = profileOf(battle, unit);

  for (const option of moveOptions) {
    // Riesgo posicional: enemigos pegados a la casilla final del turno.
    const nearbyThreat = enemies.filter((e) => manhattan(option.from, e.position) <= 2).length;

    for (const ability of offensiveAbilities) {
      for (const enemy of enemies) {
        // Alcance, alineación y línea de visión, igual que el motor.
        if (!battle.canTargetFrom(unit, option.from, ability.id, enemy.position)) continue;

        const damage = ability.effects.find((e) => e.kind === 'damage');
        const power = damage && damage.kind === 'damage' ? damage.power : 0;
        // Utilidad base: potencia, rematar bajos de vida y precisión...
        let score = power + (100 - (enemy.hp / battle.effectiveStats(enemy).maxHp) * 100) + ability.accuracy / 10;
        // ...sesgada por personalidad (fase 5): los prudentes descartan
        // tiros dudosos, los conservadores no terminan rodeados.
        score += (ability.accuracy - 80) * (1 - profile.riskTolerance) * 0.5;
        score -= nearbyThreat * profile.selfPreservation * 12;
        if (!best || score > best.score) {
          best = { to: option.to, abilityId: ability.id, target: { ...enemy.position }, score };
        }
      }
    }

    // Soporte: curar al herido o cubrir al que está en peligro. Utilidad
    // moderada a propósito — un buen disparo casi siempre gana; el soporte
    // entra cuando no hay tiro que valga la pena.
    for (const ability of supportAbilities) {
      for (const ally of allies) {
        const allyPos = ally.id === unit.id ? option.from : ally.position;
        if (!battle.canTargetFrom(unit, option.from, ability.id, allyPos)) continue;

        let score = 0;
        const heal = ability.effects.find((e) => e.kind === 'heal');
        if (heal && heal.kind === 'heal') {
          const missing = battle.effectiveStats(ally).maxHp - ally.hp;
          if (missing < 15) continue; // no gastes el turno en un rasguño
          score = Math.min(heal.power, missing) + 20;
        } else {
          const buff = ability.effects.find((e) => e.kind === 'status');
          if (!buff || buff.kind !== 'status') continue;
          if (ally.statuses.some((s) => s.id === buff.status)) continue; // ya lo tiene
          // Solo merece la pena si el aliado está bajo amenaza real.
          const danger = enemies.filter((e) => manhattan(allyPos, e.position) <= 4).length;
          if (danger === 0) continue;
          score = 28 + danger * 10;
        }
        score -= nearbyThreat * profile.selfPreservation * 12;
        if (!best || score > best.score) {
          best = { to: option.to, abilityId: ability.id, target: { ...allyPos }, score };
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

  // Sin ataque posible: la personalidad decide la maniobra (fase 5).
  const actions: BattleAction[] = [];
  const nearest = enemies.reduce((a, b) =>
    manhattan(unit.position, a.position) <= manhattan(unit.position, b.position) ? a : b);

  const hurt = unit.hp < battle.effectiveStats(unit).maxHp * 0.35;
  const retreat = hurt && profile.selfPreservation >= 0.7;
  const currentDist = manhattan(unit.position, nearest.position);
  // Los poco agresivos mantienen posición salvo que el enemigo ya esté cerca.
  const holdPosition = !retreat && profile.aggression < 0.35
    && currentDist > battle.effectiveStats(unit).move * 2;

  let standAt = unit.position;
  if (canMove && !holdPosition) {
    const reachable = battle.legalMoves(unit.id);
    let bestDist = currentDist;
    let bestTile: Position | undefined;
    for (const tile of reachable) {
      const d = manhattan(tile.pos, nearest.position);
      // Retirada: maximiza distancia; avance: minimízala.
      if (retreat ? d > bestDist : d < bestDist) {
        bestDist = d;
        bestTile = tile.pos;
      }
    }
    if (bestTile && !samePos(bestTile, unit.position)) {
      actions.push({ type: 'move', unitId: unit.id, to: bestTile });
      standAt = bestTile;
    }
  }

  // Boost para seguir cerrando distancia: solo los suficientemente
  // agresivos queman energía en ello.
  const boostTo = !retreat && profile.aggression >= 0.4
    ? planBoost(battle, unit, standAt, nearest.position)
    : undefined;
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
