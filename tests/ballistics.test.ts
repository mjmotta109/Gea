import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { GameMap } from '../src/core/grid.js';
import { knockbackDestination } from '../src/core/physics.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

function artillery(map: GameMap, extraSpawns: Array<Record<string, unknown>> = []) {
  return new Battle({
    map,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    moduleCatalog: MODULES,
    weaponCatalog: WEAPONS,
    seed: 11,
    spawns: [
      { id: 'G', name: 'Gustav', unitTypeId: 'gustav', team: 'player', position: { x: 0, y: 0 }, commander: true },
      { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 3, y: 0 } },
      ...extraSpawns as never[],
    ],
  });
}

/** Avanza turnos (esperando) hasta que la unidad indicada tenga el turno. */
function until(battle: Battle, unitId: string): void {
  for (let i = 0; i < 60; i++) {
    if (battle.getActiveUnit()?.id === unitId) return;
    if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
    else battle.nextTurn();
  }
  throw new Error(`nunca llegó el turno de ${unitId}`);
}

describe('fase 4: balística', () => {
  it('disparar un arma con proyectil emite la trayectoria', () => {
    const battle = artillery(GameMap.fromAscii(['000000']));
    until(battle, 'G');
    const events = battle.execute({ type: 'ability', unitId: 'G', abilityId: 'shock-cannon', target: { x: 3, y: 0 } });
    const shot = events.find((e) => e.type === 'projectile-fired');
    expect(shot).toMatchObject({ weaponId: 'w-impact-cannon', from: { x: 0, y: 0 }, to: { x: 3, y: 0 } });
  });

  it('la dispersión degrada la puntería con la distancia', () => {
    const battle = artillery(GameMap.fromAscii(['0000000']), [
      { id: 'M2', name: 'Lejos', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
    ]);
    until(battle, 'G');
    const near = battle.attackPreview('G', 'shock-cannon', { x: 3, y: 0 })!;
    const far = battle.attackPreview('G', 'shock-cannon', { x: 4, y: 0 })!;
    // A 4 casillas pierde 2 de dispersión del arma Y 4 del bonus de
    // proximidad respecto a 3 casillas: acercarse paga por partida doble.
    expect(near.chance - far.chance).toBe(6);
  });

  it('un impacto masivo empuja al objetivo una casilla', () => {
    const battle = artillery(GameMap.fromAscii(['000000']));
    until(battle, 'G');
    for (let i = 0; i < 12 && battle.unit('M').position.x === 3; i++) {
      const events = battle.execute({ type: 'ability', unitId: 'G', abilityId: 'shock-cannon', target: battle.unit('M').position });
      if (events.some((e) => e.type === 'unit-pushed')) {
        expect(battle.unit('M').position).toEqual({ x: 4, y: 0 });
        return;
      }
      battle.execute({ type: 'wait', unitId: 'G' });
      // El turno de la Molga: la dejamos esperar para no mover el blanco.
      while (battle.getActiveUnit() && battle.getActiveUnit()!.id !== 'G') {
        battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
      }
      if (!battle.getActiveUnit()) battle.nextTurn();
      while (battle.getActiveUnit() && battle.getActiveUnit()!.id !== 'G') {
        battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
        if (!battle.getActiveUnit()) battle.nextTurn();
      }
      const g = battle.unit('G');
      const rifle = g.components.arsenal!.weapons[0]!;
      if (rifle.ammo === 0 && rifle.reserves > 0 && !g.hasActed) {
        battle.execute({ type: 'reload', unitId: 'G', weaponId: 'w-impact-cannon' });
        battle.execute({ type: 'wait', unitId: 'G' });
        if (!battle.getActiveUnit()) battle.nextTurn();
        while (battle.getActiveUnit() && battle.getActiveUnit()!.id !== 'G') {
          battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
          if (!battle.getActiveUnit()) battle.nextTurn();
        }
      }
    }
    throw new Error('nunca conectó un impacto con empuje');
  });

  it('knockbackDestination respeta muros, ocupantes y alturas', () => {
    const map = GameMap.fromAscii(['00#']);
    const victim = {
      id: 'V', name: 'V', unitTypeId: 'molga', team: 'enemy' as const, isCommander: false,
      position: { x: 1, y: 0 }, facing: 'east' as const, hp: 10, ct: 0,
      statuses: [], hasMoved: false, hasActed: false, size: 1, reactionReady: true, components: {},
    };
    expect(knockbackDestination(map, { x: 0, y: 0 }, victim, [victim])).toBeNull(); // muro detrás
    const open = GameMap.fromAscii(['0000']);
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim, [victim])).toEqual({ x: 2, y: 0 });
  });

  it('una explosión derriba muros y abre la línea de visión', () => {
    const battle = new Battle({
      map: GameMap.fromAscii(['000#00', '000000']),
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      moduleCatalog: MODULES,
      weaponCatalog: WEAPONS,
      seed: 5,
      spawns: [
        { id: 'GJ', name: 'Gojulas', unitTypeId: 'gojulas', team: 'player', position: { x: 0, y: 0 } },
        { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 5, y: 0 } },
      ],
    });
    until(battle, 'GJ');
    expect(battle.map.tileAt({ x: 3, y: 0 }).terrain).toBe('wall');
    // Batería de misiles (aoe 1) junto al muro.
    const events = battle.execute({ type: 'ability', unitId: 'GJ', abilityId: 'missile-pod', target: { x: 2, y: 0 } });
    expect(events.some((e) => e.type === 'terrain-destroyed')).toBe(true);
    expect(battle.map.tileAt({ x: 3, y: 0 }).terrain).toBe('rough');
  });
});

describe('fase 5: personalidad y mando', () => {
  it('perder al comandante degrada al equipo y emite el evento una vez', () => {
    const battle = artillery(GameMap.fromAscii(['0000']));
    const gustav = battle.unit('G');
    const before = battle.effectiveStats(battle.unit('G')).accuracy;
    expect(before).toBe(0);
    // Matamos al comandante por la vía del daño.
    until(battle, 'G');
    battle.execute({ type: 'wait', unitId: 'G' });
    gustav.hp = 1;
    while (battle.getActiveUnit()?.id !== 'M') {
      if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
      else battle.nextTurn();
    }
    battle.execute({ type: 'move', unitId: 'M', to: { x: 1, y: 0 } });
    let linkLost = 0;
    for (let i = 0; i < 20 && gustav.hp > 0; i++) {
      const events = battle.execute({ type: 'ability', unitId: 'M', abilityId: 'bite-crush', target: gustav.position });
      linkLost += events.filter((e) => e.type === 'command-link-lost').length;
      if (battle.isOver) break;
      if (gustav.hp > 0) {
        battle.execute({ type: 'wait', unitId: 'M' });
        while (!battle.isOver && battle.getActiveUnit()?.id !== 'M') {
          if (battle.getActiveUnit()) battle.execute({ type: 'wait', unitId: battle.getActiveUnit()!.id });
          else battle.nextTurn();
        }
      }
    }
    expect(gustav.hp).toBe(0);
    expect(linkLost).toBe(1);
  });

  it('los perfiles cambian el comportamiento: el agresivo avanza, el defensivo aguanta', async () => {
    const { planTurn } = await import('../src/ai/simpleAi.js');
    const aggressive = { ...ZOIDS['liger-zero']!, id: 'aggro' };
    const defensive = {
      ...ZOIDS['liger-zero']!, id: 'turtle',
      aiProfile: { aggression: 0.1, selfPreservation: 0.5, riskTolerance: 0.5 },
    };
    const mk = (typeId: string, catalog: Record<string, typeof aggressive>) => {
      const battle = new Battle({
        map: GameMap.fromAscii(['000000000000000000']),
        unitCatalog: catalog,
        abilityCatalog: ABILITIES,
        moduleCatalog: MODULES,
        seed: 2,
        spawns: [
          { id: 'A', name: 'A', unitTypeId: typeId, team: 'player', position: { x: 0, y: 0 } },
          { id: 'E', name: 'E', unitTypeId: 'molga', team: 'enemy', position: { x: 17, y: 0 } },
        ],
      });
      battle.nextTurn();
      return planTurn(battle, battle.unit('A'));
    };
    const aggroPlan = mk('aggro', { aggro: aggressive, molga: ZOIDS['molga']! });
    const turtlePlan = mk('turtle', { turtle: defensive, molga: ZOIDS['molga']! });
    expect(aggroPlan.some((a) => a.type === 'move')).toBe(true);   // avanza
    expect(turtlePlan.every((a) => a.type === 'wait')).toBe(true); // aguanta lejos
  });
});
