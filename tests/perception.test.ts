import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { GameMap } from '../src/core/grid.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

/** Pasillo llano con un muro/colina central configurable. */
function corridor(middle: string) {
  return new Battle({
    map: GameMap.fromAscii([`00${middle}00`, '00000', '00000']),
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    // El rifle del gun-sniper es un arma montada desde el ciclo de
    // balance del hangar (antes era habilidad innata).
    weaponCatalog: WEAPONS,
    seed: 9,
    spawns: [
      // Gun sniper clásico: rifle en línea, alcance 3-7.
      { id: 'P1', name: 'Sniper', unitTypeId: 'gun-sniper', team: 'player', position: { x: 0, y: 0 } },
      { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
    ],
  });
}

describe('fase 3: línea de visión en combate', () => {
  it('un muro entre medias elimina el objetivo de legalTargets', () => {
    const blocked = corridor('#');
    blocked.nextTurn();
    const targets = blocked.legalTargets('P1', 'sniper-rifle');
    expect(targets.some((p) => p.x === 4 && p.y === 0)).toBe(false);

    const open = corridor('0');
    open.nextTurn();
    expect(open.legalTargets('P1', 'sniper-rifle').some((p) => p.x === 4 && p.y === 0)).toBe(true);
  });

  it('canTargetFrom evalúa posiciones hipotéticas con LOS', () => {
    const battle = corridor('#');
    battle.nextTurn();
    const sniper = battle.unit('P1');
    // Desde su casilla: bloqueado. Desde la fila de abajo: el muro ya no
    // está en la línea... pero el rifle exige alineación en línea recta,
    // así que desde (0,1) no puede apuntar a (4,0).
    expect(battle.canTargetFrom(sniper, { x: 0, y: 0 }, 'sniper-rifle', { x: 4, y: 0 })).toBe(false);
    expect(battle.canTargetFrom(sniper, { x: 0, y: 1 }, 'sniper-rifle', { x: 4, y: 0 })).toBe(false);
    // Desde (0,1) hacia un objetivo alineado en su fila sí (si hubiera).
    expect(battle.canTargetFrom(sniper, { x: 0, y: 1 }, 'sniper-rifle', { x: 4, y: 1 })).toBe(true);
  });
});

describe('fase 3: cobertura por terreno', () => {
  it('el bosque del defensor reduce la probabilidad de impacto en 20', () => {
    const battle = new Battle({
      // (4,0) es bosque; (4,1) llanura.
      map: GameMap.fromAscii(['0000A', '00000']),
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      seed: 9,
      spawns: [
        { id: 'P1', name: 'Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 0 } },
        { id: 'E1', name: 'Molga en bosque', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
        { id: 'E2', name: 'Molga expuesta', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 1 } },
      ],
    });
    battle.nextTurn();
    const inForest = battle.attackPreview('P1', 'shock-cannon', { x: 4, y: 0 })!;
    const exposed = battle.attackPreview('P1', 'shock-cannon', { x: 4, y: 1 })!;
    expect(inForest.cover).toBe(20);
    expect(exposed.cover).toBe(0);
    expect(exposed.chance - inForest.chance).toBe(20);
  });

  it('attackPreview coincide con lo que resuelve el combate', () => {
    // Determinismo cruzado: el pronóstico no consume RNG ni muta nada.
    const battle = corridor('0');
    battle.nextTurn();
    const before = battle.attackPreview('P1', 'sniper-rifle', { x: 4, y: 0 })!;
    const again = battle.attackPreview('P1', 'sniper-rifle', { x: 4, y: 0 })!;
    expect(before).toEqual(again);
    const events = battle.execute({
      type: 'ability', unitId: 'P1', abilityId: 'sniper-rifle', target: { x: 4, y: 0 },
    });
    const dmg = events.find((e) => e.type === 'damage-dealt');
    if (dmg && dmg.type === 'damage-dealt') {
      expect(dmg.amount).toBeGreaterThanOrEqual(before.min);
      expect(dmg.amount).toBeLessThanOrEqual(before.max);
    }
  });
});

describe('fase 3: clima', () => {
  it('la lluvia acelera la disipación de calor un 50%', async () => {
    const { GameMap } = await import('../src/core/grid.js');
    const { WEAPONS } = await import('../src/data/weapons.js');
    const { MODULES } = await import('../src/data/modules.js');
    const mk = (weather: 'clear' | 'rain') => new Battle({
      map: GameMap.fromAscii(['00000']),
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      weaponCatalog: WEAPONS,
      moduleCatalog: MODULES,
      weather,
      seed: 3,
      spawns: [
        { id: 'G', name: 'Geno', unitTypeId: 'geno-saurer-cp', team: 'player', position: { x: 0, y: 0 } },
        { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
      ],
    });
    for (const [weather, expected] of [['clear', 15], ['rain', 23]] as Array<['clear' | 'rain', number]>) {
      const battle = mk(weather);
      battle.nextTurn(); // Geno (speed 12) actúa primero
      const geno = battle.unit('G');
      geno.components.heat!.current = 40;
      battle.execute({ type: 'wait', unitId: 'G' });
      expect(40 - geno.components.heat!.current).toBe(expected);
    }
  });

  it('la tormenta de arena resta 10 de puntería solo a más de 2 casillas', async () => {
    const { GameMap } = await import('../src/core/grid.js');
    const mk = (weather: 'clear' | 'sandstorm') => {
      const battle = new Battle({
        map: GameMap.fromAscii(['000000']),
        unitCatalog: ZOIDS,
        abilityCatalog: ABILITIES,
        weather,
        seed: 3,
        spawns: [
          { id: 'W', name: 'Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 0, y: 0 } },
          { id: 'M1', name: 'Cerca', unitTypeId: 'molga', team: 'enemy', position: { x: 2, y: 0 } },
          { id: 'M2', name: 'Lejos', unitTypeId: 'molga', team: 'enemy', position: { x: 4, y: 0 } },
        ],
      });
      battle.nextTurn();
      return battle;
    };
    const clear = mk('clear');
    const storm = mk('sandstorm');
    // A 2 casillas: sin penalización.
    expect(storm.attackPreview('W', 'shock-cannon', { x: 2, y: 0 })!.chance)
      .toBe(clear.attackPreview('W', 'shock-cannon', { x: 2, y: 0 })!.chance);
    // A 4 casillas: -10.
    expect(clear.attackPreview('W', 'shock-cannon', { x: 4, y: 0 })!.chance
      - storm.attackPreview('W', 'shock-cannon', { x: 4, y: 0 })!.chance).toBe(10);
    expect(storm.attackPreview('W', 'shock-cannon', { x: 4, y: 0 })!.weatherPenalty).toBe(10);
  });
});
