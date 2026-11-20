// PBR support for the procedural atlas: derive a normal map, a roughness map
// and a metalness map from the painted colour atlas. Everything is computed
// from pixels at boot, so the repository still contains no image assets.

import * as THREE from '../../vendor/three/three.module.js';
import { getAtlas, ATLAS_TILE, ATLAS_GRID } from './atlas.js';
import { TILE } from './blocks.js';

const SHINY = {
  [TILE.IRON_BLOCK]: [0.22, 0.9],
  [TILE.GOLD_BLOCK]: [0.18, 0.95],
  [TILE.DIAMOND_BLOCK]: [0.12, 0.55],
  [TILE.EMERALD_BLOCK]: [0.16, 0.6],
  [TILE.LAPIS_BLOCK]: [0.4, 0.25],
  [TILE.COPPER_BLOCK]: [0.3, 0.75],
  [TILE.NETHERITE_BLOCK]: [0.24, 0.9],
  [TILE.AMETHYST]: [0.18, 0.3],
  [TILE.GLASS]: [0.05, 0.15],
  [TILE.ICE]: [0.08, 0.1],
  [TILE.WATER]: [0.05, 0.1],
  [TILE.QUARTZ]: [0.45, 0.2],
  [TILE.SMOOTH_STONE]: [0.55, 0.1],
  [TILE.POLISHED_GRANITE]: [0.5, 0.14],
  [TILE.POLISHED_DIORITE]: [0.5, 0.14],
  [TILE.POLISHED_ANDESITE]: [0.5, 0.14],
  [TILE.COAL_BLOCK]: [0.42, 0.35],
  [TILE.COAL_ORE]: [0.5, 0.35],
  [TILE.IRON_ORE]: [0.42, 0.45],
  [TILE.GOLD_ORE]: [0.38, 0.5],
  [TILE.DIAMOND_ORE]: [0.36, 0.35],
  [TILE.EMERALD_ORE]: [0.4, 0.35],
  [TILE.LAPIS_ORE]: [0.5, 0.2],
  [TILE.REDSTONE_ORE]: [0.48, 0.2],
  [TILE.COPPER_ORE]: [0.45, 0.4],
  [TILE.GLOWSTONE]: [0.85, 0.0],
  [TILE.LANTERN]: [0.35, 0.55],
  [TILE.TORCH]: [0.9, 0.0],
  [TILE.SNOW]: [0.72, 0.0],
  [TILE.BONE_BLOCK]: [0.62, 0.05],
};

const FLAT = new Set([
  TILE.WOOL_WHITE,
  TILE.WOOL_RED,
  TILE.WOOL_ORANGE,
  TILE.WOOL_YELLOW,
  TILE.WOOL_GREEN,
  TILE.WOOL_BLUE,
  TILE.WOOL_PURPLE,
  TILE.WOOL_BLACK,
  TILE.SAND,
  TILE.SANDSTONE,
  TILE.SANDSTONE_TOP,
  TILE.TALL_GRASS,
  TILE.FLOWER_RED,
  TILE.FLOWER_YELLOW,
  TILE.SAPLING,
  TILE.DEAD_BUSH,
]);

let cached = null;

/** Normal / roughness / metalness canvas textures for the atlas. */
export function getPBRMaps() {
  if (cached) return cached;
  const atlas = getAtlas();
  const size = ATLAS_TILE * ATLAS_GRID;
  const ctx = atlas.canvas.getContext('2d', { willReadFrequently: true });
  const source = ctx.getImageData(0, 0, size, size).data;

  const normalCanvas = document.createElement('canvas');
  normalCanvas.width = size;
  normalCanvas.height = size;
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = size;
  metalCanvas.height = size;

  const nctx = normalCanvas.getContext('2d');
  const rctx = roughCanvas.getContext('2d');
  const mctx = metalCanvas.getContext('2d');
  const normal = nctx.createImageData(size, size);
  const rough = rctx.createImageData(size, size);
  const metal = mctx.createImageData(size, size);

  const lum = new Float32Array(size * size);
  for (let i = 0, p = 0; i < size * size; i++, p += 4) {
    // Perceptual luminance, plus a little of the red/green spread so coloured
    // details also produce bumps.
    lum[i] = (source[p] * 0.299 + source[p + 1] * 0.587 + source[p + 2] * 0.114) / 255;
  }

  const strength = 1.7;
  for (let ty = 0; ty < ATLAS_GRID; ty++) {
    for (let tx = 0; tx < ATLAS_GRID; tx++) {
      const tile = ty * ATLAS_GRID + tx;
      const [baseRough, baseMetal] = SHINY[tile] || (tile === TILE.STONE ? [0.72, 0.02] : [0.82, 0.02]);
      const flat = FLAT.has(tile) ? 0.35 : 1;
      for (let y = 0; y < ATLAS_TILE; y++) {
        for (let x = 0; x < ATLAS_TILE; x++) {
          const px = tx * ATLAS_TILE + x;
          const py = ty * ATLAS_TILE + y;
          const idx = py * size + px;
          const lx = Math.min(ATLAS_TILE - 1, Math.max(0, x - 1));
          const rx = Math.min(ATLAS_TILE - 1, Math.max(0, x + 1));
          const uy = Math.min(ATLAS_TILE - 1, Math.max(0, y - 1));
          const dy = Math.min(ATLAS_TILE - 1, Math.max(0, y + 1));
          const left = lum[py * size + (tx * ATLAS_TILE + lx)];
          const right = lum[py * size + (tx * ATLAS_TILE + rx)];
          const up = lum[(ty * ATLAS_TILE + uy) * size + px];
          const down = lum[(ty * ATLAS_TILE + dy) * size + px];
          const dx = (right - left) * strength * flat;
          const dyv = (down - up) * strength * flat;
          const len = Math.hypot(dx, dyv, 1);
          const p = idx * 4;
          normal.data[p] = Math.round((( -dx / len) * 0.5 + 0.5) * 255);
          normal.data[p + 1] = Math.round(((-dyv / len) * 0.5 + 0.5) * 255);
          normal.data[p + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255);
          normal.data[p + 3] = 255;

          const variation = 1 - lum[idx] * 0.25;
          const r = Math.max(0.03, Math.min(1, baseRough * variation));
          rough.data[p] = 255;
          rough.data[p + 1] = Math.round(r * 255);
          rough.data[p + 2] = 255;
          rough.data[p + 3] = 255;

          const m = Math.max(0, Math.min(1, baseMetal));
          metal.data[p] = 255;
          metal.data[p + 1] = 255;
          metal.data[p + 2] = Math.round(m * 255);
          metal.data[p + 3] = 255;
        }
      }
    }
  }

  nctx.putImageData(normal, 0, 0);
  rctx.putImageData(rough, 0, 0);
  mctx.putImageData(metal, 0, 0);

  const makeTexture = (canvas, colorSpace) => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.colorSpace = colorSpace;
    tex.needsUpdate = true;
    return tex;
  };

  cached = {
    normalMap: makeTexture(normalCanvas, THREE.NoColorSpace),
    roughnessMap: makeTexture(roughCanvas, THREE.NoColorSpace),
    metalnessMap: makeTexture(metalCanvas, THREE.NoColorSpace),
  };
  return cached;
}

/** A tiny procedural environment so metals and ice have something to reflect. */
export function getEnvironment(renderer, sky = { top: '#7fb7e8', bottom: '#dfeaf2' }) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 32);
  grad.addColorStop(0, sky.top);
  grad.addColorStop(0.55, '#cfe4f2');
  grad.addColorStop(1, sky.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 32);
  ctx.fillStyle = 'rgba(255,248,220,0.85)';
  ctx.beginPath();
  ctx.arc(46, 9, 4, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const target = pmrem.fromEquirectangular(texture);
  pmrem.dispose();
  texture.dispose();
  return target.texture;
}
