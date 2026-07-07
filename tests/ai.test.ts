import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { planTurn } from '../src/ai/simpleAi.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import type { UnitDefinition } from '../src/core/types.js';

// La IA enemiga debe JUGAR al juego nuevo: retirarse malherida si es
// prudente, vigilar cuando no hay tiro y oler el contrato en escoltas.

const P = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'player', position: { x, y } });
const E = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'enemy', position: { x, y } });

// Chasis de laboratorio: molga prudente (huye) y molga estoica (aguanta).
const LAB: Record<string, UnitDefinition> = {
  ...ZOIDS,
  'molga-prudente': {
    ...ZOIDS['molga']!, id: 'molga-prudente',
    aiProfile: { aggression: 0.3, selfPreservation: 0.9, riskTolerance: 0.3 },
  },
  'molga-estoica': {
    ...ZOIDS['molga']!, id: 'molga-estoica',
    aiProfile: { aggression: 0.5, selfPreservation: 0.2, riskTolerance: 0.5 },
  },
};

function arena(overrides: Partial<BattleConfig>): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: LAB,
    abilityCatalog: ABILITIES,
    seed: 7,
    spawns: [],
    ...overrides,
  });
}

/** Avanza turnos hasta que le toque a `unitId` (los demás esperan). */
function turnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 30 && battle.getActiveUnit()?.id !== unitId; i++) {
    if (!battle.getActiveUnit()) battle.nextTurn();
    else battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
  }
  expect(battle.getActiveUnit()?.id).toBe(unitId);
}

describe('la IA usa el arsenal nuevo', () => {
  it('malherida y prudente, pisa el borde y SE RETIRA', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 4, 2), E('E1', 'molga-prudente', 7, 2)],
    });
    battle.unit('E1').hp = 15; // 15/70: muy tocada, pegada al borde este
    turnOf(battle, 'E1');
    const plan = planTurn(battle, battle.unit('E1'));
    expect(plan[0]!.type).toBe('retreat');
  });

  it('malherida lejos del borde, corre hacia él y remata con la retirada', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 7, 2), E('E1', 'molga-prudente', 3, 2)],
    });
    battle.unit('E1').hp = 15;
    turnOf(battle, 'E1');
    const plan = planTurn(battle, battle.unit('E1'));
    expect(plan.map((a) => a.type)).toEqual(['move', 'retreat']);
  });

  it('la estoica no huye: malherida sigue peleando', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 4, 2), E('E1', 'molga-estoica', 7, 2)],
    });
    battle.unit('E1').hp = 15;
    turnOf(battle, 'E1');
    const plan = planTurn(battle, battle.unit('E1'));
    expect(plan.some((a) => a.type === 'retreat')).toBe(false);
  });

  it('sin tiro posible pero con enemigos cerca, cierra el turno en VIGILANCIA', () => {
    // FLAT_ARENA es 8×6: dist máx manhattan 12. La molga (move 4, cañón
    // rango 4) a 9 del liger: no llega a tiro ni moviéndose, pero el
    // liger está a menos de 10 → vigila en vez de esperar.
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 0, 0), E('E1', 'molga-estoica', 7, 4)],
    });
    turnOf(battle, 'E1');
    const plan = planTurn(battle, battle.unit('E1'));
    expect(plan[plan.length - 1]!.type).toBe('overwatch');
  });

  it('en las escoltas huele el contrato: prioriza al carguero protegido', () => {
    // Liger y carguero equidistantes del atacante, ambos a tiro: sin el
    // olfato, el liger (más fácil de dañar %) empataría o ganaría; el
    // bono de misión (+40) debe decidir por el carguero.
    const battle = arena({
      spawns: [
        E('E1', 'molga-estoica', 3, 2),
        P('P1', 'liger-zero', 3, 4),
        P('W1', 'carguero-colono', 3, 0),
      ],
      objective: { kind: 'protect', wardUnitId: 'W1' },
    });
    turnOf(battle, 'E1');
    const plan = planTurn(battle, battle.unit('E1'));
    const attack = plan.find((a) => a.type === 'ability');
    expect(attack).toBeDefined();
    expect(attack && attack.type === 'ability' ? attack.target : null).toEqual({ x: 3, y: 0 });
  });

  it('mismo estado, mismo plan: la IA nueva sigue siendo determinista', () => {
    const run = (): string => {
      const battle = arena({
        spawns: [P('P1', 'liger-zero', 7, 2), E('E1', 'molga-prudente', 3, 2)],
      });
      battle.unit('E1').hp = 15;
      turnOf(battle, 'E1');
      return JSON.stringify(planTurn(battle, battle.unit('E1')));
    };
    expect(run()).toBe(run());
  });
});
