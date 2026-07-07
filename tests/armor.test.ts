import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';
import { ECONOMY } from '../src/data/economy.js';
import {
  armorRepairCost, newCampaign, reinforceArmor, reinforcementModifiers,
  repairArmor, resolveContract, stripReinforcement, type Contract,
} from '../src/game/mercenary.js';

// ── Motor: el búnker de blindaje absorbe antes que el casco ──────────────

describe('motor: blindaje de refuerzo (búnker a nivel de máquina)', () => {
  it('absorbe el daño antes que el HP y se gasta', () => {
    const battle = new Battle({
      map: FLAT_ARENA, unitCatalog: ZOIDS, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS,
      moduleCatalog: MODULES, seed: 3,
      spawns: [
        { id: 'A', name: 'a', unitTypeId: 'molga', team: 'player', position: { x: 1, y: 1 }, armor: 200 },
        { id: 'B', name: 'b', unitTypeId: 'molga', team: 'enemy', position: { x: 2, y: 1 }, armor: 200 },
      ],
    });
    const maxB = battle.effectiveStats(battle.unit('B')).maxHp;
    let armorHitOnB = false;
    for (let i = 0; i < 40 && !armorHitOnB; i++) {
      if (battle.isOver) break;
      battle.nextTurn();
      const active = battle.getActiveUnit();
      if (!active) break;
      const foe = active.id === 'A' ? 'B' : 'A';
      const evs = battle.execute({ type: 'ability', unitId: active.id, abilityId: 'bite-crush', target: battle.unit(foe).position });
      if (evs.some((e) => e.type === 'unit-armor-damaged' && e.unitId === 'B')) armorHitOnB = true;
      if (battle.getActiveUnit()?.id === active.id) battle.execute({ type: 'wait', unitId: active.id });
    }
    expect(armorHitOnB).toBe(true);
    expect(battle.unit('B').armor!).toBeLessThan(200); // el búnker se gastó
    expect(battle.unit('B').hp).toBe(maxB);            // el casco, intacto
  });

  it('a wear/armor 0 el motor se comporta igual (golden intacto): sin blindaje, sin absorción', () => {
    const b = new Battle({
      map: FLAT_ARENA, unitCatalog: ZOIDS, abilityCatalog: ABILITIES, weaponCatalog: WEAPONS,
      moduleCatalog: MODULES, seed: 1,
      spawns: [{ id: 'U', name: 'u', unitTypeId: 'molga', team: 'player', position: { x: 1, y: 1 } }],
    });
    expect(b.unit('U').armor).toBe(0); // sin refuerzo por defecto
  });
});

// ── Campaña: montar, gastar y reparar el refuerzo en el taller ───────────

const base = () => newCampaign(ECONOMY, () => ({ weapons: [], slots: {} }));
const CONTRACT: Contract = { id: 'c', name: 'c', tier: 'asalto', enemySquad: [], reward: 0, salvagePerKill: 0 };

describe('campaña: refuerzo de blindaje (aguante a cambio de velocidad)', () => {
  it('reforzar monta el búnker, cobra y frena', () => {
    const s0 = base();
    const s1 = reinforceArmor(s0, 1, ECONOMY);
    expect(s1.roster[1]!.reinforced).toBe(true);
    expect(s1.roster[1]!.armor).toBe(ECONOMY.reinforcement.armor);
    expect(s1.credits).toBe(s0.credits - ECONOMY.reinforcement.fitCost);
    const mods = reinforcementModifiers(ECONOMY);
    expect(mods.find((m) => m.stat === 'move')!.add!).toBeLessThan(0);  // más lento
    expect(mods.find((m) => m.stat === 'speed')!.add!).toBeLessThan(0);
    expect(reinforceArmor(s1, 1, ECONOMY)).toEqual(s1); // ya reforzada: sin cambios
  });

  it('reparar el blindaje gastado cuesta por punto y lo deja a tope', () => {
    let s = reinforceArmor(base(), 1, ECONOMY);
    s = { ...s, roster: s.roster.map((z, i) => (i === 1 ? { ...z, armor: 10 } : z)) };
    const cost = armorRepairCost(s.roster[1]!, ECONOMY); // (30-10)*3
    expect(cost).toBe(60);
    const r = repairArmor(s, 1, ECONOMY);
    expect(r.roster[1]!.armor).toBe(ECONOMY.reinforcement.armor);
    expect(r.credits).toBe(s.credits - cost);
    expect(armorRepairCost(base().roster[1]!, ECONOMY)).toBe(0); // sin refuerzo, nada que reparar
  });

  it('quitar el refuerzo recupera velocidad y no reembolsa', () => {
    const s = reinforceArmor(base(), 1, ECONOMY);
    const stripped = stripReinforcement(s, 1);
    expect(stripped.roster[1]!.reinforced).toBeFalsy();
    expect(stripped.roster[1]!.armor).toBe(0);
    expect(stripped.credits).toBe(s.credits); // sin reembolso
  });

  it('el blindaje gastado en batalla persiste (se repara en el taller)', () => {
    const s = reinforceArmor(base(), 1, ECONOMY);
    const { state } = resolveContract(s, CONTRACT, {
      winner: 'player', finalHp: [100, 100, 100, 100], finalArmor: [undefined, 12, undefined, undefined], enemiesDestroyed: 0,
    });
    expect(state.roster[1]!.armor).toBe(12); // gastó de 30 a 12; el resto, al taller
  });
});
