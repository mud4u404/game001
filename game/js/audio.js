'use strict';
// ---------- synthesized sound ----------
// Everything is generated with WebAudio, so the game ships no audio files.
const AUDIO = {
  ctx: null, master: null, sfxGain: null, musicGain: null, noise: null,
  muted: false, musicOn: true, musicTimer: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.8; this.master.connect(this.ctx.destination);
    const comp = this.ctx.createDynamicsCompressor(); comp.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(comp);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.22; this.musicGain.connect(comp);
    const len = this.ctx.sampleRate * 2, buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    if (this.musicOn) this.startMusic();
  },
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.8; },
  now() { return this.ctx.currentTime; },
  noiseBurst(dur, f0, f1, q, vol, type, delay) {
    if (!this.ctx || SPEED < 0.1) return;
    const t = this.now() + (delay || 0), src = this.ctx.createBufferSource(); src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter(); f.type = type || 'lowpass'; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const gn = this.ctx.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.008); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(this.sfxGain);
    src.start(t, Math.random()); src.stop(t + dur + 0.05);
  },
  tone(freq, dur, type, vol, slideTo, delay) {
    if (!this.ctx || SPEED < 0.1) return;
    const t = this.now() + (delay || 0), o = this.ctx.createOscillator(), gn = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(this.sfxGain); o.start(t); o.stop(t + dur + 0.05);
  },
  // --- game sounds ---
  click() { this.tone(900, 0.05, 'square', 0.05); },
  select() { this.tone(520, 0.06, 'square', 0.05); this.tone(780, 0.07, 'square', 0.04, null, 0.05); },
  move() { this.noiseBurst(0.25, 400, 120, 1, 0.12); },
  cannon() { this.noiseBurst(0.5, 2400, 80, 0.8, 0.9); this.tone(90, 0.35, 'sine', 0.8, 40); },
  mg() { for (let i = 0; i < 5; i++) this.noiseBurst(0.06, 3000, 800, 1, 0.35, 'bandpass', i * 0.07); },
  launch() { this.noiseBurst(0.12, 1800, 400, 1, 0.5); this.noiseBurst(0.9, 900, 3000, 2, 0.25, 'bandpass', 0.1); },
  howitzer() { this.noiseBurst(0.8, 1600, 60, 0.7, 1); this.tone(70, 0.6, 'sine', 0.9, 30); },
  whistle(dur) { this.tone(1800, dur || 0.7, 'sine', 0.06, 500); },
  rockets() { for (let i = 0; i < 4; i++) this.noiseBurst(0.35, 1400, 300, 1, 0.4, 'lowpass', i * 0.12); },
  boom(big) { this.noiseBurst(big ? 1.4 : 0.8, big ? 1200 : 1800, 40, 0.7, big ? 1 : 0.7); this.tone(55, big ? 0.9 : 0.5, 'sine', 0.9, 28); },
  hit() { this.noiseBurst(0.18, 3000, 600, 1, 0.3); this.tone(180, 0.12, 'square', 0.12, 90); },
  splash() { this.noiseBurst(0.9, 2500, 300, 0.6, 0.4, 'highpass'); },
  crash() { this.noiseBurst(1.2, 800, 60, 0.6, 0.8); this.noiseBurst(0.5, 4000, 1000, 1, 0.3, 'bandpass', 0.2); },
  alarm() { this.tone(660, 0.18, 'square', 0.06); this.tone(495, 0.22, 'square', 0.06, null, 0.2); },
  turn() { this.tone(392, 0.12, 'triangle', 0.12); this.tone(587, 0.2, 'triangle', 0.12, null, 0.1); },
  win() { [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, null, i * 0.14)); },
  lose() { [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.6, 'triangle', 0.12, null, i * 0.2)); },
  type() { this.tone(1400 + Math.random() * 300, 0.02, 'square', 0.015); },

  // --- music: a slow drone with a plucked melody in Ukrainian Dorian (raised 4th) ---
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const c = this.ctx, root = 110;
    const pad = (f, t, dur) => {
      for (const det of [-4, 4]) {
        const o = c.createOscillator(), gn = c.createGain(), fl = c.createBiquadFilter();
        o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        fl.type = 'lowpass'; fl.frequency.value = 520;
        gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.05, t + 2.5); gn.gain.linearRampToValueAtTime(0.0001, t + dur);
        o.connect(fl); fl.connect(gn); gn.connect(this.musicGain); o.start(t); o.stop(t + dur + 0.1);
      }
    };
    const pluck = (f, t, v) => {
      const o = c.createOscillator(), gn = c.createGain(), fl = c.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; fl.type = 'lowpass'; fl.frequency.setValueAtTime(3000, t); fl.frequency.exponentialRampToValueAtTime(400, t + 1.2);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(v, t + 0.005); gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(fl); fl.connect(gn); gn.connect(this.musicGain); o.start(t); o.stop(t + 1.7);
    };
    const scale = [0, 2, 3, 6, 7, 9, 10, 12, 14, 15];
    const chords = [0, -2, 3, -4];
    let bar = 0;
    const tick = () => {
      if (!this.musicOn) return;
      const t = c.currentTime + 0.1, ch = chords[bar % chords.length];
      pad(root * 2 ** (ch / 12), t, 8.4); pad(root * 1.5 * 2 ** (ch / 12), t, 8.4);
      let deg = 4;
      for (let i = 0; i < 8; i++) {
        if (Math.random() < 0.35) continue;
        deg = clamp(deg + pick([-2, -1, -1, 1, 1, 2]), 0, scale.length - 1);
        pluck(root * 4 * 2 ** ((scale[deg] + (ch > 0 ? 0 : 0)) / 12), t + i * 1.05, 0.06);
      }
      bar++;
    };
    tick();
    this.musicTimer = setInterval(tick, 8400);
  },
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; },
  toggleMusic(on) { this.musicOn = on; if (on) this.startMusic(); else this.stopMusic(); },
};
