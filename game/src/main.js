// Island Pilot — bootstrap, game loop, camera, scoring and state machine.
// States: menu → flying ⇄ landed (refuel) → crashed / complete. R restarts,
// P pauses, Enter starts, M mutes. ?shot= presets stage composed screenshots.
import * as THREE from 'three';
import { WORLD, ISLANDS, PLANE, SCORE, STAMPS, COLOURS } from './config.js';
import { pickSeedFromQuery } from './random.js';
import { Input } from './input.js';
import {
  terrainHeight, islandAt, stripAt,
  buildTerrainMesh, buildOcean, buildRunways, buildClouds, buildPalmTrees,
} from './terrain.js';
import { buildPlaneMesh, FlightModel } from './plane.js';
import { RingCourse } from './rings.js';
import { Hud } from './hud.js';
import { SoundBank } from './audio.js';
import { shotPreset } from './shots.js';

const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLOURS.sky);
scene.fog = new THREE.Fog(COLOURS.horizon, WORLD.fogNear, WORLD.fogFar);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 9000);
camera.position.set(0, 30, -180);

const sun = new THREE.DirectionalLight(0xfff2d8, 2.6);
sun.position.set(1800, 2600, -1200);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfdcff, 0x3d6b35, 1.15));

scene.add(buildTerrainMesh());
scene.add(buildOcean());
scene.add(buildRunways());
const seed = pickSeedFromQuery(window.location.search);
scene.add(buildClouds(seed));
scene.add(buildPalmTrees(seed));
const clouds = scene.getObjectByName('clouds');

const planeMesh = buildPlaneMesh();
scene.add(planeMesh);
const flight = new FlightModel();
const rings = new RingCourse(scene);
const hud = new Hud();
const sounds = new SoundBank();
const input = new Input(canvas);

const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayBody = document.getElementById('overlay-body');
const overlayHint = document.getElementById('overlay-hint');

let state = 'menu'; // menu | flying | paused | crashed | complete
let score = 0;
let timeSec = 0;
let stamps = [];
let shotMode = null;
let camPos = new THREE.Vector3(0, 30, -180);
let camLook = new THREE.Vector3(0, 10, 0);

function showOverlay(title, body, hint) {
  overlayTitle.textContent = title;
  overlayBody.innerHTML = body;
  overlayHint.textContent = hint;
  overlay.classList.remove('hidden');
}

function hideOverlay() {
  overlay.classList.add('hidden');
}

function resetGame() {
  flight.reset();
  rings.reset();
  score = 0;
  timeSec = 0;
  stamps = [];
  flight.applyToMesh(planeMesh, 0);
}

function startFlying() {
  resetGame();
  state = 'flying';
  hideOverlay();
  sounds.ensure();
  hud.showToast('Harbor Island — throttle up (W) and fly the rings!');
}

function endCrash(reason) {
  state = 'crashed';
  sounds.thud();
  showOverlay(
    'Crashed!',
    `${reason}<br><br>Score so far: <b>${score}</b> · Rings ${rings.nextIndex}/${rings.rings.length} · Stamps ${stamps.length}/3`,
    'Press R to fly again',
  );
}

function endComplete() {
  state = 'complete';
  score += SCORE.completionBonus;
  const mins = Math.floor(timeSec / 60);
  const secs = Math.floor(timeSec % 60);
  showOverlay(
    'Island Hop Complete!',
    `All 6 rings and all 3 island stamps — the full circuit, flown and landed.<br><br>` +
    `Time ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} · ` +
    `Fuel left ${Math.round(flight.fuel)}% · Damage ${Math.round(flight.damage)}%<br>` +
    `Completion bonus +${SCORE.completionBonus} · <b>Total score ${score}</b>`,
    'Press R to fly the circuit again',
  );
}

function awardLanding(kind, island) {
  const points = kind === 'perfect' ? SCORE.landingPerfect
    : kind === 'good' ? SCORE.landingGood : SCORE.landingRough;
  score += points;
  const label = kind === 'perfect' ? 'Perfect landing!' : kind === 'good' ? 'Good landing!' : 'Hard landing!';
  hud.showToast(`${label} +${points}`);
  if (island) {
    const stamp = STAMPS.find((s) => s.islandId === island.id);
    if (stamp && !stamps.includes(stamp.label)) {
      stamps.push(stamp.label);
      score += SCORE.stampBonus;
      hud.showToast(`${island.name} stamped ✓ +${SCORE.stampBonus}`, 3200);
      sounds.chime();
    }
  }
  // A strip refuels the plane and patches a little damage.
  flight.fuel = PLANE.fuelCapacity;
  flight.damage = Math.max(0, flight.damage - 20);
  checkComplete();
}

function checkComplete() {
  const allRings = rings.nextIndex >= rings.rings.length;
  const allStamps = stamps.length >= STAMPS.length;
  const home = flight.onGround && islandAt(flight.x, flight.z)?.id === 'home';
  if (allRings && allStamps && home && state === 'flying') endComplete();
}

function handleFlightEvent(event) {
  if (!event) return;
  if (event === 'takeoff') {
    hud.showToast('Airborne! Gear up in spirit — fly the rings.');
  } else if (event === 'fuel-empty') {
    hud.showToast('Fuel empty! Glide to the nearest strip.', 4000);
  } else if (event === 'crashed-water') {
    endCrash('Ditched in the sea — the water is not a runway. Watch your altitude over the ocean.');
  } else if (event === 'crashed-ground') {
    endCrash('The terrain won that one — come in slower, wings level, over a strip.');
  } else if (event.startsWith('landed')) {
    const island = islandAt(flight.x, flight.z);
    const kind = event === 'landed-perfect' ? 'perfect' : event === 'landed-good' ? 'good' : 'rough';
    awardLanding(kind, island);
  }
}

// --- camera: chase view that never fights the pilot ---
function updateCamera(dt, preset) {
  const fwd = flight.forward();
  const dist = preset?.distance ?? 15;
  const height = preset?.height ?? 4.5;
  const lookAhead = preset?.lookAhead ?? 30;
  const desired = new THREE.Vector3(
    flight.x - fwd.x * dist + Math.sin(flight.yaw + input.lookYaw) * 0,
    flight.y + height - fwd.y * dist * 0.4,
    flight.z - fwd.z * dist,
  );
  // Mouse look swings the camera around the plane.
  if (input.lookYaw !== 0 || input.lookPitch !== 0) {
    const a = flight.yaw + Math.PI + input.lookYaw;
    desired.set(
      flight.x + Math.sin(a) * dist,
      flight.y + height + input.lookPitch * 10,
      flight.z + Math.cos(a) * dist,
    );
  }
  // Keep the camera out of the sea and out of the hills.
  const minY = Math.max(terrainHeight(desired.x, desired.z) + 2.5, 1.8);
  desired.y = Math.max(desired.y, minY);
  const k = 1 - Math.exp(-dt * 5);
  camPos.lerp(desired, k);
  const lookTarget = new THREE.Vector3(
    flight.x + fwd.x * lookAhead,
    flight.y + fwd.y * lookAhead + 1,
    flight.z + fwd.z * lookAhead,
  );
  camLook.lerp(lookTarget, 1 - Math.exp(-dt * 8));
  camera.position.copy(camPos);
  camera.lookAt(camLook);
}

// --- screenshot presets ---
function applyShot(preset) {
  shotMode = preset;
  const p = preset.plane;
  flight.x = p.x; flight.y = p.y; flight.z = p.z;
  flight.yaw = p.yaw; flight.pitch = p.pitch; flight.bank = p.bank;
  flight.speed = p.speed; flight.throttle = p.throttle;
  flight.fuel = p.fuel; flight.onGround = p.onGround;
  flight.verticalSpeed = 0;
  // Stage the course state each shot implies.
  if (preset.name === 'play') {
    rings.nextIndex = 1;
    rings.rings[0].passed = true;
    rings.rings[0].group.userData.torus.material = new THREE.MeshBasicMaterial({ color: COLOURS.ringDone });
  }
  if (preset.name === 'end') {
    rings.nextIndex = 2;
    for (let i = 0; i < 2; i++) {
      rings.rings[i].passed = true;
      rings.rings[i].group.userData.torus.material = new THREE.MeshBasicMaterial({ color: COLOURS.ringDone });
    }
    stamps = ['Palm Cay'];
    score = 350;
  }
  if (preset.name === 'start') score = 0;
  state = 'flying';
  hideOverlay();
  flight.applyToMesh(planeMesh, 0);
  updateCamera(1, preset.camera);
  hud.showToast(preset.toast, 60000);
  document.getElementById('hud-ring').textContent = preset.mission;
  window.__ready = true;
}

// --- main loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  // Clamp dt to [0, 0.05]: a first frame stamped before `last` would otherwise
  // go negative and poison vertical speed (and the clock) with a huge value.
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = now;

  if (input.pressed('m')) {
    const muted = sounds.toggleMute();
    hud.showToast(muted ? 'Sound off' : 'Sound on', 1200);
  }
  if (state === 'menu' && (input.pressed('enter') || input.pressed(' '))) startFlying();
  if ((state === 'crashed' || state === 'complete') && input.pressed('r')) startFlying();
  if (state === 'flying' && input.pressed('p')) {
    state = 'paused';
    showOverlay('Paused', 'The island circuit is waiting.', 'Press P to keep flying · R to restart');
  } else if (state === 'paused' && input.pressed('p')) {
    state = 'flying';
    hideOverlay();
  }
  if (state === 'paused' && input.pressed('r')) startFlying();

  if (state === 'flying') {
    timeSec += dt;
    const event = flight.update(dt, input);
    handleFlightEvent(event);
    const passed = rings.checkPass(flight.x, flight.y, flight.z);
    if (passed) {
      score += SCORE.ring;
      sounds.chime();
      hud.showToast(`Ring ${passed.index + 1} cleared! +${SCORE.ring}`);
    }
    sounds.setEngine(flight.throttle, flight.speed, !flight.onGround);
  }

  flight.applyToMesh(planeMesh, now / 1000);
  rings.animate(now / 1000);
  if (clouds) {
    clouds.position.x += WORLD.wind.x * dt * 0.4;
    if (clouds.position.x > 800) clouds.position.x = -800;
  }
  updateCamera(dt, shotMode?.camera ?? null);

  const ground = terrainHeight(flight.x, flight.z);
  hud.update({
    speed: flight.speed,
    altitudeFt: Math.max(0, (flight.y - Math.max(ground, 0)) * 3.28),
    headingDeg: flight.headingDegrees(),
    fuel: flight.fuel,
    throttle: flight.throttle,
    score,
    timeSec,
    ringIndex: rings.nextIndex,
    ringTotal: rings.rings.length,
    ringDist: rings.distanceToActive(flight.x, flight.y, flight.z),
    ringBearingDeg: (rings.bearingToActive(flight.x, flight.z, flight.yaw) * 180) / Math.PI,
    stamps,
    vspeed: flight.verticalSpeed,
    pitch: flight.pitch,
    bank: flight.bank,
    windKts: Math.hypot(WORLD.wind.x, WORLD.wind.z) * 1.944,
    damage: flight.damage,
  });
  input.endFrame();
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('overlay-start').addEventListener('click', startFlying);

// Menu first, unless a screenshot preset stages the scene.
const preset = shotPreset(window.location.search);
if (preset) {
  applyShot(preset);
} else {
  showOverlay(
    'ISLAND PILOT',
    `A bush-plane island hop: take off from Harbor Island, thread all 6 golden rings, ` +
    `and land on Palm Cay, Turtle Bay and Volcano Rock to collect their stamps — ` +
    `then bring her home. Fuel is real: land on a strip to refuel.<br><br>` +
    `<b>↑ / ↓</b> pitch &nbsp;·&nbsp; <b>← / →</b> bank &amp; turn &nbsp;·&nbsp; ` +
    `<b>W / S</b> throttle &nbsp;·&nbsp; <b>Drag</b> look around &nbsp;·&nbsp; ` +
    `<b>P</b> pause &nbsp;·&nbsp; <b>M</b> sound &nbsp;·&nbsp; <b>R</b> restart`,
    'Click Start or press Enter to fly',
  );
  document.getElementById('overlay-start').style.display = 'inline-block';
  flight.applyToMesh(planeMesh, 0);
  updateCamera(1, { distance: 16, height: 5, lookAhead: 30 });
  window.__ready = true;
}
// Playtest hook: exposes live state and a manual physics step for automated
// checks (not part of the game). step() runs the flight model with synthetic
// commands and reports the event plus a state snapshot.
window.__debug = {
  flight, rings,
  get state() { return state; },
  get score() { return score; },
  step(dt, cmds = {}) {
    const input = {
      pitchCommand: cmds.pitch ?? 0,
      bankCommand: cmds.bank ?? 0,
      throttleCommand: cmds.throttle ?? 0,
    };
    const event = flight.update(dt, input);
    const ring = rings.checkPass(flight.x, flight.y, flight.z);
    return {
      event, ring: ring ? ring.index : null,
      x: flight.x, y: flight.y, z: flight.z,
      speed: flight.speed, onGround: flight.onGround, fuel: flight.fuel,
      yaw: flight.yaw, pitch: flight.pitch, bank: flight.bank,
      damage: flight.damage, nextRing: rings.nextIndex,
    };
  },
};
requestAnimationFrame(frame);
