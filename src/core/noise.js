// Value-noise based terrain noise. We roll our own instead of shipping a
// dependency so that world generation is small, fast and identical everywhere.

import { rand2, rand3 } from './random.js';

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** 2D value noise in [0, 1]. */
export function noise2(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = fade(xf);
  const v = fade(yf);
  const a = rand2(xi, yi, seed);
  const b = rand2(xi + 1, yi, seed);
  const c = rand2(xi, yi + 1, seed);
  const d = rand2(xi + 1, yi + 1, seed);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return top + (bottom - top) * v;
}

/** 3D value noise in [0, 1]. */
export function noise3(x, y, z, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const xf = x - xi;
  const yf = y - yi;
  const zf = z - zi;
  const u = fade(xf);
  const v = fade(yf);
  const w = fade(zf);

  const c000 = rand3(xi, yi, zi, seed);
  const c100 = rand3(xi + 1, yi, zi, seed);
  const c010 = rand3(xi, yi + 1, zi, seed);
  const c110 = rand3(xi + 1, yi + 1, zi, seed);
  const c001 = rand3(xi, yi, zi + 1, seed);
  const c101 = rand3(xi + 1, yi, zi + 1, seed);
  const c011 = rand3(xi, yi + 1, zi + 1, seed);
  const c111 = rand3(xi + 1, yi + 1, zi + 1, seed);

  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;

  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;

  return y0 + (y1 - y0) * w;
}

/** Fractal brownian motion of 2D value noise, returns roughly [-1, 1]. */
export function fbm2(x, y, octaves = 4, seed = 0, gain = 0.5, lacunarity = 2) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (noise2(x * freq, y * freq, seed + i * 131) * 2 - 1) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

/** Fractal brownian motion of 3D value noise, returns roughly [-1, 1]. */
export function fbm3(x, y, z, octaves = 3, seed = 0, gain = 0.5, lacunarity = 2) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += (noise3(x * freq, y * freq, z * freq, seed + i * 197) * 2 - 1) * amp;
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
