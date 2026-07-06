/*
 * Sonido sintetizado con WebAudio: cero archivos, cero red.
 *
 * Cada efecto se fabrica al vuelo con osciladores y ráfagas de ruido.
 * El AudioContext nace perezoso en el primer gesto del usuario (política
 * de autoplay) y el silencio se recuerda en localStorage.
 */

export type SfxId =
  | 'shot' | 'beam' | 'impact' | 'slash' | 'explosion'
  | 'step' | 'heal' | 'choice' | 'click';

const SFX_KEY = 'gea-sfx';
let ctx: AudioContext | null = null;
let muted = false;
try { muted = localStorage.getItem(SFX_KEY) === 'off'; } catch { /* privado */ }

export function sfxEnabled(): boolean {
  return !muted;
}

export function toggleSfx(): boolean {
  muted = !muted;
  try { localStorage.setItem(SFX_KEY, muted ? 'off' : 'on'); } catch { /* privado */ }
  if (!muted) playSfx('click');
  return !muted;
}

function audio(): AudioContext | null {
  if (muted) return null;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx.state === 'running' || ctx.state === 'suspended' ? ctx : null;
  } catch {
    return null;
  }
}

/** Ráfaga de ruido blanco con envolvente descendente. */
function noise(ac: AudioContext, when: number, duration: number, gain: number, lowpass: number): void {
  const samples = Math.max(1, Math.floor(ac.sampleRate * duration));
  const buffer = ac.createBuffer(1, samples, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  src.connect(filter).connect(g).connect(ac.destination);
  src.start(when);
}

/** Tono con barrido de frecuencia y envolvente. */
function tone(
  ac: AudioContext, when: number, type: OscillatorType,
  from: number, to: number, duration: number, gain: number,
): void {
  const osc = ac.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, when);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), when + duration);
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + duration);
  osc.connect(g).connect(ac.destination);
  osc.start(when);
  osc.stop(when + duration + 0.02);
}

export function playSfx(id: SfxId): void {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.001;
  switch (id) {
    case 'shot':
      noise(ac, t, 0.09, 0.14, 3200);
      tone(ac, t, 'square', 420, 120, 0.08, 0.05);
      break;
    case 'beam':
      tone(ac, t, 'sawtooth', 1400, 320, 0.16, 0.06);
      tone(ac, t, 'sine', 2200, 900, 0.12, 0.03);
      break;
    case 'impact':
      noise(ac, t, 0.12, 0.16, 1400);
      tone(ac, t, 'sine', 180, 60, 0.12, 0.1);
      break;
    case 'slash':
      noise(ac, t, 0.07, 0.08, 6000);
      tone(ac, t, 'triangle', 900, 2400, 0.07, 0.03);
      break;
    case 'explosion':
      noise(ac, t, 0.5, 0.24, 900);
      tone(ac, t, 'sine', 110, 30, 0.45, 0.14);
      break;
    case 'step':
      noise(ac, t, 0.05, 0.05, 700);
      break;
    case 'heal':
      tone(ac, t, 'sine', 520, 780, 0.09, 0.05);
      tone(ac, t + 0.09, 'sine', 660, 990, 0.1, 0.05);
      break;
    case 'choice':
      tone(ac, t, 'triangle', 330, 330, 0.09, 0.06);
      tone(ac, t + 0.11, 'triangle', 440, 440, 0.12, 0.06);
      break;
    case 'click':
      tone(ac, t, 'square', 700, 480, 0.04, 0.03);
      break;
  }
}
