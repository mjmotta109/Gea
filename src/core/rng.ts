/**
 * RNG determinista (mulberry32). Toda la aleatoriedad del motor pasa por
 * aquí para que las batallas sean reproducibles a partir de una semilla:
 * imprescindible para tests, replays y futuro multijugador.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número en [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Entero en [min, max] inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Tirada porcentual: true con probabilidad `chance` (0-100). */
  roll(chance: number): boolean {
    return this.next() * 100 < chance;
  }
}
