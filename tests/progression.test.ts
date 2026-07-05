import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import {
  applyXp, awardXp, dominantTrack, newPilot, pilotModifiers, trackLevel,
  observeBattle,
} from '../src/core/progression.js';
import type { BattleEvent } from '../src/core/types.js';
import { GameMap } from '../src/core/grid.js';
import { PERKS } from '../src/data/progression.js';
import { ABILITIES } from '../src/data/abilities.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

describe('progresión: XP del piloto (el Zoid no gana nada)', () => {
  const roster = { U1: 'bit', U2: 'naomi' };
  const teams = { U1: 'player', U2: 'player', E1: 'enemy' } as const;
  const starts = { U1: { x: 0, y: 0 }, U2: { x: 0, y: 5 }, E1: { x: 1, y: 0 } };

  it('atribuye asalto en corto, tirador en largo, defensa al encajar', () => {
    const events: BattleEvent[] = [
      // U1 pega adyacente (dist 1 → asalto)
      { type: 'damage-dealt', unitId: 'U1', targetUnitId: 'E1', amount: 40, targetHp: 30 },
      // U2 dispara desde lejos (dist 6 → tirador)
      { type: 'damage-dealt', unitId: 'U2', targetUnitId: 'E1', amount: 30, targetHp: 0 },
      { type: 'unit-destroyed', unitId: 'E1' },
    ];
    const gains = awardXp(events, roster, teams, starts, 'player', new Set(['U1', 'U2']));
    const by = (p: string, t: string) => gains.find((g) => g.pilotId === p && g.track === t)?.amount ?? 0;
    expect(by('bit', 'assault')).toBe(20);      // 40 * 0.5
    expect(by('naomi', 'sniper')).toBe(45);     // 30*0.5 + 30 de baja
    expect(by('bit', 'defense')).toBe(40);      // superviviente ganador
    expect(by('naomi', 'defense')).toBe(40);
  });

  it('la XP se acumula, sube niveles por umbral y define pista dominante', () => {
    let pilots: Record<string, import("../src/core/progression.js").PilotState> = { bit: newPilot("bit", "Bit Cloud") };
    pilots = applyXp(pilots, [
      { pilotId: 'bit', track: 'assault', amount: 300 },
      { pilotId: 'bit', track: 'defense', amount: 120 },
    ]);
    expect(trackLevel(pilots.bit!.tracks.assault)).toBe(2); // ≥260
    expect(trackLevel(pilots.bit!.tracks.defense)).toBe(1); // ≥100
    expect(dominantTrack(pilots.bit!)).toBe('assault');
  });

  it("los perks y la sinergia entran por el pipeline de la batalla", async () => {
    const bit = newPilot('bit', 'Bit');
    bit.tracks.assault = 300; // nivel 2: atk+3/eAtk+3 y move+1
    const battle = new Battle({
      map: GameMap.fromAscii(['00000000']),
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      weaponCatalog: WEAPONS,
      moduleCatalog: (await import('../src/data/modules.js')).MODULES,
      pilots: { L: bit },
      perkTable: PERKS,
      seed: 3,
      spawns: [
        { id: 'L', name: 'Liger', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 0, y: 0 } },
        { id: 'M', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 7, y: 0 } },
      ],
    });
    const stats = battle.effectiveStats(battle.unit('L'));
    // Base 45 atk + perks(3) + sinergia (garra láser spec assault, dominante assault): +3
    expect(stats.atk).toBe(45 + 3 + 3);
    expect(stats.move).toBe(6 + 1);
    // La Molga sin piloto no recibe nada.
    expect(battle.effectiveStats(battle.unit('M')).atk).toBe(30);
  });

  it('buffar a OTRO aliado puntúa como soporte; a uno mismo no', () => {
    const events: BattleEvent[] = [
      { type: 'turn-started', unitId: 'A' },
      { type: 'ability-used', unitId: 'A', abilityId: 'smoke-discharger', target: { x: 1, y: 0 } },
      { type: 'status-applied', targetUnitId: 'B', status: 'evasion-up', duration: 3 },
      { type: 'turn-started', unitId: 'B' },
      { type: 'ability-used', unitId: 'B', abilityId: 'e-shield', target: { x: 1, y: 0 } },
      { type: 'status-applied', targetUnitId: 'B', status: 'armor-up', duration: 3 },
      // Un estado aplicado sin habilidad previa en el turno (p. ej. stun
      // por apagado térmico) no se atribuye a nadie.
      { type: 'turn-started', unitId: 'A' },
      { type: 'status-applied', targetUnitId: 'A', status: 'stunned', duration: 1 },
    ];
    const gains = awardXp(
      events,
      { A: 'p1', B: 'p2' },
      { A: 'player', B: 'player' },
      { A: { x: 0, y: 0 }, B: { x: 1, y: 0 } },
      undefined,
      new Set(),
    );
    expect(gains).toEqual([{ pilotId: 'p1', track: 'support', amount: 12 }]);
  });

  it('las manías se graban al cruzar umbrales y pilotan la máquina', () => {
    let pilot = newPilot('q', 'Quejica');
    // Dos apagados en batallas distintas → "Miedo al calor".
    const shutdownBattle: BattleEvent[] = [
      { type: 'turn-started', unitId: 'U' },
      { type: 'unit-shutdown', unitId: 'U', damage: 5, targetHp: 50 },
    ];
    let result = observeBattle(pilot, { events: shutdownBattle, unitId: 'U', finalHpRatio: 0.5 }, PERKS);
    expect(result.gained).toHaveLength(0);
    pilot = result.pilot;
    result = observeBattle(pilot, { events: shutdownBattle, unitId: 'U', finalHpRatio: 0.5 }, PERKS);
    expect(result.gained.map((q) => q.id)).toEqual(['miedo-al-calor']);
    pilot = result.pilot;
    expect(pilot.memory['apagados']).toBe(2);
    expect(pilot.quirks).toContain('miedo-al-calor');
    // La manía entra al pipeline del piloto.
    const mods = pilotModifiers(pilot, [], PERKS);
    expect(mods.some((m) => m.source === 'quirk:miedo-al-calor' && m.stat === 'accuracy' && m.add === -3)).toBe(true);
    // Es permanente y no se re-adquiere.
    result = observeBattle(pilot, { events: shutdownBattle, unitId: 'U', finalHpRatio: 0.5 }, PERKS);
    expect(result.gained).toHaveLength(0);
    // Sobrevivir con ≤20%% cuenta como roce; con la máquina destruida, no.
    result = observeBattle(pilot, { events: [], unitId: 'U', finalHpRatio: 0.1 }, PERKS);
    expect(result.pilot.memory['roces']).toBe(1);
    result = observeBattle(result.pilot, { events: [], unitId: 'U', finalHpRatio: 0 }, PERKS);
    expect(result.pilot.memory['roces']).toBe(1);
  });

  it('pilotModifiers respeta el tope de sinergia', () => {
    const ace = newPilot('a', 'As');
    ace.tracks.sniper = 150;
    const mods = pilotModifiers(ace, ['sniper', 'sniper', 'sniper'], PERKS);
    const synergies = mods.filter((m) => m.source === 'synergy:sniper');
    expect(synergies).toHaveLength(2); // cap 2
  });
});
