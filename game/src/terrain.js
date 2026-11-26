// Terrain, ocean, runways, clouds and sky. One height function drives both the
// visible mesh and the flight model's ground collisions, so what you see is
// exactly what you can land on (or crash into).
import * as THREE from 'three';
import { WORLD, ISLANDS, COLOURS } from './config.js';
import { makeSeededRandom } from './random.js';

// Gaussian bump of one island, before runway flattening.
function islandBump(island, x, z) {
  const dx = x - island.x;
  const dz = z - island.z;
  const d2 = dx * dx + dz * dz;
  const r2 = island.radius * island.radius;
  return island.height * Math.exp(-d2 / (r2 * 0.55));
}

// How far (0..1) a point sits inside a strip's flattened apron. Local axes:
// lx is across the strip, lz is along it; the apron extends past the strip
// itself so the ground falls away smoothly instead of cliffing at its ends.
function stripInfluence(strip, x, z) {
  const c = Math.cos(-strip.heading);
  const s = Math.sin(-strip.heading);
  const lx = (x - strip.x) * c - (z - strip.z) * s;
  const lz = (x - strip.x) * s + (z - strip.z) * c;
  const ax = Math.abs(lx) / (strip.width / 2 + 100);
  const az = Math.abs(lz) / (strip.length / 2 + 130);
  const edge = Math.max(ax, az);
  if (edge >= 1) return 0;
  if (edge < 0.55) return 1;
  const t = (edge - 0.55) / 0.45;
  return 1 - t * t * (3 - 2 * t); // smoothstep falloff
}

export function terrainHeight(x, z) {
  let h = 0;
  for (const island of ISLANDS) h += islandBump(island, x, z);
  // Flatten the ground under each runway so the strip is truly level.
  for (const island of ISLANDS) {
    if (!island.strip) continue;
    const w = stripInfluence(island.strip, x, z);
    if (w > 0) h = h * (1 - w) + island.strip.elevation * w;
  }
  return h;
}

export function islandAt(x, z) {
  for (const island of ISLANDS) {
    const dx = x - island.x;
    const dz = z - island.z;
    if (dx * dx + dz * dz < island.radius * island.radius * 0.8) return island;
  }
  return null;
}

// Which strip (if any) the point is over, for landing detection: the tight
// rectangle of the paved strip itself, not the flattened apron around it.
export function stripAt(x, z) {
  for (const island of ISLANDS) {
    if (!island.strip) continue;
    const strip = island.strip;
    const c = Math.cos(-strip.heading);
    const s = Math.sin(-strip.heading);
    const lx = (x - strip.x) * c - (z - strip.z) * s;
    const lz = (x - strip.x) * s + (z - strip.z) * c;
    if (Math.abs(lx) < strip.width / 2 && Math.abs(lz) < strip.length / 2) return strip;
  }
  return null;
}

export function buildTerrainMesh() {
  const size = WORLD.size;
  const segments = 220;
  const geo = new THREE.PlaneGeometry(size, size, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(COLOURS.sand);
  const grass = new THREE.Color(COLOURS.grass);
  const rock = new THREE.Color(COLOURS.rock);
  const seabed = new THREE.Color(0x2a6d8f);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    let h = terrainHeight(x, z);
    if (h < 0.4) h = -6; // seabed under the ocean
    pos.setY(i, h);
    if (h <= 0.4) tmp.copy(seabed);
    else if (h < 4) tmp.copy(sand);
    else if (h < 30) tmp.copy(grass).lerp(sand, Math.max(0, (8 - h) / 6));
    else tmp.copy(grass).lerp(rock, Math.min(1, (h - 30) / 40));
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain';
  return mesh;
}

export function buildOcean() {
  const geo = new THREE.PlaneGeometry(WORLD.size * 2.4, WORLD.size * 2.4, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshPhongMaterial({
    color: COLOURS.sea,
    shininess: 90,
    specular: 0x99ccff,
    transparent: true,
    opacity: 0.94,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = WORLD.seaLevel;
  mesh.name = 'ocean';
  return mesh;
}

function buildRunwayStrip(strip) {
  const group = new THREE.Group();
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(strip.width, strip.length),
    new THREE.MeshLambertMaterial({ color: COLOURS.runway }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.rotation.z = strip.heading;
  pad.position.y = 0.15;
  group.add(pad);
  // Centreline dashes.
  const dashGeo = new THREE.PlaneGeometry(1.6, 14);
  const dashMat = new THREE.MeshBasicMaterial({ color: COLOURS.runwayLine });
  const dashes = Math.floor(strip.length / 32);
  for (let i = 0; i < dashes; i++) {
    const dash = new THREE.Mesh(dashGeo, dashMat);
    const along = -strip.length / 2 + 24 + (i * (strip.length - 48)) / Math.max(1, dashes - 1);
    dash.rotation.x = -Math.PI / 2;
    dash.rotation.z = strip.heading;
    const c = Math.cos(strip.heading);
    const s = Math.sin(strip.heading);
    dash.position.set(-along * s, 0.3, along * c);
    group.add(dash);
  }
  // Threshold bars at both ends.
  for (const end of [-1, 1]) {
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(strip.width * 0.8, 3),
      new THREE.MeshBasicMaterial({ color: COLOURS.runwayLine }),
    );
    bar.rotation.x = -Math.PI / 2;
    bar.rotation.z = strip.heading;
    const along = end * (strip.length / 2 - 8);
    const c = Math.cos(strip.heading);
    const s = Math.sin(strip.heading);
    bar.position.set(-along * s, 0.3, along * c);
    group.add(bar);
  }
  group.position.set(strip.x, strip.elevation, strip.z);
  group.name = 'runway';
  return group;
}

export function buildRunways() {
  const group = new THREE.Group();
  for (const island of ISLANDS) {
    if (island.strip) group.add(buildRunwayStrip(island.strip));
  }
  return group;
}

export function buildClouds(seed) {
  const rand = makeSeededRandom(seed);
  const group = new THREE.Group();
  const puffGeo = new THREE.SphereGeometry(1, 10, 8);
  const puffMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  for (let i = 0; i < 42; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(rand() * 3);
    for (let p = 0; p < puffs; p++) {
      const puff = new THREE.Mesh(puffGeo, puffMat);
      const s = 14 + rand() * 22;
      puff.scale.set(s, s * 0.45, s * 0.8);
      puff.position.set((rand() - 0.5) * 55, (rand() - 0.5) * 8, (rand() - 0.5) * 30);
      cloud.add(puff);
    }
    cloud.position.set(
      (rand() - 0.5) * WORLD.size * 1.6,
      180 + rand() * 160,
      (rand() - 0.5) * WORLD.size * 1.6,
    );
    group.add(cloud);
  }
  group.name = 'clouds';
  return group;
}

export function buildPalmTrees(seed) {
  // Little palm clusters near the strips so each island reads at a glance.
  const rand = makeSeededRandom(seed + 77);
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6b45 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f8f3e });
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 9, 6);
  const leafGeo = new THREE.ConeGeometry(4.5, 3.2, 6);
  for (const island of ISLANDS) {
    for (let i = 0; i < 14; i++) {
      const a = rand() * Math.PI * 2;
      const r = island.radius * (0.35 + rand() * 0.5);
      const x = island.x + Math.cos(a) * r;
      const z = island.z + Math.sin(a) * r;
      const h = terrainHeight(x, z);
      if (h < 5 || stripAt(x, z)) continue;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 4.5;
      trunk.rotation.z = (rand() - 0.5) * 0.25;
      palm.add(trunk);
      const leaves = new THREE.Mesh(leafGeo, leafMat);
      leaves.position.y = 10;
      palm.add(leaves);
      palm.position.set(x, h, z);
      group.add(palm);
    }
  }
  group.name = 'palms';
  return group;
}
