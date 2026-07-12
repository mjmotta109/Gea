import { describe, expect, it } from 'vitest';
import {
  emptyTaller, nextAbilityId, nextContractId,
  sanitizeAbility, sanitizeContract, sanitizeTaller, tallerGrantIds,
} from '../src/game/taller.js';
import { ZOIDS } from '../src/data/zoids.js';

// El taller de contenido: lo que crea el director se valida SIEMPRE
// contra los límites del motor — un guardado corrupto o un JSON
// importado a mano no puede colar basura a una batalla.

const KNOWN = new Set(Object.keys(ZOIDS));

describe('taller: validación del contenido del director', () => {
  it('una habilidad razonable sobrevive entera (ida y vuelta)', () => {
    const ability = sanitizeAbility({
      id: 'tx-lanza', name: 'Lanza térmica', description: 'Cuece reactores.',
      range: 4, minRange: 1, shape: 'single', aoeRadius: 0, accuracy: 85,
      targetsAllies: false, usesPerBattle: 2,
      effects: [
        { kind: 'damage', power: 30, damageType: 'energy' },
        { kind: 'heat', amount: 20 },
      ],
      ctCost: 70,
    }, 'tx-1');
    expect(ability.id).toBe('tx-lanza');
    expect(ability.usesPerBattle).toBe(2);
    expect(ability.effects).toHaveLength(2);
    expect(ability.ctCost).toBe(70);
    // Punto fijo: sanear lo ya saneado no cambia nada.
    expect(sanitizeAbility(ability, 'tx-9')).toEqual(ability);
  });

  it('la basura se acota y una habilidad sin efectos recibe uno mínimo', () => {
    const ability = sanitizeAbility({
      id: 'no-prefijo', range: 999, accuracy: -50, effects: [{ kind: 'magia' }],
    }, 'tx-3');
    expect(ability.id).toBe('tx-3'); // el taller nunca pisa contenido de fábrica
    expect(ability.range).toBe(12);
    expect(ability.accuracy).toBe(10);
    expect(ability.effects).toHaveLength(1);
    expect(ability.effects[0]!.kind).toBe('damage');
    expect(ability.minRange).toBeLessThanOrEqual(ability.range);
  });

  it('un contrato exige chasis CONOCIDOS: lo inventado se descarta', () => {
    const good = sanitizeContract({
      id: 'txc-emboscada', name: 'Emboscada al convoy', tier: 'caza',
      enemySquad: ['molga', 'chasis-inventado', 'guysak'], reward: 1200, salvagePerKill: 60,
    }, 'txc-1', KNOWN);
    expect(good).toBeDefined();
    expect(good!.enemySquad).toEqual(['molga', 'guysak']);
    // Sin un solo chasis real, el contrato no existe.
    expect(sanitizeContract({ enemySquad: ['nada'] }, 'txc-2', KNOWN)).toBeUndefined();
  });

  it('el taller completo sobrevive a un guardado corrupto', () => {
    const taller = sanitizeTaller({
      abilities: { 'tx-1': { name: 'Válida', effects: [{ kind: 'heal', power: 30 }] }, rota: 42 },
      grants: { 'tx-1': [0, 0, 3, 7, -1, 'x'], 'tx-fantasma': [1] },
      contracts: [{ enemySquad: ['molga'] }, null, { enemySquad: [] }],
    }, KNOWN);
    expect(Object.keys(taller.abilities)).toHaveLength(2); // la rota renace con defaults
    expect(taller.grants['tx-1']).toEqual([0, 3]);
    expect(taller.grants['tx-fantasma']).toBeUndefined(); // otorgar lo inexistente no vale
    expect(taller.contracts).toHaveLength(1);
    expect(tallerGrantIds(taller, 3)).toEqual(['tx-1']);
    expect(tallerGrantIds(taller, 2)).toEqual([]);
  });

  it('los ids nuevos nunca chocan con los existentes', () => {
    const taller = emptyTaller();
    taller.abilities['tx-1'] = sanitizeAbility({}, 'tx-1');
    taller.abilities['tx-2'] = sanitizeAbility({}, 'tx-2');
    expect(nextAbilityId(taller)).toBe('tx-3');
    taller.contracts.push(sanitizeContract({ enemySquad: ['molga'] }, 'txc-1', KNOWN)!);
    expect(nextContractId(taller)).toBe('txc-2');
  });
});
