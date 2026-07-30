import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { GameMap } from '../src/core/grid.js';
import { ZOIDS } from '../src/data/zoids.js';
import { MODULES } from '../src/data/modules.js';
import { ABILITIES } from '../src/data/abilities.js';

// Pronóstico de REACCIÓN: antes de atacar se sabe si el enemigo puede
// devolver el golpe (contraataque) o si moverse regala un tiro de
// oportunidad. Sin sorpresas: la misma regla que ejecuta reactionStrike.

const OPEN = GameMap.fromAscii(['000000', '000000', '000000']);

function duel(playerPos = { x: 1, y: 1 }, enemyPos = { x: 2, y: 1 }): Battle {
  const spawns: UnitSpawn[] = [
    { id: 'P1', name: 'P1', unitTypeId: 'gojulas', team: 'player', position: playerPos },
    { id: 'E1', name: 'E1', unitTypeId: 'molga', team: 'enemy', position: enemyPos },
  ];
  const config: BattleConfig = {
    map: OPEN, unitCatalog: ZOIDS, moduleCatalog: MODULES,
    abilityCatalog: ABILITIES, seed: 7, spawns,
  };
  return new Battle(config);
}

function untilP1(battle: Battle): void {
  for (let i = 0; i < 40 && battle.getActiveUnit()?.id !== 'P1'; i++) {
    if (!battle.getActiveUnit()) battle.nextTurn();
    else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
  }
}

describe('pronóstico de contraataque', () => {
  it('a bocajarro anuncia el contraataque con arma, puntería y daño', () => {
    const battle = duel();
    untilP1(battle);
    const forecast = battle.counterForecast('P1', 'bite-crush', { x: 2, y: 1 });
    expect(forecast).toBeDefined();
    expect(forecast!.risk).toBe('contraataque');
    if (forecast!.risk === 'contraataque') {
      expect(forecast!.abilityName.length).toBeGreaterThan(0);
      expect(forecast!.chance).toBeGreaterThan(0);
      expect(forecast!.chance).toBeLessThanOrEqual(99);
      expect(forecast!.min).toBeGreaterThan(0);
      expect(forecast!.max).toBeGreaterThanOrEqual(forecast!.min);
    }
  });

  it('desde lejos no hay riesgo: fuera de su alcance de reacción', () => {
    const battle = duel({ x: 0, y: 1 }, { x: 4, y: 1 });
    untilP1(battle);
    const forecast = battle.counterForecast('P1', 'missile-pod', { x: 4, y: 1 });
    expect(forecast).toBeDefined();
    expect(forecast!.risk).toBe('no');
    if (forecast!.risk === 'no') expect(forecast!.reason).toContain('alcance');
  });

  it('la reacción gastada se anuncia: el segundo golpe de la ronda es gratis', () => {
    const battle = duel();
    untilP1(battle);
    // El primer mordisco consume la reacción de la molga (contraataca).
    const events = battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    const reacted = events.some((e) => e.type === 'reaction');
    const molga = battle.unit('E1');
    if (reacted && molga.hp > 0) {
      expect(molga.reactionReady).toBe(false);
      const again = battle.counterForecast('P1', 'bite-crush', molga.position);
      expect(again).toBeDefined();
      expect(again!.risk).toBe('no');
      if (again!.risk === 'no') expect(again!.reason).toContain('gastada');
    } else {
      // Si el mordisco falló (o derribó), al menos el pronóstico previo avisaba.
      expect(battle.counterForecast('P1', 'bite-crush', { x: 2, y: 1 })).toBeDefined();
    }
  });

  it('el pronóstico y la realidad coinciden: si anuncia riesgo, el golpe llega', () => {
    const battle = duel();
    untilP1(battle);
    const forecast = battle.counterForecast('P1', 'bite-crush', { x: 2, y: 1 });
    expect(forecast!.risk).toBe('contraataque');
    const events = battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    const hit = events.find((e) => e.type === 'damage-dealt' && e.targetUnitId === 'E1');
    const reaction = events.find((e) => e.type === 'reaction');
    // Si el golpe conectó y la molga sigue viva, la reacción anunciada ocurre.
    if (hit && battle.unit('E1').hp > 0) {
      expect(reaction).toBeDefined();
      if (reaction && reaction.type === 'reaction' && forecast!.risk === 'contraataque') {
        expect(reaction.abilityId).toBe(forecast!.abilityId);
      }
    }
  });
});

describe('riesgo de tiro de oportunidad', () => {
  it('despegarse de un enemigo con reacción lista se anuncia; quedarse pegado, no', () => {
    const battle = duel({ x: 1, y: 1 }, { x: 2, y: 1 });
    untilP1(battle);
    // Alejarse: la molga tiene la reacción lista y el mordisco a mano.
    const away = battle.opportunityRisk('P1', { x: 0, y: 0 });
    expect(away.map((u) => u.id)).toContain('E1');
    // Reposicionarse sin despegarse (sigue adyacente): no provoca.
    const stay = battle.opportunityRisk('P1', { x: 2, y: 0 });
    expect(stay).toHaveLength(0);
  });
});
