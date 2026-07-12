import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import {
  CT_TURN_BASE, CT_MOVE, CT_ACT_LIGHT, CT_ACT_HEAVY, CT_OVERDRIVE,
  type AbilityDefinition, type UnitDefinition, type WeaponDefinition,
} from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { FLAT_ARENA } from '../src/data/maps.js';

const TEMPO_ABILITIES: Record<string, AbilityDefinition> = {
  ...ABILITIES,
  'test-heavy': {
    id: 'test-heavy', name: 'Golpe pesado de pruebas', description: 'Pega fuerte y lento.',
    range: 4, minRange: 1, shape: 'single', aoeRadius: 0, accuracy: 100,
    targetsAllies: false, effects: [{ kind: 'damage', power: 40, damageType: 'physical' }],
    ctCost: CT_ACT_HEAVY,
  },
};
const TEMPO_WEAPONS: Record<string, WeaponDefinition> = {
  'test-heavy-w': { id: 'test-heavy-w', name: 'Arma pesada', abilityId: 'test-heavy', costs: {}, magazine: 0, reserves: 0 },
};

const A: UnitDefinition = {
  id: 'a', name: 'A', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 200, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 12, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush', 'e-shield'], weapons: ['test-heavy-w'],
};
const D: UnitDefinition = {
  id: 'd', name: 'D', role: 'tank', moveType: 'ground',
  stats: { maxHp: 400, atk: 30, energyAtk: 1, def: 10, energyDef: 10, speed: 6, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};

function battleOf(pos = { x: 2, y: 1 }, overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA, unitCatalog: { a: A, d: D }, abilityCatalog: TEMPO_ABILITIES, weaponCatalog: TEMPO_WEAPONS,
    seed: 5,
    spawns: [
      { id: 'A', name: 'A', unitTypeId: 'a', team: 'player', position: { x: 1, y: 1 } },
      { id: 'D', name: 'D', unitTypeId: 'd', team: 'enemy', position: pos },
    ],
    ...overrides,
  });
}

function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 60; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

/** CT cedido al cerrar el turno (el delta del evento tempo-spent). */
function tempoOnWait(battle: Battle, unitId: string): number {
  const events = battle.execute({ type: 'wait', unitId });
  const ev = events.find((e) => e.type === 'tempo-spent');
  if (!ev || ev.type !== 'tempo-spent') throw new Error('sin tempo-spent');
  return ev.delta;
}

describe('Tempo como recurso', () => {
  it('esperar cuesta solo la base (te adelanta)', () => {
    const battle = battleOf({ x: 5, y: 1 });
    untilTurnOf(battle, 'A');
    expect(tempoOnWait(battle, 'A')).toBe(CT_TURN_BASE);
  });

  it('un golpe ligero es neutro (base + ligero = umbral)', () => {
    const battle = battleOf({ x: 2, y: 1 }); // D pegado: mordisco ligero sin moverse
    untilTurnOf(battle, 'A');
    battle.execute({ type: 'ability', unitId: 'A', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    expect(tempoOnWait(battle, 'A')).toBe(CT_TURN_BASE + CT_ACT_LIGHT); // 60+40=100
  });

  it('mover retrasa, y mover + arma pesada retrasa mucho', () => {
    const battle = battleOf({ x: 5, y: 1 });
    untilTurnOf(battle, 'A');
    battle.execute({ type: 'move', unitId: 'A', to: { x: 2, y: 1 } });
    battle.execute({ type: 'ability', unitId: 'A', abilityId: 'test-heavy', target: { x: 5, y: 1 } });
    expect(tempoOnWait(battle, 'A')).toBe(CT_TURN_BASE + CT_MOVE + CT_ACT_HEAVY); // 60+30+70=160
  });

  it('un arma pesada sola cuesta base + pesado', () => {
    const battle = battleOf({ x: 4, y: 1 });
    untilTurnOf(battle, 'A');
    battle.execute({ type: 'ability', unitId: 'A', abilityId: 'test-heavy', target: { x: 4, y: 1 } });
    expect(tempoOnWait(battle, 'A')).toBe(CT_TURN_BASE + CT_ACT_HEAVY); // 130
  });

  it('la sobremarcha pega más y cuesta el próximo turno', () => {
    // Daño base (sin sobremarcha).
    const base = battleOf({ x: 4, y: 1 });
    untilTurnOf(base, 'A');
    const baseEv = base.execute({ type: 'ability', unitId: 'A', abilityId: 'test-heavy', target: { x: 4, y: 1 } });
    const baseDmg = baseEv.find((e) => e.type === 'damage-dealt');

    // Mismo seed, con sobremarcha.
    const od = battleOf({ x: 4, y: 1 });
    untilTurnOf(od, 'A');
    const odEv = od.execute({ type: 'ability', unitId: 'A', abilityId: 'test-heavy', target: { x: 4, y: 1 }, overdrive: true });
    const odDmg = odEv.find((e) => e.type === 'damage-dealt');
    expect(odEv.some((e) => e.type === 'overdrive-used')).toBe(true);
    if (baseDmg?.type === 'damage-dealt' && odDmg?.type === 'damage-dealt') {
      expect(odDmg.amount).toBeGreaterThan(baseDmg.amount);
    }
    // Coste de tempo con la sobremarcha: base + pesado + sobremarcha.
    expect(tempoOnWait(od, 'A')).toBe(CT_TURN_BASE + CT_ACT_HEAVY + CT_OVERDRIVE); // 230
  });

  it('la sobremarcha sobre una habilidad sin daño es ilegal', () => {
    const battle = battleOf({ x: 5, y: 1 });
    untilTurnOf(battle, 'A');
    expect(() => battle.execute({ type: 'ability', unitId: 'A', abilityId: 'e-shield', target: { x: 1, y: 1 }, overdrive: true }))
      .toThrow(/sobremarcha/);
  });

  it('un turno perdido por aturdimiento cuesta el umbral completo', () => {
    const battle = battleOf({ x: 5, y: 1 });
    battle.unit('A').statuses.push({ id: 'stunned', remainingTurns: 1 });
    const events = battle.nextTurn(); // abre el turno de A, aturdido → se pierde
    const ev = events.find((e) => e.type === 'tempo-spent' && e.unitId === 'A');
    expect(ev && ev.type === 'tempo-spent' ? ev.delta : 0).toBe(100);
  });

  it('reaccionar no cuesta tempo al que reacciona', () => {
    const battle = battleOf({ x: 2, y: 1 }); // D pegado a A
    untilTurnOf(battle, 'A');
    battle.execute({ type: 'ability', unitId: 'A', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    expect(battle.unit('D').tempoSpent ?? 0).toBe(0);
  });

  it('projectedTempo refleja lo comprometido', () => {
    const battle = battleOf({ x: 5, y: 1 });
    untilTurnOf(battle, 'A');
    battle.execute({ type: 'move', unitId: 'A', to: { x: 2, y: 1 } });
    expect(battle.projectedTempo('A').spent).toBe(CT_TURN_BASE + CT_MOVE); // 90
  });
});
