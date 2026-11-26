// Keyboard + mouse input: one object the flight model reads every frame.
// Arrow keys fly the plane, W/S work the throttle, R restarts, P pauses, M mutes.
// Dragging with the mouse looks around (camera orbit offset, springs back).
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.lookYaw = 0; // mouse look offset, radians, decays to 0
    this.lookPitch = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._pressed = new Set(); // edge-triggered keys, consumed once

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this._pressed.add(e.key.toLowerCase());
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => { this._dragging = false; });
    window.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      this.lookYaw -= (e.clientX - this._lastX) * 0.004;
      this.lookPitch += (e.clientY - this._lastY) * 0.003;
      this.lookPitch = Math.max(-0.5, Math.min(0.5, this.lookPitch));
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    });
  }

  down(key) {
    return this.keys.has(key.toLowerCase());
  }

  // True once for the frame after the key went down.
  pressed(key) {
    return this._pressed.has(key.toLowerCase());
  }

  endFrame() {
    this._pressed.clear();
    // Mouse look springs back toward the chase view when released.
    if (!this._dragging) {
      this.lookYaw *= 0.92;
      this.lookPitch *= 0.92;
    }
  }

  get pitchCommand() {
    if (this.down('arrowup')) return 1;
    if (this.down('arrowdown')) return -1;
    return 0;
  }

  get bankCommand() {
    if (this.down('arrowleft')) return -1;
    if (this.down('arrowright')) return 1;
    return 0;
  }

  get throttleCommand() {
    if (this.down('w') || this.down('shift')) return 1;
    if (this.down('s') || this.down('control')) return -1;
    return 0;
  }
}
