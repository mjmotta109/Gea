import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { applyStatus } from '../src/core/status.js';
import type { UnitDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPON_LIBRARY_ABILITIES } from '../src/data/weaponLibrary.js';
import { FLAT_ARENA } from '../src/data/maps.js';

/** Luchador cuerpo a cuerpo con contraataque (mordisco de alcance 1). */
const BRAWLER: UnitDefinition = {
  id: 'brawler', name: 'Luchador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 200, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 10, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};

function duel(overrides: Partial<BattleConfig> = {}): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: { brawler: BRAWLER },
    abilityCatalog: ABILITIES,
    seed: 5,
    spawns: [
      { id: 'A', name: 'A', unitTypeId: 'brawler', team: 'player', position: { x: 1, y: 1 } },
      { id: 'D', name: 'D', unitTypeId: 'brawler', team: 'enemy', position: { x: 2, y: 1 } },
    ],
    ...overrides,
  });
}

function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 50; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('Supresión (sinergia de escuadra)', () => {
  it('degrada la puntería del suprimido', () => {
    const battle = duel();
    const d = battle.unit('D');
    expect(battle.effectiveStats(d).accuracy).toBe(0);
    applyStatus(d, 'suprimido', 1);
    expect(battle.effectiveStats(d).accuracy).toBe(-15);
  });

  it('sin supresión, el defensor CONTRAATACA a bocajarro (control)', () => {
    const battle = duel();
    untilTurnOf(battle, 'A');
    const events = battle.execute({ type: 'ability', unitId: 'A', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    expect(events.some((e) => e.type === 'reaction' && e.reaction === 'contraataque' && e.unitId === 'D')).toBe(true);
  });

  it('un defensor SUPRIMIDO no puede contraatacar', () => {
    const battle = duel();
    untilTurnOf(battle, 'A');
    applyStatus(battle.unit('D'), 'suprimido', 1);
    const events = battle.execute({ type: 'ability', unitId: 'A', abilityId: 'bite-crush', target: { x: 2, y: 1 } });
    expect(events.some((e) => e.type === 'reaction')).toBe(false);
  });

  it('un vigilante SUPRIMIDO no dispara al que se mueve a tiro', () => {
    // A en (1,1), D en (3,1) a la espera; A se mueve a (2,1), pegado a D.
    const battle = duel({
      spawns: [
        { id: 'A', name: 'A', unitTypeId: 'brawler', team: 'player', position: { x: 1, y: 1 } },
        { id: 'D', name: 'D', unitTypeId: 'brawler', team: 'enemy', position: { x: 3, y: 1 } },
      ],
    });
    untilTurnOf(battle, 'A');
    const d = battle.unit('D');
    d.overwatch = true;
    applyStatus(d, 'suprimido', 1);
    const events = battle.execute({ type: 'move', unitId: 'A', to: { x: 2, y: 1 } });
    expect(events.some((e) => e.type === 'reaction' && e.reaction === 'vigilancia')).toBe(false);
  });

  it('un vigilante NO suprimido sí dispara (control)', () => {
    const battle = duel({
      spawns: [
        { id: 'A', name: 'A', unitTypeId: 'brawler', team: 'player', position: { x: 1, y: 1 } },
        { id: 'D', name: 'D', unitTypeId: 'brawler', team: 'enemy', position: { x: 3, y: 1 } },
      ],
    });
    untilTurnOf(battle, 'A');
    battle.unit('D').overwatch = true;
    const events = battle.execute({ type: 'move', unitId: 'A', to: { x: 2, y: 1 } });
    expect(events.some((e) => e.type === 'reaction' && e.reaction === 'vigilancia')).toBe(true);
  });

  it('la ráfaga de supresión existe y aplica el estado', () => {
    const ability = WEAPON_LIBRARY_ABILITIES['lib-suppressor']!;
    const status = ability.effects.find((e) => e.kind === 'status');
    expect(status && status.kind === 'status' ? status.status : '').toBe('suprimido');
  });
});
