// Seeded random numbers (mulberry32) so cloud placement and screenshots are
// deterministic for a given seed instead of changing every page load.
export function makeSeededRandom(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickSeedFromQuery(search) {
  const params = new URLSearchParams(search);
  const seed = Number.parseInt(params.get('seed') ?? '1', 10);
  return Number.isFinite(seed) ? seed : 1;
}
