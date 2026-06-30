// Tiny synthesized sound effects (Web Audio) — no audio files to bundle.
// The AudioContext unlocks on the first sound that follows a user gesture
// (browser autoplay policy); opponent-triggered sounds before any interaction
// may be silent until the player clicks once.

let ctx: AudioContext | null = null;
let enabled = localStorage.getItem('tavla.sound') !== 'off';

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function soundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(v: boolean): void {
  enabled = v;
  localStorage.setItem('tavla.sound', v ? 'on' : 'off');
  if (v) ac(); // warm up on enable (this call rides a click)
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.05, delay = 0): void {
  const c = ac();
  if (!c || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.connect(g);
  g.connect(c.destination);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.start(t);
  o.stop(t + dur + 0.03);
}

function noise(dur: number, gain = 0.07, highpass = 700): void {
  const c = ac();
  if (!c || !enabled) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = highpass;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(f);
  f.connect(g);
  g.connect(c.destination);
  src.start();
}

export const sfx = {
  dice() {
    noise(0.16, 0.06, 900);
    tone(200, 0.12, 'triangle', 0.035, 0.02);
  },
  move() {
    tone(430, 0.06, 'square', 0.025);
  },
  hit() {
    tone(130, 0.2, 'sawtooth', 0.06);
    noise(0.12, 0.05, 400);
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.26, 'sine', 0.06, i * 0.09));
  },
  lose() {
    [392, 330, 262].forEach((f, i) => tone(f, 0.3, 'sine', 0.05, i * 0.12));
  },
  turn() {
    tone(660, 0.1, 'sine', 0.045);
    tone(880, 0.12, 'sine', 0.035, 0.09);
  },
};
