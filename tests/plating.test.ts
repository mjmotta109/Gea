import { describe, expect, it } from 'vitest';
import { applyDamageToModule, buildFrameState, deriveUnitHp, type ModuleCatalog } from '../src/core/frame.js';

/**
 * Blindaje por partes (BattleTech-lite): cada módulo tiene una capa de
 * placas que se GASTA antes de que la estructura sufra. Mientras aguanta,
 * la armadura mitiga y el HP interno está protegido; cuando se agota, la
 * pieza queda EXPUESTA y recibe el daño íntegro hasta destruirse.
 */
const MODS: ModuleCatalog = {
  't-torso': {
    id: 't-torso', name: 'Torso', hp: 30, armor: 3, plating: 20, weight: 30, hitWeight: 40,
    critical: true, contributions: [], onDestroyed: [], tags: [],
  },
  't-leg': {
    id: 't-leg', name: 'Pata', hp: 16, armor: 2, plating: 10, weight: 16, hitWeight: 20,
    critical: false,
    contributions: [{ source: 'module:t-leg', stat: 'move', add: 3 }],
    onDestroyed: [{ source: 'module:t-leg', stat: 'accuracy', add: -10 }],
    tags: ['locomotion'],
  },
};
const CONFIG = [{ slot: 'torso', moduleId: 't-torso' }, { slot: 'leg-l', moduleId: 't-leg' }];
const fresh = () => buildFrameState(CONFIG, MODS);
const leg = (f: ReturnType<typeof fresh>) => f.modules.find((m) => m.slot === 'leg-l')!;

describe('blindaje: la capa se gasta antes de que la estructura sufra', () => {
  it('mientras el blindaje aguanta, la estructura no sufre', () => {
    const f = fresh();
    const events = applyDamageToModule(f, MODS, leg(f), 8, 'X'); // 8 − 2 armadura = 6 al blindaje (10→4)
    expect(leg(f).plating).toBe(4);
    expect(leg(f).hp).toBe(16); // estructura intacta
    expect(events.some((e) => e.type === 'module-armor-damaged')).toBe(true);
    expect(events.some((e) => e.type === 'module-damaged')).toBe(false);
    expect(events.some((e) => e.type === 'module-armor-broken')).toBe(false);
  });

  it('al agotarse el blindaje, la pieza queda expuesta y lo avisa', () => {
    const f = fresh();
    applyDamageToModule(f, MODS, leg(f), 8, 'X');            // blindaje 10→4
    const ev = applyDamageToModule(f, MODS, leg(f), 8, 'X'); // 6: rompe 4 y sobran 2 a estructura
    expect(leg(f).plating).toBe(0);
    expect(ev.some((e) => e.type === 'module-armor-broken')).toBe(true);
    expect(leg(f).hp).toBe(14);
  });

  it('expuesta = daño ÍNTEGRO, sin mitigación de armadura', () => {
    const f = fresh();
    applyDamageToModule(f, MODS, leg(f), 20, 'X'); // 18: 10 blindaje + 8 estructura → hp 8
    expect(leg(f).plating).toBe(0);
    expect(leg(f).hp).toBe(8);
    applyDamageToModule(f, MODS, leg(f), 5, 'X');  // expuesta: 5 íntegros (no 5−2)
    expect(leg(f).hp).toBe(3);
  });

  it('el HP global sigue la estructura: protegido mientras hay blindaje', () => {
    const f = fresh();
    const full = deriveUnitHp(f, MODS); // 30 + 16
    applyDamageToModule(f, MODS, leg(f), 8, 'X'); // solo toca el blindaje
    expect(deriveUnitHp(f, MODS)).toBe(full);
  });

  it('sin blindaje de fábrica, comportamiento clásico (la armadura mitiga siempre)', () => {
    const noPlate: ModuleCatalog = {
      c: { id: 'c', name: 'c', hp: 20, armor: 3, weight: 10, hitWeight: 10, critical: true, contributions: [], onDestroyed: [], tags: [] },
    };
    const f = buildFrameState([{ slot: 'torso', moduleId: 'c' }], noPlate);
    expect(f.modules[0]!.plating).toBe(0);
    applyDamageToModule(f, noPlate, f.modules[0]!, 10, 'X'); // 10 − 3 = 7
    expect(f.modules[0]!.hp).toBe(13);
  });
});
