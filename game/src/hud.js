// HUD: lit instrument readouts (altitude, speed, heading), fuel and throttle,
// ring guidance, score, timer, stamps and toasts — plus a small attitude
// indicator drawn on canvas so the panel looks flown rather than drawn.
import { PLANE } from './config.js';

function el(id) {
  return document.getElementById(id);
}

export class Hud {
  constructor() {
    this.airspeed = el('hud-airspeed');
    this.altitude = el('hud-altitude');
    this.heading = el('hud-heading');
    this.compass = el('hud-compass');
    this.fuelFill = el('hud-fuel-fill');
    this.fuelText = el('hud-fuel-text');
    this.throttleFill = el('hud-throttle-fill');
    this.score = el('hud-score');
    this.timer = el('hud-timer');
    this.ring = el('hud-ring');
    this.stamps = el('hud-stamps');
    this.toast = el('hud-toast');
    this.wind = el('hud-wind');
    this.vspeed = el('hud-vspeed');
    this.attitude = el('hud-attitude');
    this._attCtx = this.attitude ? this.attitude.getContext('2d') : null;
    this._toastTimer = 0;
  }

  showToast(text, ms = 2600) {
    if (!this.toast) return;
    this.toast.textContent = text;
    this.toast.classList.add('show');
    window.clearTimeout(this._toastTimer);
    this._toastTimer = window.setTimeout(() => this.toast.classList.remove('show'), ms);
  }

  update(state) {
    // state: { speed, altitudeFt, headingDeg, fuel, throttle, score,
    //   timeSec, ringIndex, ringTotal, ringDist, ringBearingDeg, stamps,
    //   vspeed, pitch, bank, windKts, damage }
    const kts = Math.round(state.speed * 1.944);
    if (this.airspeed) this.airspeed.textContent = `${kts}`;
    if (this.altitude) this.altitude.textContent = `${Math.round(state.altitudeFt)}`;
    if (this.heading) this.heading.textContent = `${String(Math.round(state.headingDeg)).padStart(3, '0')}°`;
    if (this.vspeed) {
      const v = state.vspeed * 3.28 * 60;
      this.vspeed.textContent = `${v >= 0 ? '+' : ''}${Math.round(v)} ft/min`;
    }
    if (this.fuelFill) {
      this.fuelFill.style.width = `${Math.max(0, state.fuel)}%`;
      this.fuelFill.classList.toggle('low', state.fuel < 25);
    }
    if (this.fuelText) this.fuelText.textContent = `${Math.round(state.fuel)}%`;
    if (this.throttleFill) this.throttleFill.style.width = `${Math.round(state.throttle * 100)}%`;
    if (this.score) this.score.textContent = `${state.score}`;
    if (this.timer) {
      const m = Math.floor(state.timeSec / 60);
      const s = Math.floor(state.timeSec % 60);
      this.timer.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    if (this.ring) {
      this.ring.textContent = state.ringIndex >= state.ringTotal
        ? 'All rings cleared ✓'
        : `Ring ${state.ringIndex + 1}/${state.ringTotal} — ${Math.round(state.ringDist)} m ${this._arrow(state.ringBearingDeg)}`;
    }
    if (this.stamps) {
      this.stamps.textContent = state.stamps.length
        ? `Stamps: ${state.stamps.join(' · ')}`
        : 'Stamps: — land on Palm Cay, Turtle Bay, Volcano Rock';
    }
    if (this.wind) this.wind.textContent = `Wind ${Math.round(state.windKts)} kt →`;
    if (this.compass) this._drawCompass(state.headingDeg);
    this._drawAttitude(state.pitch, state.bank);
  }

  _arrow(bearingDeg) {
    if (Math.abs(bearingDeg) < 20) return '▲ ahead';
    return bearingDeg > 0 ? '▶ turn right' : '◀ turn left';
  }

  _drawCompass(headingDeg) {
    const ctx = this.compass?.getContext('2d');
    if (!ctx) return;
    const w = this.compass.width;
    const h = this.compass.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(8, 20, 32, 0.72)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7fd4ff';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    const labels = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'], [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The strip scrolls so the current heading stays centred.
    for (const [deg, label] of labels) {
      let diff = deg - headingDeg;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      const x = w / 2 + (diff / 60) * (w / 2);
      if (x < 6 || x > w - 6) continue;
      ctx.fillStyle = deg === 0 ? '#ffc93c' : '#cfeeff';
      ctx.fillText(label, x, h / 2 - 7);
      ctx.fillStyle = '#7fd4ff';
      ctx.fillRect(x - 0.5, h - 12, 1, 6);
    }
    // Centre caret.
    ctx.fillStyle = '#ffc93c';
    ctx.beginPath();
    ctx.moveTo(w / 2 - 5, 2);
    ctx.lineTo(w / 2 + 5, 2);
    ctx.lineTo(w / 2, 9);
    ctx.closePath();
    ctx.fill();
  }

  _drawAttitude(pitch, bank) {
    const ctx = this._attCtx;
    if (!ctx) return;
    const w = this.attitude.width;
    const h = this.attitude.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.min(w, h) / 2 - 3;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    // Sky / ground halves, rotated by bank and shifted by pitch.
    ctx.translate(cx, cy);
    ctx.rotate(-bank);
    const pitchPx = Math.max(-r, Math.min(r, pitch * r * 2.2));
    ctx.fillStyle = '#2f7fc4';
    ctx.fillRect(-r, -r + pitchPx, r * 2, r - pitchPx);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, pitchPx, r * 2, r - pitchPx + 1);
    ctx.strokeStyle = '#f5f5f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-r, pitchPx);
    ctx.lineTo(r, pitchPx);
    ctx.stroke();
    ctx.restore();
    // Fixed wings marker.
    ctx.strokeStyle = '#ffc93c';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.55, cy);
    ctx.lineTo(cx - r * 0.18, cy);
    ctx.moveTo(cx + r * 0.18, cy);
    ctx.lineTo(cx + r * 0.55, cy);
    ctx.stroke();
    // Rim.
    ctx.strokeStyle = '#7fd4ff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}
