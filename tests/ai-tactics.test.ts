import { describe, expect, it } from 'vitest';
import { Battle, type BattleConfig } from '../src/core/battle.js';
import { planTurn } from '../src/ai/simpleAi.js';
import { applyStatus } from '../src/core/status.js';
import type { AbilityDefinition, UnitDefinition, WeaponDefinition } from '../src/core/types.js';
import { ABILITIES } from '../src/data/abilities.js';
import { GameMap } from '../src/core/grid.js';

const ARENA = GameMap.fromAscii([
  '00000000',
  '00000000',
  '00000000',
  '00000000',
  '00000000',
]);

const GUNNER: UnitDefinition = {
  id: 'gunner', name: 'Tirador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: [], weapons: ['w-cannon'],
};
const BRUISER: UnitDefinition = {
  id: 'bruiser', name: 'Melé', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 14, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'], weapons: [],
};
const DUMMY: UnitDefinition = {
  id: 'dummy', name: 'Blanco', role: 'tank', moveType: 'ground',
  stats: { maxHp: 120, atk: 1, energyAtk: 1, def: 10, energyDef: 10, speed: 1, move: 1, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'],
};
const WEAPONS: Record<string, WeaponDefinition> = {
  'w-cannon': { id: 'w-cannon', name: 'Cañón', abilityId: 'shock-cannon', costs: {}, magazine: 0, reserves: 0 },
};

function mk(spawns: BattleConfig['spawns'], catalog: Record<string, UnitDefinition>): Battle {
  return new Battle({ map: ARENA, unitCatalog: catalog, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS, seed: 5, spawns });
}
function untilTurnOf(battle: Battle, unitId: string): void {
  for (let i = 0; i < 60; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('IA táctica (mecánicas nuevas)', () => {
  it('remata al enemigo SUPRIMIDO antes que a uno intacto', () => {
    const battle = mk([
      { id: 'S', name: 'S', unitTypeId: 'gunner', team: 'player', position: { x: 1, y: 2 } },
      { id: 'E1', name: 'E1', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 2 } },
      { id: 'E2', name: 'E2', unitTypeId: 'dummy', team: 'enemy', position: { x: 4, y: 3 } },
    ], { gunner: GUNNER, dummy: DUMMY });
    untilTurnOf(battle, 'S');
    applyStatus(battle.unit('E2'), 'suprimido', 1); // el más lejano-en-orden, para que el sesgo mande
    const actions = planTurn(battle, battle.unit('S'));
    const shot = actions.find((a) => a.type === 'ability');
    expect(shot && shot.type === 'ability' ? shot.target : null).toEqual({ x: 4, y: 3 }); // E2, el suprimido
  });

  it('no termina su turno sobre el fuego: se aparta', () => {
    const battle = mk([
      { id: 'U', name: 'U', unitTypeId: 'bruiser', team: 'player', position: { x: 2, y: 2 } },
      { id: 'D', name: 'D', unitTypeId: 'dummy', team: 'enemy', position: { x: 7, y: 4 } }, // lejos: sin tiro
    ], { bruiser: BRUISER, dummy: DUMMY });
    untilTurnOf(battle, 'U');
    battle.map.ignite({ x: 2, y: 2 }, 3); // ardiendo bajo sus pies
    const actions = planTurn(battle, battle.unit('U'));
    const move = actions.find((a) => a.type === 'move');
    expect(move && move.type === 'move' ? battle.map.fireAt(move.to) : 1).toBe(0); // se mueve a casilla sin fuego
    expect(move && move.type === 'move' ? move.to : { x: 2, y: 2 }).not.toEqual({ x: 2, y: 2 });
  });

  it('sin fuego, la maniobra elige el mismo avance que antes (golden-safe)', () => {
    const battle = mk([
      { id: 'U', name: 'U', unitTypeId: 'bruiser', team: 'player', position: { x: 1, y: 2 } },
      { id: 'D', name: 'D', unitTypeId: 'dummy', team: 'enemy', position: { x: 7, y: 2 } },
    ], { bruiser: BRUISER, dummy: DUMMY });
    untilTurnOf(battle, 'U');
    const actions = planTurn(battle, battle.unit('U'));
    const move = actions.find((a) => a.type === 'move');
    // Avanza acercándose (minimiza distancia): de x=1 hacia x=7, move 4 → x=5.
    expect(move && move.type === 'move' ? move.to.x : 0).toBeGreaterThan(1);
  });
});

// ── Profundidad: coordinación de escuadra y emboscada ────────────────────
const AI_ABILITIES: Record<string, AbilityDefinition> = {
  ...ABILITIES,
  'ai-gun': {
    id: 'ai-gun', name: 'Fusil IA', description: 'Disparo de pruebas de alcance medio.',
    range: 5, minRange: 1, shape: 'single', aoeRadius: 0, accuracy: 90,
    targetsAllies: false, effects: [{ kind: 'damage', power: 30, damageType: 'physical' }],
  },
};
const AI_WEAPONS: Record<string, WeaponDefinition> = {
  'w-aigun': { id: 'w-aigun', name: 'Fusil IA', abilityId: 'ai-gun', costs: {}, magazine: 0, reserves: 0 },
};
const RANGER: UnitDefinition = {
  id: 'ranger', name: 'Fusilero', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 12, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: [], weapons: ['w-aigun'],
};
/** Francotirador defensivo: prefiere emboscar (baja agresión, poco móvil). */
const HOLDER: UnitDefinition = {
  ...RANGER, id: 'holder', name: 'Centinela',
  stats: { ...RANGER.stats, move: 3 },
  aiProfile: { aggression: 0.3, selfPreservation: 0.6, riskTolerance: 0.4 },
};
/** Arena ancha: deja hueco para que un centinela NO alcance a tiro este turno. */
const WIDE = GameMap.fromAscii([
  '000000000000',
  '000000000000',
  '000000000000',
  '000000000000',
  '000000000000',
]);
/** Cargador agresivo: siempre cierra distancia. */
const CHARGER: UnitDefinition = {
  id: 'charger', name: 'Cargador', role: 'skirmisher', moveType: 'ground',
  stats: { maxHp: 120, atk: 30, energyAtk: 30, def: 15, energyDef: 15, speed: 8, move: 4, jump: 1, evade: 0, accuracy: 0 },
  abilityIds: ['bite-crush'], aiProfile: { aggression: 0.85, selfPreservation: 0.3, riskTolerance: 0.7 },
};

function aiBattle(spawns: BattleConfig['spawns'], catalog: Record<string, UnitDefinition>, map = ARENA): Battle {
  return new Battle({ map, unitCatalog: catalog, abilityCatalog: AI_ABILITIES, weaponCatalog: AI_WEAPONS, seed: 5, spawns });
}

describe('IA profunda (coordinación y emboscada)', () => {
  it('concentra el fuego en la presa que más aliados alcanzan', () => {
    // E_A solo lo alcanza P1; E_B lo alcanzan P1 y P2 → foco de escuadra = E_B.
    const battle = aiBattle([
      { id: 'P1', name: 'P1', unitTypeId: 'ranger', team: 'player', position: { x: 1, y: 1 } },
      { id: 'P2', name: 'P2', unitTypeId: 'ranger', team: 'player', position: { x: 1, y: 4 } },
      { id: 'EA', name: 'EA', unitTypeId: 'dummy', team: 'enemy', position: { x: 5, y: 0 } }, // solo P1 llega
      { id: 'EB', name: 'EB', unitTypeId: 'dummy', team: 'enemy', position: { x: 3, y: 2 } }, // P1 y P2 llegan
    ], { ranger: RANGER, dummy: DUMMY });
    untilTurnOf(battle, 'P1');
    const actions = planTurn(battle, battle.unit('P1'));
    const shot = actions.find((a) => a.type === 'ability');
    // Aunque EA aparezca primero en la lista, el foco (EB, 2 tiradores) manda.
    expect(shot && shot.type === 'ability' ? shot.target : null).toEqual({ x: 3, y: 2 });
  });

  it('un centinela sin tiro embosca (vigilancia) al ver venir a un agresivo', () => {
    // H (move 3, alcance 5) no llega a C este turno (dist 9 > 3+5=8); C (move 4,
    // agresivo) sí cerrará (9 <= 5+4+1). El centinela se queda al acecho.
    const battle = aiBattle([
      { id: 'H', name: 'H', unitTypeId: 'holder', team: 'player', position: { x: 1, y: 2 } },
      { id: 'C', name: 'C', unitTypeId: 'charger', team: 'enemy', position: { x: 10, y: 2 } },
    ], { holder: HOLDER, charger: CHARGER }, WIDE);
    untilTurnOf(battle, 'H');
    const actions = planTurn(battle, battle.unit('H'));
    expect(actions[0]!.type).toBe('overwatch'); // se queda al acecho en vez de avanzar a ciegas
  });

  it('un agresivo NO embosca: cierra la distancia', () => {
    const battle = aiBattle([
      { id: 'C', name: 'C', unitTypeId: 'charger', team: 'player', position: { x: 1, y: 2 } },
      { id: 'H', name: 'H', unitTypeId: 'holder', team: 'enemy', position: { x: 10, y: 2 } },
    ], { holder: HOLDER, charger: CHARGER }, WIDE);
    untilTurnOf(battle, 'C');
    const actions = planTurn(battle, battle.unit('C'));
    expect(actions.some((a) => a.type === 'overwatch')).toBe(false);
    expect(actions.some((a) => a.type === 'move')).toBe(true);
  });
});
