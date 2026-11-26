// The golden ring course. Rings light up one at a time; flying through the
// active ring scores and arms the next. Passed rings turn green and dim.
import * as THREE from 'three';
import { RINGS, COLOURS } from './config.js';

export class RingCourse {
  constructor(scene) {
    this.rings = RINGS.map((def, i) => {
      const group = new THREE.Group();
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(def.r, 1.6, 12, 40),
        new THREE.MeshBasicMaterial({ color: COLOURS.ringGold }),
      );
      group.add(torus);
      // Inner glow disc so the ring reads from far away.
      const glow = new THREE.Mesh(
        new THREE.CircleGeometry(def.r * 0.92, 32),
        new THREE.MeshBasicMaterial({
          color: COLOURS.ringGold, transparent: true, opacity: 0.10,
          side: THREE.DoubleSide, depthWrite: false,
        }),
      );
      group.add(glow);
      // A small beacon light above the ring.
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(1.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      beacon.position.y = def.r + 6;
      group.add(beacon);
      group.position.set(def.x, def.y, def.z);
      // Face the ring toward the incoming flight path (toward the previous ring).
      const prev = i === 0 ? { x: 0, y: 10, z: -160 } : RINGS[i - 1];
      group.lookAt(prev.x, prev.y, prev.z);
      group.userData.torus = torus;
      group.userData.glow = glow;
      group.userData.beacon = beacon;
      scene.add(group);
      return { ...def, index: i, group, passed: false };
    });
    this.nextIndex = 0;
    this._pulse = 0;
  }

  activeRing() {
    return this.nextIndex < this.rings.length ? this.rings[this.nextIndex] : null;
  }

  // True when the plane's centre passes through the active ring's disc.
  checkPass(px, py, pz) {
    const ring = this.activeRing();
    if (!ring) return null;
    const dx = px - ring.x;
    const dy = py - ring.y;
    const dz = pz - ring.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < ring.r * 0.9) {
      ring.passed = true;
      ring.group.userData.torus.material = new THREE.MeshBasicMaterial({ color: COLOURS.ringDone });
      ring.group.userData.glow.material.opacity = 0.04;
      this.nextIndex++;
      return ring;
    }
    return null;
  }

  distanceToActive(px, py, pz) {
    const ring = this.activeRing();
    if (!ring) return 0;
    const dx = ring.x - px;
    const dy = ring.y - py;
    const dz = ring.z - pz;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  bearingToActive(px, pz, headingRad) {
    const ring = this.activeRing();
    if (!ring) return 0;
    const target = Math.atan2(ring.x - px, ring.z - pz);
    let diff = target - headingRad;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  reset() {
    this.nextIndex = 0;
    for (const ring of this.rings) {
      ring.passed = false;
      ring.group.userData.torus.material = new THREE.MeshBasicMaterial({ color: COLOURS.ringGold });
      ring.group.userData.glow.material.opacity = 0.1;
    }
  }

  animate(time) {
    this._pulse = time;
    const ring = this.activeRing();
    if (ring) {
      const s = 1 + Math.sin(time * 3) * 0.04;
      ring.group.scale.set(s, s, s);
    }
  }
}
