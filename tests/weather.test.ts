import { describe, expect, it } from 'vitest';
import { weatherFor } from '../src/game/expedition.js';
import { SALT_PASS_REGION, WORLD_ATLAS } from '../src/data/world.js';

const region = (id: string) => WORLD_ATLAS.regions.find((r) => r.id === id)!;

describe('clima regional: variable, con carácter y con peso', () => {
  it('es determinista: misma región y día, mismo cielo', () => {
    for (let day = 0; day < 30; day++) {
      expect(weatherFor(SALT_PASS_REGION, day)).toBe(weatherFor(SALT_PASS_REGION, day));
    }
  });

  it('varía con los días: ninguna región vive bajo un solo cielo', () => {
    const skies = new Set<string>();
    for (let day = 0; day < 60; day++) skies.add(weatherFor(SALT_PASS_REGION, day));
    expect(skies.size).toBeGreaterThan(1);
  });

  it('cada región tiene su carácter: la costa llueve, las dunas tragan arena', () => {
    const count = (regionId: string, sky: string): number => {
      let n = 0;
      for (let day = 0; day < 400; day++) {
        if (weatherFor(region(regionId), day) === sky) n++;
      }
      return n;
    };
    // La Costa Esmeralda llueve mucho más que el Paso de Sal...
    expect(count('costa-esmeralda', 'rain')).toBeGreaterThan(count('paso-de-sal', 'rain') * 2);
    // ...y el Paso de Sal come mucha más arena que la costa.
    expect(count('paso-de-sal', 'sandstorm')).toBeGreaterThan(count('costa-esmeralda', 'sandstorm') * 2);
    // Todos los perfiles respetan sus pesos a grandes rasgos: el cielo
    // dominante de la costa es el agua o el sol, nunca la arena.
    expect(count('costa-esmeralda', 'sandstorm')).toBeLessThan(80); // peso 1/10 de 400
  });
});
