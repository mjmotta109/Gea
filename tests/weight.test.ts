import { describe, expect, it } from 'vitest';
import { GameMap } from '../src/core/grid.js';
import { knockbackDestination } from '../src/core/physics.js';
import type { UnitState, WeightClass } from '../src/core/types.js';
import { ZOIDS } from '../src/data/zoids.js';

// Las cuatro básculas: clasificación completa en datos y dientes en la
// física — el empuje respeta el peso (extrapesado no se mueve, el
// extraligero sale volando una casilla más).

const CLASSES: WeightClass[] = ['extraligero', 'ligero', 'pesado', 'extrapesado'];

function victim(weightClass?: WeightClass): UnitState {
  return {
    id: 'V', name: 'V', unitTypeId: 'molga', isCommander: false,
    components: {}, team: 'enemy', position: { x: 2, y: 0 }, facing: 'west',
    hp: 50, size: 1, ct: 0, statuses: [], hasMoved: false, hasActed: false,
    reactionReady: true, ...(weightClass ? { weightClass } : {}),
  };
}

describe('clases de peso', () => {
  it('TODO chasis del catálogo declara su báscula, y las cuatro existen', () => {
    const seen = new Set<string>();
    for (const def of Object.values(ZOIDS)) {
      expect(def.weightClass, def.id).toBeDefined();
      expect(CLASSES).toContain(def.weightClass!);
      seen.add(def.weightClass!);
    }
    expect([...seen].sort()).toEqual([...CLASSES].sort());
  });

  it('el empuje respeta la báscula: el extrapesado ni se inmuta', () => {
    const open = GameMap.fromAscii(['000000']);
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim('extrapesado'), [victim('extrapesado')]))
      .toBeNull();
  });

  it('el ligero recorre una casilla; el extraligero, dos', () => {
    const open = GameMap.fromAscii(['000000']);
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim('ligero'), [victim('ligero')]))
      .toEqual({ x: 3, y: 0 });
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim('extraligero'), [victim('extraligero')]))
      .toEqual({ x: 4, y: 0 });
    // Sin clase declarada (guardado viejo, unidad de prueba): ligero.
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim(), [victim()]))
      .toEqual({ x: 3, y: 0 });
  });

  it('el vuelo del extraligero respeta muros y ocupantes: cae en la primera', () => {
    const walled = GameMap.fromAscii(['0000#0']);
    expect(knockbackDestination(walled, { x: 0, y: 0 }, victim('extraligero'), [victim('extraligero')]))
      .toEqual({ x: 3, y: 0 }); // la segunda casilla es muro: solo una
    const blocker: UnitState = { ...victim(), id: 'B', position: { x: 4, y: 0 } };
    const open = GameMap.fromAscii(['000000']);
    expect(knockbackDestination(open, { x: 0, y: 0 }, victim('extraligero'), [victim('extraligero'), blocker]))
      .toEqual({ x: 3, y: 0 }); // la segunda está ocupada: solo una
  });
});
