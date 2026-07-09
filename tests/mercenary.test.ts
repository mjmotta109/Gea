import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import {
  buyWeapon, buyZoid, campaignStrength, contractOffers, counterRoles, counterWeapons, FULL_HP, mountedCount,
  newCampaign, readStyle, rebuildZoid, refitZoid, repairCost, repairZoid, resolveContract,
  sellWeapon, setMountedWeapons, updateDossier,
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
    expect(a.map((c) => c.tier)).toEqual(['escolta', 'asalto', 'caza', 'incursion', 'defensa']);
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

  it('continuidad: el superviviente arrastra calor/energía/munición residuales', () => {
    const state = fresh();
    const contract = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL)[0]!;
    const { state: after } = resolveContract(state, contract, {
      winner: 'player',
      finalHp: [80, 0, 55, undefined],
      finalHeat: [42, undefined, undefined, undefined],
      finalEnergy: [12, undefined, undefined, undefined],
      finalAmmo: [{ 'w-x': 1 }, undefined, undefined, undefined],
      enemiesDestroyed: 2,
    });
    // Superviviente: guarda su estado residual.
    expect(after.roster[0]!.residualHeat).toBe(42);
    expect(after.roster[0]!.residualEnergy).toBe(12);
    expect(after.roster[0]!.ammo).toEqual({ 'w-x': 1 });
    // Sin residual reportado: queda a estrenar (undefined), no fantasma.
    expect(after.roster[2]!.residualHeat).toBeUndefined();
    // No desplegado: intacto.
    expect(after.roster[3]).toEqual(state.roster[3]);
  });

  it('continuidad: un contrato posterior SIN residual borra el viejo (no arrastra fantasma)', () => {
    const state = fresh();
    const contract = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL)[0]!;
    const hot = resolveContract(state, contract, {
      winner: 'player', finalHp: [90, 100, 100, 100],
      finalHeat: [30, undefined, undefined, undefined], enemiesDestroyed: 0,
    }).state;
    expect(hot.roster[0]!.residualHeat).toBe(30);
    // Otra batalla con este chasis ya sin componente de calor reportado.
    const cool = resolveContract(hot, contract, {
      winner: 'player', finalHp: [88, 100, 100, 100], enemiesDestroyed: 0,
    }).state;
    expect(cool.roster[0]!.residualHeat).toBeUndefined();
  });

  it('el dosier acumula y readStyle detecta el estilo dominante (con muestra)', () => {
    expect(readStyle(undefined)).toBe('balanced');
    // Una sola batalla no basta: sin muestra, no se adapta.
    let d = updateDossier(undefined, { melee: 5, ranged: 1, overclocks: 0 });
    expect(readStyle(d)).toBe('balanced');
    d = updateDossier(d, { melee: 5, ranged: 1, overclocks: 0 });
    expect(readStyle(d)).toBe('melee'); // 10/12 golpes de cerca
    let r = updateDossier(undefined, { melee: 1, ranged: 6, overclocks: 0 });
    r = updateDossier(r, { melee: 1, ranged: 6, overclocks: 0 });
    expect(readStyle(r)).toBe('ranged');
    let o = updateDossier(undefined, { melee: 2, ranged: 2, overclocks: 3 });
    o = updateDossier(o, { melee: 2, ranged: 2, overclocks: 2 });
    expect(readStyle(o)).toBe('reactor'); // 5 sobrecargas / 2 batallas
  });

  it('counterRoles mapea el estilo a roles que lo contrarrestan', () => {
    expect(counterRoles('melee')).toContain('sniper'); // kiters castigan el rush
    expect(counterRoles('ranged')).toContain('assault'); // cerradores
    expect(counterRoles('balanced')).toEqual([]);
  });

  it('counterWeapons arma a la facción contra tu estilo (contra por arma)', () => {
    // Reactor abusón → lanzallamas que cuecen el reactor.
    expect(counterWeapons('reactor')).toContain('lib-w-plasma-flamer');
    // Melee → supresor que te fija al cargar.
    expect(counterWeapons('melee')).toContain('lib-w-suppressor');
    expect(counterWeapons('balanced')).toEqual([]);
  });

  it('contractOffers sesga la escuadra hacia el rol pesado, y es determinista', () => {
    const roleOf = (id: string) => ZOIDS[id]!.role;
    const heavyOnSnipers = (id: string) => (roleOf(id) === 'sniper' ? 10 : 1);
    const countSnipers = (cs: ReturnType<typeof contractOffers>) =>
      cs.reduce((n, c) => n + c.enemySquad.filter((id) => roleOf(id) === 'sniper').length, 0);
    const uniform = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL);
    const biased = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL, heavyOnSnipers);
    expect(countSnipers(biased)).toBeGreaterThanOrEqual(countSnipers(uniform));
    expect(countSnipers(biased)).toBeGreaterThan(0);
    // Determinista: misma llamada → mismo resultado.
    expect(contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL, heavyOnSnipers)).toEqual(biased);
    // Sin sesgo, idéntico a la generación de siempre (retro-compatible).
    expect(contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL)).toEqual(uniform);
  });

  it('campaignStrength es una glide ancha: floja al empezar, sin meseta, con techo', () => {
    // Arranca por debajo del presupuesto nominal (final gentil de la rampa).
    expect(campaignStrength(0)).toBeLessThan(0.6);
    // Nominal (~1) hacia el contrato 20; monótona creciente por el camino.
    expect(campaignStrength(20)).toBeGreaterThan(0.9);
    expect(campaignStrength(20)).toBeLessThan(1.1);
    for (let c = 0; c < 60; c++) {
      expect(campaignStrength(c + 1)).toBeGreaterThanOrEqual(campaignStrength(c));
    }
    // Sin meseta temprana: el final (c40) aprieta más que la mitad (c20).
    expect(campaignStrength(40)).toBeGreaterThan(campaignStrength(20) + 0.25);
    // Techo acotado (no se dispara en campañas larguísimas).
    expect(campaignStrength(1000)).toBeLessThanOrEqual(1.6);
  });

  it('la FUERZA compra chasis mejores: un contrato rico trae élites, no chatarra', () => {
    const squadPrice = (squad: string[]): number =>
      squad.reduce((n, id) => n + ECONOMY.zoidPrices[id]!, 0);
    const flojo = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL, undefined, 0.55);
    const fuerte = contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL, undefined, 1.6);
    // Más fuerza ⇒ escuadra más cara en cada tramo (el presupuesto SE GASTA).
    for (let t = 0; t < flojo.length; t++) {
      expect(squadPrice(fuerte[t]!.enemySquad)).toBeGreaterThan(squadPrice(flojo[t]!.enemySquad));
      expect(fuerte[t]!.enemySquad).toHaveLength(4);
    }
    // Determinista con fuerza fija.
    expect(contractOffers(0, ECONOMY, CONTRACT_ENEMY_POOL, undefined, 1.6)).toEqual(fuerte);
  });

  it('refitZoid enfría/reabastece: limpia el residual y no toca HP ni blindaje', () => {
    const hot = { unitTypeId: 'liger-zero', hp: 70, destroyed: false, weapons: [], slots: {},
      reinforced: true, armor: 5, residualHeat: 40, residualEnergy: 3, ammo: { 'w-x': 0 } };
    const cool = refitZoid(hot);
    expect(cool.residualHeat).toBeUndefined();
    expect(cool.residualEnergy).toBeUndefined();
    expect(cool.ammo).toBeUndefined();
    expect(cool.hp).toBe(70);        // HP no lo toca el refit
    expect(cool.armor).toBe(5);      // el blindaje tampoco
    // Sin residual, devuelve el mismo objeto (sin trabajo).
    expect(refitZoid(cool)).toBe(cool);
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
