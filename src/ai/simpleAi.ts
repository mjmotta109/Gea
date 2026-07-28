import type { Battle } from '../core/battle.js';
import { footprintTiles, manhattan, samePos } from '../core/grid.js';
import { reachableTiles } from '../core/pathfinding.js';
import type { AIProfile, BattleAction, Position, UnitState } from '../core/types.js';

/** Perfil neutro: reproduce aproximadamente la IA greedy clásica. */
const NEUTRAL_PROFILE: AIProfile = { aggression: 0.5, selfPreservation: 0.5, riskTolerance: 0.5 };

function profileOf(battle: Battle, unit: UnitState): AIProfile {
  return { ...NEUTRAL_PROFILE, ...battle.definitionOf(unit.unitTypeId).aiProfile };
}

/** Cuánta prioridad da el escuadrón a concentrar el fuego en su presa. */
const FOCUS_BONUS = 25;
/** Competencia mínima (curva de dificultad) para coordinar el fuego de escuadra. */
const AI_SKILL_FOCUS = 0.35;
/** Competencia mínima para emboscar (vigilancia defensiva). */
const AI_SKILL_AMBUSH = 0.65;

/**
 * FOCO del escuadrón: la presa sobre la que conviene concentrar el fuego esta
 * ronda. Cada aliado lo calcula IGUAL (función pura del estado, orden fijo,
 * desempate por-primero), así que convergen sin memoria compartida — la
 * coordinación es emergente y determinista. Premia a los rematables (poca
 * vida), a los ya debilitados (suprimido/cocido) y a los que más aliados
 * pueden alcanzar YA (concentrables). Devuelve undefined si no hay enemigos.
 */
function teamFocusTarget(battle: Battle, self: UnitState, enemies: UnitState[]): UnitState | undefined {
  const allies = battle.units.filter((u) => u.team === self.team && u.hp > 0 && !u.retreated);
  let best: UnitState | undefined;
  let bestScore = -Infinity;
  for (const e of enemies) {
    const maxHp = Math.max(1, battle.effectiveStats(e).maxHp);
    let s = (1 - e.hp / maxHp) * 100; // cuanto más bajo de vida, mejor presa
    let shooters = 0;
    for (const a of allies) {
      const canHit = battle.knownAbilityIds(a).some((id) => {
        const ab = battle.abilityOf(id);
        return ab.effects.some((x) => x.kind === 'damage')
          && battle.canTargetFrom(a, a.position, id, e.position);
      });
      if (canHit) shooters++;
    }
    s += shooters * 15; // concentrable = varios aliados ya le alcanzan
    if (e.statuses.some((st) => st.id === 'suprimido')) s += 20; // ya fijado
    const h = e.components.heat;
    if (h && h.max > 0 && h.current / h.max >= 0.7) s += 15; // reactor al rojo
    if (s > bestScore) { bestScore = s; best = e; }
  }
  return best;
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
export function planTurn(battle: Battle, unit: UnitState, skill?: number): BattleAction[] {
  // Competencia efectiva: el override permite skill POR EQUIPO (un jugador
  // simulado a tope contra un enemigo que sube por la curva). Sin override rige
  // el de la batalla (por defecto 1 → golden idéntico).
  const aiSkill = skill ?? battle.aiSkill;
  const enemies = battle.units.filter((u) => u.team !== unit.team && u.hp > 0 && !u.retreated);
  if (enemies.length === 0) return [{ type: 'wait', unitId: unit.id }];
  // Combate nocturno: solo se DISPARA a lo que los sensores ven. Para
  // MOVERSE vale el rumor de los motores (rumbo sin solución de tiro):
  // así la niebla no congela a la IA en un empate ciego.
  const visibleEnemies = battle.night
    ? enemies.filter((e) => battle.unitVisibleTo(unit.team, e))
    : enemies;

  // Retirada REAL: el malherido prudente no maniobra — abandona el campo
  // por el borde (vivir hoy es pelear mañana). El motor exige pisar borde.
  const fleeProfile = profileOf(battle, unit);
  const badlyHurt = unit.hp < battle.effectiveStats(unit).maxHp * 0.3;
  if (badlyHurt && fleeProfile.selfPreservation >= 0.7) {
    const onEdge = (pos: Position): boolean =>
      footprintTiles(pos, unit.size).some((t) =>
        t.x === 0 || t.y === 0 || t.x === battle.map.width - 1 || t.y === battle.map.height - 1);
    if (onEdge(unit.position)) return [{ type: 'retreat', unitId: unit.id }];
    const canFlee = battle.checkVetoes({ type: 'move', unitId: unit.id, to: unit.position }) === null;
    if (canFlee && !unit.hasMoved) {
      // El borde alcanzable más lejos de los enemigos: huida con cabeza.
      const nearestEnemyDist = (pos: Position): number =>
        Math.min(...enemies.map((e) => manhattan(pos, e.position)));
      const exits = battle.legalMoves(unit.id).filter((t) => onEdge(t.pos));
      if (exits.length > 0) {
        const exit = exits.reduce((a, b) => (nearestEnemyDist(b.pos) > nearestEnemyDist(a.pos) ? b : a));
        return [
          { type: 'move', unitId: unit.id, to: exit.pos },
          { type: 'retreat', unitId: unit.id },
        ];
      }
    }
  }

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
  const allies = battle.units.filter((u) => u.team === unit.team && u.hp > 0 && !u.retreated);

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
  // Coordinación de escuadra: solo una IA competente concentra el fuego (curva
  // de dificultad). Grunts torpes (skill bajo) pelean cada uno por su lado.
  const focus = aiSkill >= AI_SKILL_FOCUS ? teamFocusTarget(battle, unit, visibleEnemies) : undefined;

  for (const option of moveOptions) {
    // Riesgo posicional: enemigos pegados a la casilla final del turno.
    const nearbyThreat = enemies.filter((e) => manhattan(option.from, e.position) <= 2).length;
    // Terminar el turno sobre fuego se paga (calor + brasas): la IA lo evita.
    // Fuera de mapas con incendiarias (p.ej. el golden) fireAt es siempre 0.
    const firePenalty = battle.map.fireAt(option.from) > 0 ? 40 : 0;

    for (const ability of offensiveAbilities) {
      for (const enemy of visibleEnemies) {
        // Alcance, alineación y línea de visión, igual que el motor.
        if (!battle.canTargetFrom(unit, option.from, ability.id, enemy.position)) continue;

        const damage = ability.effects.find((e) => e.kind === 'damage');
        const power = damage && damage.kind === 'damage' ? damage.power : 0;
        // Utilidad del arma COMPLETA, no solo el daño directo: cocer un reactor,
        // incendiar la zona o suprimir también valen. Todo esto solo aplica a
        // las mecánicas nuevas (calor/fuego/supresión), ausentes del golden, así
        // que la valoración de la IA del golden no cambia.
        let utility = power;
        for (const eff of ability.effects) {
          if (eff.kind === 'heat' && enemy.components.heat) {
            const h = enemy.components.heat;
            const overshoot = Math.max(0, h.current + eff.amount - h.max);
            utility += eff.amount * 0.7 + overshoot; // desbordar el reactor (apagado) es oro
          } else if (eff.kind === 'status' && eff.status === 'suprimido') {
            utility += (eff.chance / 100) * 26; // fijar al rival prepara el remate del escuadrón
          }
        }
        if (ability.ignites) utility += enemy.components.heat ? 24 : 12; // fuego: cuece + niega zona
        // Utilidad base: + rematar bajos de vida y precisión...
        let score = utility + (100 - (enemy.hp / battle.effectiveStats(enemy).maxHp) * 100) + ability.accuracy / 10;
        // Olfato de misión: si el objetivo es proteger a alguien, ese
        // alguien es EL blanco — la IA también lee el contrato.
        const objective = battle.objective;
        if (objective.kind === 'protect' && enemy.id === objective.wardUnitId) score += 40;
        // ...sesgada por personalidad (fase 5): los prudentes descartan
        // tiros dudosos, los conservadores no terminan rodeados.
        score += (ability.accuracy - 80) * (1 - profile.riskTolerance) * 0.5;
        score -= nearbyThreat * profile.selfPreservation * 12;
        score -= firePenalty;
        // Remate seguro (sinergia): un SUPRIMIDO no contraataca; un reactor
        // COCIDO está al borde del apagado. Prioriza cerrarlos.
        if (enemy.statuses.some((s) => s.id === 'suprimido')) score += 18;
        const eh = enemy.components.heat;
        if (eh && eh.max > 0 && eh.current / eh.max >= 0.7) score += 12;
        // Fuego concentrado: prioriza la presa del escuadrón para rematarla
        // entre varios en vez de repartir daño (coordinación emergente).
        if (focus && enemy.id === focus.id) score += FOCUS_BONUS;
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
        score -= firePenalty; // tampoco te cures parado en el fuego
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
  const aiStats = battle.effectiveStats(unit);

  // EMBOSCADA (vigilancia): si no hay tiro AHORA pero un enemigo entrará a tiro
  // en cuanto avance, quédate al acecho en vez de caminar a ciegas hacia él. Es
  // la jugada defensiva —los prudentes la prefieren— y estrena en la IA la
  // vigilancia, que hasta ahora solo usaba el jugador.
  const maxRange = offensiveAbilities.reduce((m, a) => Math.max(m, a.range), 0);
  // Solo se embosca a un enemigo MÁS agresivo que uno mismo (el que de verdad
  // va a cerrar la distancia — la asimetría garantiza que el más agresivo de
  // cada pareja SIEMPRE avanza: nunca hay doble-vigilancia mutua que se quede
  // en un empate por límite de turnos) y que llegará a tiro tras SU avance.
  const enemyAboutToEnter = offensiveAbilities.length > 0 && visibleEnemies.some((e) => {
    const d = manhattan(unit.position, e.position);
    if (d <= maxRange) return false; // ya está a tiro: se resolvería como ataque
    const eProfile = profileOf(battle, e);
    if (eProfile.aggression <= profile.aggression) return false;
    return d <= maxRange + battle.effectiveStats(e).move + 1; // entrará a tiro tras avanzar
  });
  if (aiSkill >= AI_SKILL_AMBUSH && !retreat && !unit.hasActed
    && profile.aggression < 0.7 && enemyAboutToEnter) {
    return [{ type: 'overwatch', unitId: unit.id }];
  }

  // Los poco agresivos mantienen posición salvo que el enemigo ya esté cerca.
  const holdPosition = !retreat && profile.aggression < 0.35
    && currentDist > aiStats.move * 2;

  let standAt = unit.position;
  if (canMove && !holdPosition) {
    const reachable = battle.legalMoves(unit.id);
    // Puntúa cada casilla: avance quiere -distancia, retirada +distancia; y en
    // ambos casos huir del fuego pesa fuerte (quedarse ardiendo es peor que no
    // avanzar). Sin fuego (golden) el término se anula y la elección es idéntica
    // a la de antes: mismo tile por el mismo criterio de distancia.
    const tileScore = (pos: Position): number =>
      (retreat ? manhattan(pos, nearest.position) : -manhattan(pos, nearest.position))
      - (battle.map.fireAt(pos) > 0 ? 1000 : 0);
    let bestScore = tileScore(unit.position);
    let bestTile: Position | undefined;
    for (const tile of reachable) {
      const s = tileScore(tile.pos);
      if (s > bestScore) {
        bestScore = s;
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
    actions.push({ type: 'wait', unitId: unit.id });
    return actions;
  }

  // Vigilancia de cobertura: tras la maniobra, sin tiro posible pero con un
  // enemigo acercándose (≤10), cubrir el terreno castiga al que avance.
  // Sujeta a las MISMAS reglas que la emboscada: exige competencia (curva de
  // dificultad — los grunts bobos no vigilan) y solo contra un enemigo MÁS
  // agresivo (la asimetría evita la doble-vigilancia mutua y el empate).
  const watchFrom = standAt;
  const closingIn = visibleEnemies.some((e) =>
    manhattan(watchFrom, e.position) <= 10 && profileOf(battle, e).aggression > profile.aggression);
  const canWatch = aiSkill >= AI_SKILL_AMBUSH && !unit.hasActed && closingIn
    && profile.aggression < 0.7 && offensiveAbilities.length > 0;
  if (canWatch) {
    actions.push({ type: 'overwatch', unitId: unit.id });
    return actions; // la vigilancia ya cierra el turno
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
    size: unit.size,
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
