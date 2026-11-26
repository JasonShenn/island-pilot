// Procedural sound, no audio files: an engine drone whose pitch follows the
// throttle, wind noise that grows with speed, and a short chime for rings.
// Everything is WebAudio oscillators and filtered noise; nothing is fetched.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._windSrc = null;
    this._windGain = null;
    this._windFilter = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    // Engine: two detuned sawtooth oscillators through a lowpass.
    this._engineOsc = this.ctx.createOscillator();
    this._engineOsc.type = 'sawtooth';
    this._engineOsc.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 55 * 1.01;
    this._engineGain = this.ctx.createGain();
    this._engineGain.gain.value = 0;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    this._engineOsc.connect(lp);
    osc2.connect(lp);
    lp.connect(this._engineGain);
    this._engineGain.connect(this.ctx.destination);
    this._engineOsc.start();
    osc2.start();
    // Wind: looped noise buffer through a bandpass.
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this._windSrc = this.ctx.createBufferSource();
    this._windSrc.buffer = buf;
    this._windSrc.loop = true;
    this._windFilter = this.ctx.createBiquadFilter();
    this._windFilter.type = 'bandpass';
    this._windFilter.frequency.value = 700;
    this._windGain = this.ctx.createGain();
    this._windGain.gain.value = 0;
    this._windSrc.connect(this._windFilter);
    this._windFilter.connect(this._windGain);
    this._windGain.connect(this.ctx.destination);
    this._windSrc.start();
  }

  setEngine(throttle, speed, airborne) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const target = airborne || throttle > 0.05 ? 0.05 + throttle * 0.09 : 0;
    this._engineGain.gain.setTargetAtTime(target, t, 0.15);
    this._engineOsc.frequency.setTargetAtTime(48 + throttle * 55, t, 0.1);
    const windTarget = Math.min(0.12, (speed / 92) * 0.12);
    this._windGain.gain.setTargetAtTime(airborne ? windTarget : 0, t, 0.2);
  }

  chime() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (const [freq, when] of [[880, 0], [1318, 0.09]]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + when);
      g.gain.exponentialRampToValueAtTime(0.18, t + when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + when + 0.5);
      osc.connect(g);
      g.connect(this.ctx.destination);
      osc.start(t + when);
      osc.stop(t + when + 0.55);
    }
  }

  thud() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(38, t + 0.25);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this._engineGain?.gain.setTargetAtTime(this.muted ? 0 : 0.06, t, 0.05);
      this._windGain?.gain.setTargetAtTime(0, t, 0.05);
    }
    return this.muted;
  }
}
