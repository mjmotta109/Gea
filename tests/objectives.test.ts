import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig, type UnitSpawn } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import type { BattleEvent } from '../src/core/types.js';

const P = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'player', position: { x, y } });
const E = (id: string, unitTypeId: string, x: number, y: number): UnitSpawn =>
  ({ id, name: id, unitTypeId, team: 'enemy', position: { x, y } });

function arena(overrides: Partial<BattleConfig>): Battle {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    seed: 99,
    spawns: [],
    ...overrides,
  });
}

/** Cierra el turno activo con wait (abriéndolo antes si hace falta). */
function pass(battle: Battle): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (!battle.getActiveUnit()) events.push(...battle.nextTurn());
  const active = battle.getActiveUnit();
  if (active) events.push(...battle.execute({ type: 'wait', unitId: active.id }));
  return events;
}

describe('objetivos de batalla: cada contrato es una historia distinta', () => {
  it('eliminate sigue siendo el clásico por defecto', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 6, 2)],
    });
    expect(battle.objective.kind).toBe('eliminate');
    battle.unit('E1').hp = 0;
    pass(battle);
    expect(battle.winner).toBe('player');
  });

  it('assassinate: cae el cabecilla y la batalla termina aunque queden más', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 6, 2), E('E2', 'molga', 6, 4)],
      objective: { kind: 'assassinate', targetUnitId: 'E1' },
    });
    battle.unit('E1').hp = 0;
    pass(battle);
    expect(battle.winner).toBe('player');
    expect(battle.unit('E2').hp).toBeGreaterThan(0); // el resto seguía en pie
  });

  it('protect: si el protegido cae, se pierde con el equipo entero vivo', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), P('W1', 'carguero-colono', 0, 0), E('E1', 'molga', 6, 2)],
      objective: { kind: 'protect', wardUnitId: 'W1' },
    });
    battle.unit('W1').hp = 0;
    pass(battle);
    expect(battle.winner).toBe('enemy');
  });

  it('el carguero (speed 0) jamás gana turno: es carga, no combatiente', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), P('W1', 'carguero-colono', 0, 0), E('E1', 'molga', 6, 2)],
      objective: { kind: 'protect', wardUnitId: 'W1' },
    });
    for (let i = 0; i < 12 && !battle.isOver; i++) {
      expect(pass(battle).some((e) => e.type === 'turn-started' && e.unitId === 'W1')).toBe(false);
    }
  });

  it('reach: plantar una unidad en la zona gana en el acto', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 7, 5)],
      objective: { kind: 'reach', zone: [{ x: 4, y: 2 }] },
    });
    battle.nextTurn();
    battle.execute({ type: 'move', unitId: 'P1', to: { x: 4, y: 2 } });
    expect(battle.winner).toBe('player');
  });

  it('survive: aguantar N rondas gana; las rondas avanzan con las activaciones', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 7, 5)],
      objective: { kind: 'survive', rounds: 2 },
    });
    const rounds: number[] = [];
    for (let i = 0; i < 20 && !battle.isOver; i++) {
      for (const event of pass(battle)) {
        if (event.type === 'round-started') rounds.push(event.round);
      }
    }
    expect(battle.winner).toBe('player');
    expect(rounds).toEqual([2, 3]); // la ronda 3 abre = 2 rondas completadas
  });
});

describe('refuerzos por oleadas', () => {
  it('la oleada entra al arrancar su ronda, en la casilla libre más cercana', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 6, 2)],
      // Pide la casilla del P1: deberá recolocarse en un anillo vecino.
      reinforcements: [{ round: 2, spawns: [E('E2', 'molga', 1, 2)] }],
    });
    expect(battle.units).toHaveLength(2);
    let arrived: Extract<BattleEvent, { type: 'reinforcements-arrived' }> | undefined;
    for (let i = 0; i < 10 && !arrived; i++) {
      for (const event of pass(battle)) {
        if (event.type === 'reinforcements-arrived') arrived = event;
      }
    }
    expect(arrived).toBeDefined();
    expect(arrived!.round).toBe(2);
    expect(arrived!.unitIds).toEqual(['E2']);
    const e2 = battle.unit('E2');
    expect(e2.position).not.toEqual({ x: 1, y: 2 }); // la casilla estaba tomada
    expect(Math.abs(e2.position.x - 1) + Math.abs(e2.position.y - 2)).toBe(1);
  });

  it('barrer la vanguardia no gana: el grueso está en camino', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 6, 2)],
      reinforcements: [{ round: 3, spawns: [E('E2', 'molga', 7, 5)] }],
    });
    battle.unit('E1').hp = 0;
    pass(battle);
    expect(battle.isOver).toBe(false); // la oleada pendiente sostiene la batalla
    for (let i = 0; i < 12 && battle.units.length < 3; i++) pass(battle);
    battle.unit('E2').hp = 0;
    pass(battle);
    expect(battle.winner).toBe('player'); // ya no queda nada en camino
  });

  it('misma semilla, mismas oleadas: el refuerzo es determinista', () => {
    const run = (): string => {
      const battle = arena({
        spawns: [P('P1', 'liger-zero', 1, 2), E('E1', 'molga', 6, 2)],
        reinforcements: [{ round: 2, spawns: [E('E2', 'molga', 6, 2)] }],
      });
      for (let i = 0; i < 8; i++) pass(battle);
      const e2 = battle.units.find((u) => u.id === 'E2');
      return e2 ? `${e2.position.x},${e2.position.y}` : 'no-llegó';
    };
    expect(run()).toBe(run());
    expect(run()).not.toBe('no-llegó');
  });
});

describe('retirada y eyección: perder sin game over', () => {
  it('la retirada exige borde y saca a la unidad intacta del campo', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 3, 2), P('P2', 'command-wolf', 0, 4), E('E1', 'molga', 7, 5)],
    });
    battle.nextTurn();
    expect(battle.getActiveUnit()?.id).toBe('P1'); // liger, el más rápido
    // En (3,2) no hay borde: la retirada se rechaza.
    expect(() => battle.execute({ type: 'retreat', unitId: 'P1' })).toThrow(/borde/);
    battle.execute({ type: 'move', unitId: 'P1', to: { x: 0, y: 2 } });
    const events = battle.execute({ type: 'retreat', unitId: 'P1' });
    expect(events.map((e) => e.type)).toContain('unit-retreated');
    expect(battle.unit('P1').retreated).toBe(true);
    expect(battle.unit('P1').hp).toBeGreaterThan(0); // la máquina sobrevive
    expect(battle.isOver).toBe(false); // P2 sigue peleando
    // La retirada la saca del reloj de turnos y del campo.
    for (let i = 0; i < 8 && !battle.isOver; i++) {
      expect(pass(battle).some((e) => e.type === 'turn-started' && e.unitId === 'P1')).toBe(false);
    }
    expect(battle.unitAt({ x: 0, y: 2 })).toBeUndefined();
  });

  it('retirarse el último es la derrota (pero con las máquinas a salvo)', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 0, 2), E('E1', 'molga', 7, 5)],
    });
    battle.nextTurn();
    battle.execute({ type: 'retreat', unitId: 'P1' });
    expect(battle.winner).toBe('enemy');
    expect(battle.unit('P1').hp).toBeGreaterThan(0);
  });

  it('la eyección sacrifica la máquina y lo marca para la campaña', () => {
    const battle = arena({
      spawns: [P('P1', 'liger-zero', 3, 2), P('P2', 'command-wolf', 0, 4), E('E1', 'molga', 7, 5)],
    });
    battle.nextTurn();
    const events = battle.execute({ type: 'eject', unitId: 'P1' });
    const kinds = events.map((e) => e.type);
    expect(kinds).toContain('unit-ejected');
    expect(kinds).toContain('unit-destroyed');
    expect(battle.unit('P1').ejected).toBe(true);
    expect(battle.unit('P1').hp).toBe(0);
    expect(battle.isOver).toBe(false);
  });

  it('el comandante que se retira deja al equipo sin red de mando', () => {
    const battle = arena({
      spawns: [
        { ...P('P1', 'liger-zero', 0, 2), commander: true },
        P('P2', 'command-wolf', 3, 4),
        E('E1', 'molga', 7, 5),
      ],
    });
    battle.nextTurn();
    const events = battle.execute({ type: 'retreat', unitId: 'P1' });
    expect(events.map((e) => e.type)).toContain('command-link-lost');
  });
});
