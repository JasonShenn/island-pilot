// The bush plane: a model built from primitives (fuselage, wings, tail,
// propeller, floats of colour) plus the arcade flight model that flies it.
// The model faces +Z; forward() is the analytic direction from yaw/pitch.
import * as THREE from 'three';
import { PLANE, COLOURS, WORLD } from './config.js';
import { terrainHeight, stripAt } from './terrain.js';

export function buildPlaneMesh() {
  const plane = new THREE.Group();
  const orange = new THREE.MeshLambertMaterial({ color: COLOURS.planeOrange });
  const cream = new THREE.MeshLambertMaterial({ color: COLOURS.planeCream });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2b2f36 });
  const glass = new THREE.MeshPhongMaterial({
    color: 0x9fd4ef, shininess: 120, specular: 0xffffff,
  });

  // Fuselage: a tapered cylinder along Z, nose at +Z.
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.55, 5.4, 12), orange);
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.z = 0.2;
  plane.add(fuselage);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.4, 12), cream);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 3.6;
  plane.add(nose);
  // Cabin glasshouse.
  const cabin = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 10), glass);
  cabin.scale.set(0.85, 0.7, 1.5);
  cabin.position.set(0, 0.55, 0.4);
  plane.add(cabin);
  // Main wing (high wing, bush-plane style) with cream tips.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.22, 1.7), orange);
  wing.position.set(0, 0.85, 0.6);
  plane.add(wing);
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.24, 1.7), cream);
    tip.position.set(side * 4.7, 0.85, 0.6);
    plane.add(tip);
    // Wing struts.
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), dark);
    strut.position.set(side * 2.2, -0.1, 0.6);
    strut.rotation.z = side * 0.6;
    plane.add(strut);
  }
  // Tail: horizontal stabiliser + vertical fin.
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 1.1), orange);
  tailplane.position.set(0, 0.25, -2.6);
  plane.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 1.3), cream);
  fin.position.set(0, 0.9, -2.6);
  plane.add(fin);
  // Propeller (spins in the render loop; stored on the group for main.js).
  const prop = new THREE.Group();
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 10), dark);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = 0.4;
  prop.add(spinner);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.6, 0.08), dark);
    blade.rotation.z = a;
    blade.position.z = 0.1;
    prop.add(blade);
  }
  prop.position.z = 4.3;
  plane.add(prop);
  plane.userData.propeller = prop;
  // Fixed landing gear.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.3, 6), dark);
    leg.position.set(side * 0.8, -1.0, 0.9);
    plane.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 0.8, -1.55, 0.9);
    plane.add(wheel);
  }
  // Navigation lights: tiny emissive dots so the plane reads at dusk too.
  const lightGeo = new THREE.SphereGeometry(0.09, 6, 6);
  const leftLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  leftLight.position.set(-4.9, 0.85, 0.6);
  plane.add(leftLight);
  const rightLight = new THREE.Mesh(lightGeo, new THREE.MeshBasicMaterial({ color: 0x22ff66 }));
  rightLight.position.set(4.9, 0.85, 0.6);
  plane.add(rightLight);
  return plane;
}

export class FlightModel {
  constructor() {
    this.reset();
  }

  reset() {
    // Parked at the south end of the home strip, facing north (+Z).
    this.x = 0;
    this.y = 10.4;
    this.z = -160;
    this.yaw = 0;
    this.pitch = 0;
    this.bank = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = PLANE.fuelCapacity;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.damage = 0;
    this.engineOut = false;
  }

  forward() {
    const cp = Math.cos(this.pitch);
    return {
      x: Math.sin(this.yaw) * cp,
      y: Math.sin(this.pitch),
      z: Math.cos(this.yaw) * cp,
    };
  }

  headingDegrees() {
    let d = (this.yaw * 180) / Math.PI;
    d = ((d % 360) + 360) % 360;
    return d;
  }

  // One physics step. Returns an event string when something notable happens:
  // 'takeoff' | 'landed-perfect' | 'landed-good' | 'landed-rough' | 'crashed-water'
  // 'crashed-ground' | 'fuel-empty' | null.
  update(dt, input) {
    const wasGround = this.onGround;
    // --- controls ---
    const targetPitch = input.pitchCommand * PLANE.maxPitch;
    const targetBank = input.bankCommand * PLANE.maxBank;
    this.pitch += (targetPitch - this.pitch) * Math.min(1, PLANE.pitchRate * dt * 2.2);
    this.bank += (targetBank - this.bank) * Math.min(1, PLANE.bankRate * dt * 2.2);
    if (input.bankCommand === 0) this.bank *= Math.max(0, 1 - 0.9 * dt); // wings level themselves
    if (input.pitchCommand === 0) this.pitch *= Math.max(0, 1 - 0.5 * dt);
    this.throttle = Math.max(
      0,
      Math.min(1, this.throttle + input.throttleCommand * PLANE.throttleRate * dt),
    );

    // --- fuel ---
    const burn = PLANE.fuelBurnIdle + (PLANE.fuelBurn - PLANE.fuelBurnIdle) * this.throttle;
    if (!this.onGround || this.speed > 5) this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel <= 0 && !this.engineOut) {
      this.engineOut = true;
      return 'fuel-empty';
    }

    // --- speed: throttle pulls toward its target, drag and climb bleed it ---
    const effectiveThrottle = this.engineOut ? 0 : this.throttle;
    const targetSpeed = effectiveThrottle * PLANE.maxSpeed;
    const climbBleed = Math.sin(this.pitch) * 9;
    this.speed += (targetSpeed - this.speed) * Math.min(1, PLANE.accel * dt / PLANE.maxSpeed * 2.2);
    this.speed -= climbBleed * dt;
    this.speed -= this.speed * PLANE.drag * 0.12 * dt;
    if (this.onGround) this.speed = Math.max(0, this.speed);
    else this.speed = Math.max(8, this.speed);

    // --- turn: a banked wing turns the nose (coordinated turn) ---
    if (!this.onGround && this.speed > 5) {
      const turnRate = (9.81 * Math.tan(this.bank)) / Math.max(12, this.speed);
      this.yaw += turnRate * dt;
    }

    // --- move ---
    const fwd = this.forward();
    let vy = fwd.y * this.speed;
    // Below stall speed the wing quits: the plane sinks instead of flying.
    if (!this.onGround && this.speed < PLANE.stallSpeed) {
      vy -= (PLANE.stallSpeed - this.speed) * 0.55;
    }
    // The wind pushes the plane sideways in the air; on the ground the
    // wheels grip and it barely drifts, and a parked plane does not move.
    const windFactor = this.onGround ? (this.speed < 1 ? 0 : 0.25) : 1;
    this.x += (fwd.x * this.speed + WORLD.wind.x * windFactor) * dt;
    this.z += (fwd.z * this.speed + WORLD.wind.z * windFactor) * dt;
    const prevY = this.y;
    this.y += vy * dt;
    this.verticalSpeed = (this.y - prevY) / Math.max(dt, 1e-6);

    // --- ground ---
    const ground = terrainHeight(this.x, this.z);
    const gearY = ground + PLANE.gearHeight;
    // While rolling, the wheels keep the plane glued to the ground until it
    // is fast enough to fly: without this, a pull on the stick at low speed
    // lifts the nose a hair, the model calls it airborne, and the stall sink
    // slams it back down as a crash.
    if (wasGround && this.y > gearY && !(this.speed > PLANE.stallSpeed + 2 && this.pitch > 0.03)) {
      this.y = gearY;
    }
    if (this.y <= gearY) {
      this.y = gearY;
      const vs = this.verticalSpeed;
      const overStrip = stripAt(this.x, this.z);
      const gentle = vs > -3.2 && Math.abs(this.bank) < 0.18 && this.speed < 55;
      if (!wasGround) {
        if (ground <= 0.5 && !overStrip) return 'crashed-water';
        if (overStrip && gentle) {
          this.onGround = true;
          this.speed *= 0.55;
          return 'landed-perfect';
        }
        if (gentle) {
          this.onGround = true;
          this.speed *= 0.4;
          this.damage += 12;
          return 'landed-rough';
        }
        if (vs > -7) {
          this.onGround = true;
          this.speed *= 0.25;
          this.damage += 30;
          return this.damage >= 100 ? 'crashed-ground' : 'landed-rough';
        }
        return 'crashed-ground';
      }
      this.onGround = true;
      // Rotate: enough speed plus a pull on the stick lifts the plane off.
      if (this.speed > PLANE.stallSpeed + 2 && this.pitch > 0.03) {
        this.onGround = false;
        this.y = gearY + 0.5;
        return 'takeoff';
      }
      // Rolling on the ground: friction + steering follows the nose.
      // (No pitch/bank damping here: it would cap the rotation pitch below
      // the liftoff threshold and the plane could never leave the ground.
      // And no "stop below 1 m/s" snap: it would eat each step's acceleration
      // and the takeoff roll could never build speed.)
      this.speed = Math.max(0, this.speed - 9 * dt);
      // Rolling off a strip into the sea is a ditching, not a drive.
      if (ground <= 0.5 && !stripAt(this.x, this.z)) return 'crashed-water';
    } else {
      if (wasGround && this.speed > PLANE.stallSpeed + 4) {
        this.onGround = false;
        return 'takeoff';
      }
      this.onGround = false;
    }
    if (this.damage >= 100) return 'crashed-ground';
    return null;
  }

  applyToMesh(mesh, time) {
    mesh.position.set(this.x, this.y, this.z);
    mesh.rotation.order = 'YXZ';
    mesh.rotation.y = this.yaw;
    mesh.rotation.x = -this.pitch;
    mesh.rotation.z = -this.bank;
    const prop = mesh.userData.propeller;
    if (prop) prop.rotation.z += (2 + this.throttle * 38) * 0.016;
  }
}
