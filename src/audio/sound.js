// In-game sound, synthesized with the Web Audio API (no audio files to download).
// Science note: the Moon has no air, so outside the suit there is no sound at all —
// on the Moon you only hear what travels through your suit: breathing, the fan, radio
// and footsteps through your boots. Mars has thin air, so you also hear faint wind.

const MUTE_KEY = 'survive30sols.muted.v1';

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.loops = {};
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      this.muted = false;
    }
  }

  // Must be called from a user gesture (click/tap/key) the first time.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(this.ctx.destination);
    // 2 seconds of white noise to reuse for wind, breath and footsteps.
    const len = this.ctx.sampleRate * 2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m) {
    this.muted = m;
    try {
      localStorage.setItem(MUTE_KEY, m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  get ready() {
    return !!this.ctx;
  }

  noiseSource(loop = true) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = loop;
    return src;
  }

  // ---------- Loops ----------
  startAmbient(worldId) {
    if (!this.ctx) return;
    this.stopLoops();
    const t = this.ctx.currentTime;

    // Suit fan: a soft, steady hum (both worlds).
    const fan = this.noiseSource();
    const fanF = this.ctx.createBiquadFilter();
    fanF.type = 'bandpass';
    fanF.frequency.value = 420;
    fanF.Q.value = 0.7;
    const fanG = this.ctx.createGain();
    fanG.gain.value = 0.035;
    fan.connect(fanF).connect(fanG).connect(this.master);
    fan.start(t);
    const hum = this.ctx.createOscillator();
    hum.frequency.value = 118;
    const humG = this.ctx.createGain();
    humG.gain.value = 0.012;
    hum.connect(humG).connect(this.master);
    hum.start(t);

    // Breathing: noise through a filter that opens and closes every ~4 s.
    const breath = this.noiseSource();
    const bF = this.ctx.createBiquadFilter();
    bF.type = 'bandpass';
    bF.frequency.value = 900;
    bF.Q.value = 0.9;
    const bG = this.ctx.createGain();
    bG.gain.value = 0;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.24;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.045;
    lfo.connect(lfoG).connect(bG.gain);
    breath.connect(bF).connect(bG).connect(this.master);
    breath.start(t);
    lfo.start(t);
    this.loops = { fan, hum, breath, lfo };

    // Mars only: wind in the thin CO2 air, with slow gusts.
    if (worldId === 'mars') {
      const wind = this.noiseSource();
      const wF = this.ctx.createBiquadFilter();
      wF.type = 'lowpass';
      wF.frequency.value = 380;
      const wG = this.ctx.createGain();
      wG.gain.value = 0.05;
      const gust = this.ctx.createOscillator();
      gust.frequency.value = 0.08;
      const gustG = this.ctx.createGain();
      gustG.gain.value = 0.035;
      gust.connect(gustG).connect(wG.gain);
      const gustF = this.ctx.createGain();
      gustF.gain.value = 180;
      gust.connect(gustF).connect(wF.frequency);
      wind.connect(wF).connect(wG).connect(this.master);
      wind.start(t);
      gust.start(t);
      this.loops.wind = wind;
      this.loops.gust = gust;
      this.windGain = wG;
    }
  }

  setStorm(level) {
    if (this.windGain) this.windGain.gain.setTargetAtTime(0.05 + level * 0.18, this.ctx.currentTime, 0.5);
  }

  // Rover motor: two detuned saws through a lowpass, pitch follows speed.
  rover(on, speed = 0, throttle = 0) {
    if (!this.ctx) return;
    if (on && !this.loops.motorA) {
      const t = this.ctx.currentTime;
      const a = this.ctx.createOscillator();
      const b = this.ctx.createOscillator();
      a.type = 'sawtooth';
      b.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 500;
      const g = this.ctx.createGain();
      g.gain.value = 0;
      a.connect(f);
      b.connect(f);
      f.connect(g).connect(this.master);
      a.start(t);
      b.start(t);
      Object.assign(this.loops, { motorA: a, motorB: b });
      this.motor = { a, b, f, g };
    }
    if (!on && this.loops.motorA) {
      this.motor.g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      const { a, b } = this.motor;
      setTimeout(() => { try { a.stop(); b.stop(); } catch { /* ignore */ } }, 400);
      delete this.loops.motorA;
      delete this.loops.motorB;
      this.motor = null;
      return;
    }
    if (on && this.motor) {
      const now = this.ctx.currentTime;
      const base = 55 + Math.abs(speed) * 22;
      this.motor.a.frequency.setTargetAtTime(base, now, 0.08);
      this.motor.b.frequency.setTargetAtTime(base * 1.01 + 2, now, 0.08);
      this.motor.f.frequency.setTargetAtTime(300 + Math.abs(throttle) * 900, now, 0.1);
      this.motor.g.gain.setTargetAtTime(0.03 + Math.abs(throttle) * 0.06 + Math.min(Math.abs(speed), 6) * 0.006, now, 0.1);
    }
  }

  stopLoops() {
    for (const k in this.loops) {
      try {
        this.loops[k].stop();
      } catch {
        /* already stopped */
      }
    }
    this.loops = {};
    this.motor = null;
    this.windGain = null;
  }

  // ---------- One-shots ----------
  env(node, peak, attack, decay) {
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    node.connect(g).connect(this.master);
    return t + attack + decay + 0.05;
  }

  footstep(gravity = 1.62) {
    if (!this.ctx) return;
    // A muffled thump heard through the boots (lower gravity = softer, slower).
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(90, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.12);
    const end = this.env(o, gravity < 2.5 ? 0.12 : 0.16, 0.005, 0.16);
    o.start();
    o.stop(end);
    const n = this.noiseSource(false);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    n.connect(f);
    const end2 = this.env(f, 0.08, 0.005, 0.12);
    n.start();
    n.stop(end2);
  }

  blip(freq = 1200, dur = 0.08, vol = 0.08, type = 'sine') {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const end = this.env(o, vol, 0.005, dur);
    o.start();
    o.stop(end);
  }

  scan() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const t = this.ctx.currentTime;
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
    const end = this.env(o, 0.09, 0.01, 0.4);
    o.start();
    o.stop(end);
  }

  success() {
    this.blip(880, 0.1, 0.07);
    setTimeout(() => this.blip(1320, 0.16, 0.07), 110);
  }

  error() {
    this.blip(220, 0.18, 0.08, 'square');
  }

  radio() {
    if (!this.ctx) return;
    // Short squelch, like a radio call from CAPCOM.
    const n = this.noiseSource(false);
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 1.5;
    n.connect(f);
    const end = this.env(f, 0.08, 0.005, 0.18);
    n.start();
    n.stop(end);
    setTimeout(() => this.blip(1500, 0.06, 0.05), 200);
  }

  thud() {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(70, this.ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.3);
    const end = this.env(o, 0.25, 0.005, 0.35);
    o.start();
    o.stop(end);
  }

  alarm() {
    [0, 260, 520].forEach((d) => setTimeout(() => this.blip(960, 0.18, 0.06, 'square'), d));
  }

  stopAll() {
    this.stopLoops();
  }
}

export const sound = new SoundEngine();
