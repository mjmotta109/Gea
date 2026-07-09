import { describe, expect, it } from 'vitest';
import { Battle } from '../src/core/battle.js';
import { WATER_ATTACK_PENALTY } from '../src/core/combat.js';
import { GameMap } from '../src/core/grid.js';
import { ABILITIES } from '../src/data/abilities.js';
import { MODULES } from '../src/data/modules.js';
import { WEAPONS } from '../src/data/weapons.js';
import { withWeaponLibrary } from '../src/data/weaponLibrary.js';
import { ZOIDS } from '../src/data/zoids.js';

// Los chasis de 2ª generación (p.ej. brachios) montan armas lib-*: hay que
// mezclar la biblioteca anexa para instanciarlos, como hace la campaña.
const { abilityCatalog, weaponCatalog } = withWeaponLibrary(ABILITIES, WEAPONS);

/**
 * Terreno transitable: el agua se vadea (con penalización de ataque para
 * los terrestres) y toda altura se escala pagando movimiento. Aquí se
 * cubre la penalización de ataque; el coste de vadear y escalar vive en
 * pathfinding.test.ts.
 */

/** Pronóstico de un disparo a distancia 3 con el atacante en el terreno dado. */
function previewFrom(attackerTile: '0' | '~', attackerType: string) {
  // Fila llana salvo la casilla del atacante; blanco a 3 casillas, de frente.
  const map = GameMap.fromAscii([`${attackerTile}0000`]);
  const battle = new Battle({
    map, unitCatalog: ZOIDS, abilityCatalog, weaponCatalog, moduleCatalog: MODULES, seed: 1,
    spawns: [
      { id: 'A', name: 'Atacante', unitTypeId: attackerType, team: 'player', position: { x: 0, y: 0 }, facing: 'east' },
      { id: 'B', name: 'Blanco', unitTypeId: 'molga', team: 'enemy', position: { x: 3, y: 0 }, facing: 'west' },
    ],
  });
  return battle.attackPreview('A', 'shock-cannon', { x: 3, y: 0 })!;
}

describe('vadear penaliza el ataque de los terrestres', () => {
  it('un terrestre disparando desde el agua apunta peor que en tierra firme', () => {
    const land = previewFrom('0', 'command-wolf');
    const water = previewFrom('~', 'command-wolf');
    expect(land).toBeDefined();
    expect(water.chance).toBeLessThan(land.chance);
    // Fuera de los topes [5,99], la diferencia es exactamente la penalización.
    if (land.chance < 99 && water.chance > 5) {
      expect(land.chance - water.chance).toBe(WATER_ATTACK_PENALTY);
    }
  });

  it('los anfibios están exentos: pelean igual dentro del agua', () => {
    const land = previewFrom('0', 'brachios');   // moveType amphibious
    const water = previewFrom('~', 'brachios');
    expect(water.chance).toBe(land.chance);
  });
});
