// Tiny deterministic hashing / PRNG helpers.
// Everything in the world is generated from integer hashes so that chunks are
// reproducible no matter in which order they are built.

const UINT32 = 4294967296;

/** Hash two integers + seed to an unsigned 32 bit integer. */
export function hash2i(x, y, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Hash three integers + seed to an unsigned 32 bit integer. */
export function hash3i(x, y, z, seed = 0) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(z | 0, 0x1b873593) ^ Math.imul(seed | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Deterministic float in [0, 1) from a 2D coordinate + seed. */
export function rand2(x, y, seed = 0) {
  return hash2i(x, y, seed) / UINT32;
}

/** Deterministic float in [0, 1) from a 3D coordinate + seed. */
export function rand3(x, y, z, seed = 0) {
  return hash3i(x, y, z, seed) / UINT32;
}

/** Deterministic integer in [0, n) from a 2D coordinate + seed. */
export function randInt2(x, y, seed, n) {
  return hash2i(x, y, seed) % n;
}

/** Fast seeded PRNG, used for texture painting. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32;
  };
}

/** Pick a random element from an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
