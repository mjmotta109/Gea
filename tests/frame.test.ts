import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import {
  applyDamageToModule,
  buildFrameState,
  deriveUnitHp,
  frameModifiers,
  repairFrame,
  rollHitLocation,
  type ModuleCatalog,
} from '../src/core/frame.js';
import { Rng } from '../src/core/rng.js';
import type { UnitDefinition } from '../src/core/types.js';
import { FLAT_ARENA } from '../src/data/maps.js';
import { ABILITIES } from '../src/data/abilities.js';

/** Catálogo de pruebas: un mecha genérico de 4 módulos. */
const TEST_MODULES: ModuleCatalog = {
  'test-torso': {
    id: 'test-torso', name: 'Torso', hp: 40, armor: 2, weight: 30, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: ['high-profile'],
  },
  'test-head': {
    id: 'test-head', name: 'Cabeza', hp: 10, armor: 0, weight: 5, hitWeight: 10,
    critical: false,
    contributions: [{ source: 'module:head', stat: 'evade', add: 5 }],
    onDestroyed: [{ source: 'module:head', stat: 'accuracy', add: -25 }],
    tags: ['high-profile', 'sensor'],
  },
  'test-legs': {
    id: 'test-legs', name: 'Piernas', hp: 20, armor: 1, weight: 20, hitWeight: 30,
    critical: false,
    contributions: [{ source: 'module:legs', stat: 'move', add: 3 }],
    onDestroyed: [],
    tags: ['low-profile', 'locomotion'],
  },
  'test-gun': {
    id: 'test-gun', name: 'Cañón', hp: 10, armor: 0, weight: 10, hitWeight: 20,
    critical: false,
    contributions: [{ source: 'module:gun', stat: 'atk', add: 20 }],
    onDestroyed: [],
    tags: ['weapon', 'rear-exposed'],
  },
};

const TEST_FRAME = [
  { slot: 'torso', moduleId: 'test-torso' },
  { slot: 'head', moduleId: 'test-head' },
  { slot: 'legs', moduleId: 'test-legs' },
  { slot: 'gun', moduleId: 'test-gun' },
];

const TEST_MECH: UnitDefinition = {
  id: 'test-mech',
  name: 'Mecha de pruebas',
  role: 'assault',
  moveType: 'ground',
  stats: {
    maxHp: 80, atk: 20, energyAtk: 20, def: 10, energyDef: 10,
    speed: 10, move: 2, jump: 1, evade: 5, accuracy: 0,
  },
  abilityIds: ['bite-crush', 'repair-drones'],
  frame: TEST_FRAME,
};

function framedBattle() {
  return new Battle({
    map: FLAT_ARENA,
    unitCatalog: { 'test-mech': TEST_MECH },
    abilityCatalog: ABILITIES,
    moduleCatalog: TEST_MODULES,
    seed: 42,
    spawns: [
      { id: 'A', name: 'Alfa', unitTypeId: 'test-mech', team: 'player', position: { x: 1, y: 1 } },
      { id: 'B', name: 'Beta', unitTypeId: 'test-mech', team: 'enemy', position: { x: 2, y: 1 } },
    ],
  });
}

describe('frame: construcción y stats', () => {
  it('el frame aporta contribuciones al pipeline mientras está intacto', () => {
    const battle = framedBattle();
    const stats = battle.effectiveStats(battle.unit('A'));
    expect(stats.move).toBe(5);   // 2 base + 3 piernas
    expect(stats.evade).toBe(10); // 5 base + 5 cabeza
    expect(stats.atk).toBe(40);   // 20 base + 20 cañón
  });

  it('un módulo destruido pierde su contribución y aplica onDestroyed', () => {
    const battle = framedBattle();
    const frame = battle.unit('A').components.frame!;
    const legs = frame.modules.find((m) => m.slot === 'legs')!;
    legs.hp = 0;
    legs.destroyed = true;
    const head = frame.modules.find((m) => m.slot === 'head')!;
    head.hp = 0;
    head.destroyed = true;

    const stats = battle.effectiveStats(battle.unit('A'));
    expect(stats.move).toBe(2);       // sin piernas
    expect(stats.evade).toBe(5);      // sin cabeza
    expect(stats.accuracy).toBe(0 - 25); // penalización extra de la cabeza
  });

  it('rechaza definiciones cuyo maxHp no cuadra con los módulos', () => {
    const badDef = { ...TEST_MECH, stats: { ...TEST_MECH.stats, maxHp: 999 } };
    expect(() => new Battle({
      map: FLAT_ARENA,
      unitCatalog: { 'test-mech': badDef },
      abilityCatalog: ABILITIES,
      moduleCatalog: TEST_MODULES,
      seed: 1,
      spawns: [{ id: 'A', name: 'A', unitTypeId: 'test-mech', team: 'player', position: { x: 0, y: 0 } }],
    })).toThrow(/no coincide/);
  });
});

describe('frame: localización de impactos', () => {
  it('nunca elige módulos destruidos y respeta los pesos', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const gun = frame.modules.find((m) => m.slot === 'gun')!;
    gun.destroyed = true;
    const rng = new Rng(7);
    const hits: Record<string, number> = {};
    for (let i = 0; i < 500; i++) {
      const hit = rollHitLocation(frame, TEST_MODULES, 'front', 0, rng);
      hits[hit.slot] = (hits[hit.slot] ?? 0) + 1;
    }
    expect(hits['gun']).toBeUndefined();
    // El torso (peso 40) recibe más que la cabeza (peso 10).
    expect(hits['torso']!).toBeGreaterThan(hits['head']!);
  });

  it('atacar por la espalda expone los módulos rear-exposed', () => {
    const countGunHits = (arc: 'front' | 'back'): number => {
      const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
      const rng = new Rng(7);
      let count = 0;
      for (let i = 0; i < 1000; i++) {
        if (rollHitLocation(frame, TEST_MODULES, arc, 0, rng).slot === 'gun') count++;
      }
      return count;
    };
    expect(countGunHits('back')).toBeGreaterThan(countGunHits('front'));
  });

  it('es determinista con la misma semilla', () => {
    const roll = () => {
      const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
      const rng = new Rng(99);
      return Array.from({ length: 20 }, () => rollHitLocation(frame, TEST_MODULES, 'front', 1, rng).slot);
    };
    expect(roll()).toEqual(roll());
  });
});

describe('frame: daño localizado', () => {
  it('la armadura del módulo reduce el daño (mínimo 1)', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const legs = frame.modules.find((m) => m.slot === 'legs')!;
    applyDamageToModule(frame, TEST_MODULES, legs, 10, 'X'); // 10 - 1 armor = 9
    expect(legs.hp).toBe(11);
  });

  it('la mitad del exceso desborda al módulo crítico, menos su armadura', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const head = frame.modules.find((m) => m.slot === 'head')!;
    const torso = frame.modules.find((m) => m.slot === 'torso')!;
    const events = applyDamageToModule(frame, TEST_MODULES, head, 30, 'X');
    // 30 a la cabeza (hp 10, armor 0): 10 absorbidos, exceso 20 →
    // transfiere 10 (50%) − 2 de armadura del torso = 8.
    expect(head.destroyed).toBe(true);
    expect(torso.hp).toBe(32);
    expect(events.map((e) => e.type)).toEqual([
      'module-damaged', 'module-destroyed', 'module-damaged',
    ]);
  });

  it('un exceso pequeño se disipa sin llegar al núcleo', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const head = frame.modules.find((m) => m.slot === 'head')!;
    const torso = frame.modules.find((m) => m.slot === 'torso')!;
    // 14 a la cabeza: 10 absorbidos, exceso 4 → 2 (50%) − 2 armor = 0.
    const events = applyDamageToModule(frame, TEST_MODULES, head, 14, 'X');
    expect(torso.hp).toBe(40);
    expect(events.map((e) => e.type)).toEqual(['module-damaged', 'module-destroyed']);
  });

  it('destruir el módulo crítico deja la unidad a 0 HP aunque queden piezas', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const torso = frame.modules.find((m) => m.slot === 'torso')!;
    applyDamageToModule(frame, TEST_MODULES, torso, 999, 'X');
    expect(torso.destroyed).toBe(true);
    expect(deriveUnitHp(frame, TEST_MODULES)).toBe(0);
  });

  it('la reparación restaura el módulo más dañado y no revive destruidos', () => {
    const frame = buildFrameState(TEST_FRAME, TEST_MODULES);
    const legs = frame.modules.find((m) => m.slot === 'legs')!;
    const gun = frame.modules.find((m) => m.slot === 'gun')!;
    legs.hp = 5;               // faltan 15
    gun.hp = 0;
    gun.destroyed = true;      // irreparable
    const repaired = repairFrame(frame, TEST_MODULES, 45);
    expect(repaired).toEqual({ slot: 'legs', amount: 15 });
    expect(gun.hp).toBe(0);
  });
});

describe('frame: integración en Battle', () => {
  it('un ataque a una unidad con frame emite localización y daño de módulo', () => {
    const battle = framedBattle();
    battle.nextTurn();
    const active = battle.getActiveUnit()!;
    const enemy = battle.units.find((u) => u.team !== active.team)!;
    const events = battle.execute({
      type: 'ability', unitId: active.id, abilityId: 'bite-crush', target: enemy.position,
    });
    const kinds = events.map((e) => e.type);
    if (kinds.includes('damage-dealt')) {
      expect(kinds).toContain('hit-location-rolled');
      expect(kinds).toContain('module-damaged');
      // El targetHp del evento global coincide con el HP derivado del frame.
      const dmg = events.find((e) => e.type === 'damage-dealt')!;
      expect((dmg as { targetHp: number }).targetHp).toBe(enemy.hp);
      expect(enemy.hp).toBe(deriveUnitHp(enemy.components.frame!, TEST_MODULES));
    } else {
      expect(kinds).toContain('ability-missed');
    }
  });

  it('frameModifiers no aporta nada con el frame intacto y sin bonus', () => {
    const frame = buildFrameState(
      [{ slot: 'torso', moduleId: 'test-torso' }],
      TEST_MODULES,
    );
    expect(frameModifiers(frame, TEST_MODULES)).toEqual([]);
  });
});

describe('contenido: equivalencia framed vs monocasco', () => {
  it('liger-zero-cas y geno-saurer-cp intactos rinden igual que sus originales', async () => {
    const { ZOIDS } = await import('../src/data/zoids.js');
    const { MODULES } = await import('../src/data/modules.js');
    const battle = new Battle({
      map: FLAT_ARENA,
      unitCatalog: ZOIDS,
      abilityCatalog: ABILITIES,
      moduleCatalog: MODULES,
      seed: 1,
      spawns: [
        { id: 'L0', name: 'Liger', unitTypeId: 'liger-zero', team: 'player', position: { x: 0, y: 0 } },
        { id: 'LC', name: 'Liger CAS', unitTypeId: 'liger-zero-cas', team: 'player', position: { x: 1, y: 0 } },
        { id: 'G0', name: 'Geno', unitTypeId: 'geno-saurer', team: 'enemy', position: { x: 5, y: 0 } },
        { id: 'GC', name: 'Geno CP', unitTypeId: 'geno-saurer-cp', team: 'enemy', position: { x: 6, y: 0 } },
      ],
    });
    expect(battle.effectiveStats(battle.unit('LC'))).toEqual(battle.effectiveStats(battle.unit('L0')));
    expect(battle.effectiveStats(battle.unit('GC'))).toEqual(battle.effectiveStats(battle.unit('G0')));
  });
});
