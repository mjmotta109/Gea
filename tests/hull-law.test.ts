import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { MAX_HIT_FRACTION, maxHitCap } from '../src/core/combat.js';
import { GameMap } from '../src/core/grid.js';
import { ZOIDS } from '../src/data/zoids.js';
import { MODULES } from '../src/data/modules.js';
import { ABILITIES } from '../src/data/abilities.js';

// LA LEY DEL CASCO: ningún impacto limpio mata a una máquina entera.
// El primer golpe deja ventana para reaccionar; el segundo sí mata.

const OPEN = GameMap.fromAscii(['00000', '00000', '00000']);

// Un cañón de laboratorio absurdo: sin la ley, borraría a cualquiera.
const LAB_ABILITIES = {
  ...ABILITIES,
  'lab-aniquilador': {
    id: 'lab-aniquilador', name: 'Aniquilador', description: 'Prueba de la ley.',
    range: 4, minRange: 0, shape: 'single' as const, aoeRadius: 0, accuracy: 100,
    targetsAllies: false,
    effects: [{ kind: 'damage' as const, power: 900, damageType: 'physical' as const }],
  },
};

function duel(): Battle {
  const spawns: UnitSpawn[] = [
    { id: 'P1', name: 'P1', unitTypeId: 'gojulas', team: 'player', position: { x: 1, y: 1 }, extraAbilityIds: ['lab-aniquilador'] },
    { id: 'E1', name: 'E1', unitTypeId: 'molga', team: 'enemy', position: { x: 3, y: 1 } },
  ];
  const config: BattleConfig = {
    map: OPEN, unitCatalog: ZOIDS, moduleCatalog: MODULES,
    abilityCatalog: LAB_ABILITIES, seed: 9, spawns,
  };
  return new Battle(config);
}

function untilP1(battle: Battle): void {
  for (let i = 0; i < 40 && battle.getActiveUnit()?.id !== 'P1'; i++) {
    if (!battle.getActiveUnit()) battle.nextTurn();
    else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
  }
}

describe('la ley del casco', () => {
  it('el tope es la fracción anunciada del casco máximo', () => {
    expect(MAX_HIT_FRACTION).toBe(0.7);
    expect(maxHitCap(100)).toBe(70);
    expect(maxHitCap(80)).toBe(56);
    expect(maxHitCap(1)).toBe(1); // nunca por debajo de 1
  });

  it('un golpe absurdo NO mata a una máquina entera: deja ventana', () => {
    const battle = duel();
    untilP1(battle);
    const molga = battle.unit('E1');
    const maxHp = battle.effectiveStats(molga).maxHp;
    expect(molga.hp).toBe(maxHp);
    const events = battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'lab-aniquilador', target: { x: 3, y: 1 } });
    const dealt = events.find((e) => e.type === 'damage-dealt');
    expect(dealt).toBeDefined();
    if (dealt && dealt.type === 'damage-dealt') {
      expect(dealt.amount).toBeLessThanOrEqual(maxHitCap(maxHp));
    }
    expect(molga.hp).toBeGreaterThan(0); // viva: puede retirarse o eyectar
    expect(molga.hp).toBeGreaterThanOrEqual(maxHp - maxHitCap(maxHp));
  });

  it('el SEGUNDO golpe sí mata: la ley no es invulnerabilidad', () => {
    const battle = duel();
    untilP1(battle);
    battle.execute({ type: 'ability', unitId: 'P1', abilityId: 'lab-aniquilador', target: { x: 3, y: 1 } });
    battle.execute({ type: 'wait', unitId: 'P1' });
    // La molga actúa (lo que haga) y vuelve el turno de P1.
    untilP1(battle);
    const before = battle.unit('E1').hp;
    expect(before).toBeGreaterThan(0);
    battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'lab-aniquilador', target: battle.unit('E1').position,
    });
    expect(battle.unit('E1').hp).toBe(0); // tocada + rematada = derribo
  });

  it('el pronóstico anuncia el tope: min y max nunca lo superan', () => {
    const battle = duel();
    untilP1(battle);
    const molga = battle.unit('E1');
    const preview = battle.attackPreview('P1', 'lab-aniquilador', molga.position)!;
    const cap = maxHitCap(battle.effectiveStats(molga).maxHp);
    expect(preview.max).toBeLessThanOrEqual(cap);
    expect(preview.min).toBeLessThanOrEqual(cap);
  });
});
