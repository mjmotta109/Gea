import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runScriptedBattle } from './helpers/scriptedBattle.js';

/**
 * Golden master del motor: batallas completas con semillas fijas comparadas
 * contra registros de referencia. Detecta CUALQUIER cambio de comportamiento
 * — orden de turnos, tiradas, daños, eventos — introducido por un refactor.
 *
 * Si el cambio de comportamiento es intencional:
 *   npm run golden:update
 * y commitea las referencias regeneradas explicando el porqué.
 */
const SEEDS = [11, 20260703, 424242];
const GOLDEN_DIR = join(dirname(fileURLToPath(import.meta.url)), 'golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

describe('golden master', () => {
  for (const seed of SEEDS) {
    it(`la batalla con semilla ${seed} reproduce la referencia`, () => {
      const record = runScriptedBattle(seed);
      // La batalla debe terminar por sí sola; un empate por límite de turnos
      // haría al golden master ciego ante la mitad de la simulación.
      expect(record.winner).not.toBeNull();

      const json = JSON.stringify(record, null, 2) + '\n';
      const file = join(GOLDEN_DIR, `valley-seed-${seed}.json`);

      if (UPDATE) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(file, json);
        return;
      }

      if (!existsSync(file)) {
        throw new Error(`Falta la referencia ${file}. Genérala con: npm run golden:update`);
      }
      expect(json).toBe(readFileSync(file, 'utf8'));
    });
  }
});
