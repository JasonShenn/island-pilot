// Island Pilot — world constants: islands, strips, ring course, physics tuning.
// All distances in metres, speeds in m/s, angles in radians unless noted.
export const WORLD = {
  size: 6000, // terrain spans -3000..3000 on x and z
  seaLevel: 0,
  fogNear: 900,
  fogFar: 4200,
  wind: { x: 6.0, z: 2.5 }, // steady breeze from the west, pushes the plane east
};

// One island = one gaussian bump plus an optional flattened landing strip.
export const ISLANDS = [
  {
    id: 'home',
    name: 'Harbor Island',
    x: 0, z: 0, radius: 650, height: 55,
    strip: { x: 0, z: 0, length: 420, width: 34, heading: 0, elevation: 9 },
  },
  {
    id: 'palm',
    name: 'Palm Cay',
    x: 1500, z: 800, radius: 420, height: 42,
    strip: { x: 1500, z: 800, length: 320, width: 28, heading: Math.PI / 2, elevation: 8 },
  },
  {
    id: 'turtle',
    name: 'Turtle Bay',
    x: -1300, z: 1300, radius: 480, height: 48,
    strip: { x: -1300, z: 1300, length: 340, width: 28, heading: 0, elevation: 8 },
  },
  {
    id: 'volcano',
    name: 'Volcano Rock',
    x: 400, z: 2600, radius: 380, height: 95,
    strip: { x: 400, z: 2600, length: 300, width: 26, heading: Math.PI / 2, elevation: 10 },
  },
];

// Ring course: fly through in order. Each ring knows which island landing it points at.
export const RINGS = [
  { x: 0, y: 70, z: 450, r: 26 },
  { x: 800, y: 110, z: 700, r: 26 },
  { x: 1500, y: 85, z: 800, r: 24 },
  { x: 100, y: 140, z: 1400, r: 26 },
  { x: -1300, y: 95, z: 1300, r: 24 },
  { x: 400, y: 170, z: 2600, r: 26 },
];

// Island stamps: landing on a strip earns its stamp once.
export const STAMPS = [
  { islandId: 'palm', label: 'Palm Cay' },
  { islandId: 'turtle', label: 'Turtle Bay' },
  { islandId: 'volcano', label: 'Volcano Rock' },
];

export const PLANE = {
  maxSpeed: 92, // m/s at full throttle, level flight
  cruiseSpeed: 62,
  stallSpeed: 27, // below this the wing stops flying and the plane sinks
  maxBank: 0.9, // radians, about 52 degrees — tight enough to thread rings
  maxPitch: 0.28,
  pitchRate: 0.55, // rad/s toward the commanded pitch
  bankRate: 1.4, // rad/s toward the commanded bank
  throttleRate: 0.55, // per second
  accel: 14, // m/s^2 toward the throttle's target speed
  drag: 0.9,
  gearHeight: 1.4, // wheels below the fuselage centre
  fuelCapacity: 140,
  fuelBurn: 1.0, // units per second at full throttle
  fuelBurnIdle: 0.25,
};

export const SCORE = {
  ring: 100,
  landingPerfect: 250,
  landingGood: 120,
  landingRough: 40,
  stampBonus: 150,
  completionBonus: 500,
};

export const COLOURS = {
  sky: 0x8ec9e8,
  horizon: 0xdfeef7,
  sea: 0x1f6f9e,
  seaDeep: 0x155a82,
  sand: 0xe8d49a,
  grass: 0x5da24a,
  rock: 0x8a7d6b,
  runway: 0x3c4148,
  runwayLine: 0xf5f5f0,
  planeOrange: 0xe8712a,
  planeCream: 0xf7ead6,
  ringGold: 0xffc93c,
  ringDone: 0x39d353,
};
