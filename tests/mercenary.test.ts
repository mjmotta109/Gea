import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import {
  buyWeapon, buyZoid, contractOffers, FULL_HP, mountedCount, newCampaign,
  rebuildZoid, repairCost, repairZoid, resolveContract, sellWeapon, setMountedWeapons,
} from '../src/game/mercenary.js';
import { ABILITIES } from '../src/data/abilities.js';
import { CONTRACT_ENEMY_POOL, ECONOMY } from '../src/data/economy.js';
import { VALLEY_CROSSING } from '../src/data/maps.js';
import { WEAPONS } from '../src/data/weapons.js';
import { ZOIDS } from '../src/data/zoids.js';

const factoryLoadout = (unitTypeId: string) => ({
  weapons: [...(ZOIDS[unitTypeId]!.weapons ?? [])],
  slots: {},
});

const fresh = () => newCampaign(ECONOMY, factoryLoadout);

describe('modo mercenario: campaña', () => {
  it('la campaña nueva tiene el hangar inicial y sus armas de fábrica en propiedad', () => {
    const state = fresh();
    expect(state.credits).toBe(ECONOMY.startingCredits);
    expect(state.roster.map((z) => z.unitTypeId)).toEqual(ECONOMY.starterRoster);
    // El Gustav trae su cañón de impacto: debe constar en el arsenal.
    expect(state.armory['w-impact-cannon']).toBe(1);
    expect(state.armory['w-sniper-rifle']).toBe(1);
  });

  it('las ofertas de contrato son deterministas y escalan por dificultad', () => {
    const a = contractOffers(5, ECONOMY, CONTRACT_ENEMY_POOL);
    const b = contractOffers(5, ECONOMY, CONTRACT_ENEMY_POOL);
    expect(a).toEqual(b);
    expect(a.map((c) => c.tier)).toEqual(['escolta', 'asalto', 'caza']);
    const squadPrice = (squad: string[]): number =>
      squad.reduce((n, id) => n + ECONOMY.zoidPrices[id]!, 0);
    expect(squadPrice(a[1]!.enemySquad)).toBeGreaterThan(squadPrice(a[0]!.enemySquad));
    expect(squadPrice(a[2]!.enemySquad)).toBeGreaterThan(squadPrice(a[1]!.enemySquad));
    for (const contract of a) {
      expect(contract.enemySquad).toHaveLength(4);
      for (const id of contract.enemySquad) expect(ZOIDS[id]).toBeDefined();
    }
    // Ciclos distintos ofrecen contratos distintos.
    expect(contractOffers(6, ECONOMY, CONTRACT_ENEMY_POOL)).not.toEqual(a);
  });

  it('resolver un contrato paga, persiste el daño y marca las bajas', () => {
    const state = fresh();
    const contract = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL)[0]!;
    const { state: after, report } = resolveContract(state, contract, {
      winner: 'player',
      finalHp: [80, 0, 55, undefined],
      enemiesDestroyed: 3,
    });
    expect(report.rewardPaid).toBe(true);
    expect(report.creditsEarned).toBe(contract.reward + 3 * contract.salvagePerKill);
    expect(after.credits).toBe(state.credits + report.creditsEarned);
    expect(after.roster[0]!.hp).toBe(80);
    expect(after.roster[1]!.destroyed).toBe(true);
    expect(report.lost).toEqual([state.roster[1]!.unitTypeId]);
    expect(after.roster[3]).toEqual(state.roster[3]); // no desplegado
    expect(after.contractsDone).toBe(1);
    // Derrota: solo chatarra.
    const loss = resolveContract(state, contract, {
      winner: 'enemy', finalHp: [10, 0, 0, 0], enemiesDestroyed: 1,
    });
    expect(loss.report.creditsEarned).toBe(contract.salvagePerKill);
  });

  it('taller: reparar cuesta por HP perdido y reconstruir revive al destruido', () => {
    let state = fresh();
    state = { ...state, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 100 } : z)) };
    const maxHp = 140;
    expect(repairCost(state.roster[0]!, maxHp, ECONOMY)).toBe(40 * ECONOMY.repairCostPerHp);
    const repaired = repairZoid(state, 0, maxHp, ECONOMY);
    expect(repaired.roster[0]!.hp).toBe(maxHp);
    expect(repaired.credits).toBe(state.credits - 40 * ECONOMY.repairCostPerHp);
    // Sin crédito: sin cambios.
    const broke = repairZoid({ ...state, credits: 10 }, 0, maxHp, ECONOMY);
    expect(broke).toEqual({ ...state, credits: 10 });
    // Reconstrucción.
    let wrecked = { ...state, roster: state.roster.map((z, i) => (i === 0 ? { ...z, hp: 0, destroyed: true } : z)) };
    wrecked = rebuildZoid(wrecked, 0, maxHp, ECONOMY);
    expect(wrecked.roster[0]!.destroyed).toBe(false);
    expect(wrecked.roster[0]!.hp).toBe(maxHp);
  });

  it('tienda: comprar armas, no vender lo montado, y validar montajes', () => {
    let state = fresh();
    state = buyWeapon(state, 'lib-w-heat-needle', ECONOMY);
    expect(state.armory['lib-w-heat-needle']).toBe(1);
    expect(state.credits).toBe(ECONOMY.startingCredits - ECONOMY.weaponPrices['lib-w-heat-needle']!);
    // Montarla en el hueco 0.
    state = setMountedWeapons(state, 0, ['lib-w-heat-needle']);
    expect(state.roster[0]!.weapons).toEqual(['lib-w-heat-needle']);
    expect(mountedCount(state, 'lib-w-heat-needle')).toBe(1);
    // Montada: no se puede vender.
    expect(sellWeapon(state, 'lib-w-heat-needle', ECONOMY)).toEqual(state);
    // No se puede montar una segunda unidad que no se posee.
    expect(setMountedWeapons(state, 1, ['lib-w-heat-needle'])).toEqual(state);
    // Desmontar y vender sí.
    state = setMountedWeapons(state, 0, []);
    const sold = sellWeapon(state, 'lib-w-heat-needle', ECONOMY);
    expect(sold.armory['lib-w-heat-needle']).toBe(0);
    expect(sold.credits).toBe(state.credits + Math.round(ECONOMY.weaponPrices['lib-w-heat-needle']! * ECONOMY.sellFactor));
  });

  it('cambiar de chasis descuenta la retoma y devuelve las armas al arsenal', () => {
    const state = fresh();
    const maxHp = 140; // liger-zero de fábrica
    const after = buyZoid(state, 0, 'zaber-fang', maxHp, ECONOMY, factoryLoadout);
    const tradeIn = Math.round(ECONOMY.zoidPrices['liger-zero']! * ECONOMY.sellFactor * Math.min(1, state.roster[0]!.hp / maxHp));
    expect(after.credits).toBe(state.credits - (ECONOMY.zoidPrices['zaber-fang']! - tradeIn));
    expect(after.roster[0]!.unitTypeId).toBe('zaber-fang');
    // El chasis nuevo llega sin armas montadas: se montan del arsenal.
    expect(after.roster[0]!.weapons).toEqual([]);
  });
});

describe('motor: UnitSpawn.hp (daño persistente)', () => {
  const mk = (hp?: number) => new Battle({
    map: VALLEY_CROSSING,
    unitCatalog: ZOIDS,
    abilityCatalog: ABILITIES,
    weaponCatalog: WEAPONS,
    seed: 7,
    spawns: [
      { id: 'P1', name: 'Wolf', unitTypeId: 'command-wolf', team: 'player', position: { x: 1, y: 3 }, hp },
      { id: 'E1', name: 'Molga', unitTypeId: 'molga', team: 'enemy', position: { x: 10, y: 3 } },
    ],
  });

  it('despliega con el HP indicado, acotado a [1, maxHp]', () => {
    expect(mk(40).unit('P1').hp).toBe(40);
    expect(mk(undefined).unit('P1').hp).toBe(100);
    expect(mk(FULL_HP).unit('P1').hp).toBe(100); // centinela del mercenario
    expect(mk(-5).unit('P1').hp).toBe(1);
  });
});
