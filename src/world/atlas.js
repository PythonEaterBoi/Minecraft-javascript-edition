// Procedurally painted 16x16 pixel-art textures packed into a single atlas.
// Generating them in a canvas keeps the repository free of binary assets and
// lets the game run entirely offline from GitHub Pages.

import * as THREE from '../../vendor/three/three.module.js';
import { mulberry32 } from '../core/random.js';
import { TILE, faceTile } from './blocks.js';

export const ATLAS_TILE = 32; // on-screen pixels per tile
export const ATLAS_GRID = 8; // tiles per row/column
const LOGICAL = 16; // painter resolution (16x16 "Minecraft pixels")
const PX = ATLAS_TILE / LOGICAL;

class Brush {
  constructor(ctx, ox, oy, rand) {
    this.ctx = ctx;
    this.ox = ox;
    this.oy = oy;
    this.rand = rand;
    this.ctx.imageSmoothingEnabled = false;
  }

  dot(x, y, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.ox + x * PX, this.oy + y * PX, PX, PX);
  }

  rect(x, y, w, h, color) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(this.ox + x * PX, this.oy + y * PX, w * PX, h * PX);
  }

  fill(color) {
    this.rect(0, 0, LOGICAL, LOGICAL, color);
  }

  /** Random speckles: each logical pixel gets a colour from `colors`. */
  speckle(colors, density = 0.85) {
    for (let y = 0; y < LOGICAL; y++) {
      for (let x = 0; x < LOGICAL; x++) {
        if (this.rand() < density) {
          this.dot(x, y, colors[Math.floor(this.rand() * colors.length) % colors.length]);
        }
      }
    }
  }

  /** Scatter small irregular blobs. */
  blobs(count, colors, minSize = 1, maxSize = 3) {
    for (let i = 0; i < count; i++) {
      const w = minSize + Math.floor(this.rand() * (maxSize - minSize + 1));
      const h = minSize + Math.floor(this.rand() * (maxSize - minSize + 1));
      const x = Math.floor(this.rand() * (LOGICAL - w));
      const y = Math.floor(this.rand() * (LOGICAL - h));
      const c = colors[Math.floor(this.rand() * colors.length) % colors.length];
      this.rect(x, y, w, h, c);
      if (this.rand() < 0.5) this.dot(x, y, colors[Math.floor(this.rand() * colors.length) % colors.length]);
    }
  }

  hLine(y, color, x0 = 0, x1 = LOGICAL) {
    this.rect(x0, y, x1 - x0, 1, color);
  }

  vLine(x, color, y0 = 0, y1 = LOGICAL) {
    this.rect(x, y0, 1, y1 - y0, color);
  }
}

/* ------------------------------------------------------------------ */
/* Tile painters                                                       */
/* ------------------------------------------------------------------ */

const PAINTERS = [];

// 0 GRASS_TOP
PAINTERS[TILE.GRASS_TOP] = (b) => {
  b.fill('#6da84a');
  b.speckle(['#649f44', '#75b353', '#689f47', '#79b957'], 0.45);
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(b.rand() * 14);
    const y = Math.floor(b.rand() * 14);
    b.rect(x, y, 1 + Math.floor(b.rand() * 2), 1, b.rand() < 0.5 ? '#7fbe5b' : '#5c9640');
  }
  b.blobs(4, ['#5f9941', '#7bbc58'], 1, 2);
};

// 1 GRASS_SIDE
PAINTERS[TILE.GRASS_SIDE] = (b) => {
  b.fill('#8a6140');
  b.speckle(['#7c5537', '#956a48', '#805b3c', '#9c7050'], 0.7);
  for (let x = 0; x < LOGICAL; x++) {
    const depth = 3 + Math.floor(b.rand() * 2);
    for (let y = 0; y < depth; y++) {
      b.dot(x, y, ['#6da84a', '#639c43', '#78b355'][Math.floor(b.rand() * 3)]);
    }
    if (b.rand() < 0.35) b.dot(x, depth, '#5f9941');
  }
};

// 2 DIRT
PAINTERS[TILE.DIRT] = (b) => {
  b.fill('#8a6140');
  b.speckle(['#835a3b', '#956a48', '#865e3e', '#92684a'], 0.5);
  b.blobs(7, ['#7a5234', '#9c7355'], 1, 2);
};

// 3 STONE
PAINTERS[TILE.STONE] = (b) => {
  b.fill('#7f7f7f');
  b.speckle(['#858585', '#787878', '#7b7b7b', '#838383'], 0.5);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(b.rand() * 12);
    const y = Math.floor(b.rand() * 14);
    b.rect(x, y, 3 + Math.floor(b.rand() * 2), 1, '#6f6f6f');
  }
  b.blobs(3, ['#727272', '#8b8b8b'], 1, 2);
};

// 4 COBBLE
PAINTERS[TILE.COBBLE] = (b) => {
  b.fill('#4e4e4e');
  const cells = [
    [0, 0, 7, 5], [8, 0, 8, 5], [0, 6, 5, 4], [6, 6, 5, 4],
    [12, 6, 4, 4], [0, 11, 7, 5], [8, 11, 4, 5], [13, 11, 3, 5],
  ];
  for (const [x, y, w, h] of cells) {
    const base = ['#8b8b8b', '#7d7d7d', '#949494', '#868686'][Math.floor(b.rand() * 4)];
    b.rect(x, y, w - 1, h - 1, base);
    b.rect(x, y, w - 1, 1, '#9c9c9c');
    b.rect(x, y + h - 2, w - 1, 1, '#6b6b6b');
  }
  b.speckle(['#6f6f6f', '#a0a0a0', '#777777'], 0.25);
};

// 5 SAND
PAINTERS[TILE.SAND] = (b) => {
  b.fill('#e5d7a4');
  b.speckle(['#dfd09b', '#ebdeaf', '#dccc95', '#e9dcac'], 0.5);
  b.blobs(5, ['#d3c28c', '#efe4bb'], 1, 2);
};

// 6 GRAVEL
PAINTERS[TILE.GRAVEL] = (b) => {
  b.fill('#7c7771');
  b.speckle(['#8a857f', '#6d6863', '#948d86', '#736e69'], 0.7);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(b.rand() * 14);
    const y = Math.floor(b.rand() * 14);
    b.rect(x, y, 2, 2, ['#a49c93', '#5e5954', '#8d877f'][Math.floor(b.rand() * 3)]);
    b.dot(x + 1, y + 1, '#4d4945');
  }
};

// 7 WATER
PAINTERS[TILE.WATER] = (b) => {
  // Deliberately low contrast: this tile repeats once per block, so strong
  // features would read as a checkerboard on the ocean surface.
  b.fill('#2f6499');
  const palette = ['#2f6499', '#2d6195', '#31679d', '#336aa1'];
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      b.dot(x, y, palette[Math.floor(b.rand() * palette.length)]);
    }
  }
  for (let i = 0; i < 6; i++) {
    const y = 1 + Math.floor(b.rand() * 14);
    const x = 1 + Math.floor(b.rand() * 12);
    const w = 2 + Math.floor(b.rand() * 3);
    b.rect(x, y, w, 1, '#3a72a8');
  }
};

// 8 LOG_SIDE
PAINTERS[TILE.LOG_SIDE] = (b) => {
  b.fill('#6b4d2f');
  for (let x = 0; x < LOGICAL; x++) {
    const c = ['#5e4227', '#755536', '#67492c', '#7d5c3b'][Math.floor(b.rand() * 4)];
    b.vLine(x, c);
  }
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(b.rand() * 14);
    const y = Math.floor(b.rand() * 13);
    b.rect(x, y, 1, 3, '#4c3520');
  }
  b.blobs(3, ['#4f3721', '#805e3c'], 1, 2);
};

// 9 LOG_TOP
PAINTERS[TILE.LOG_TOP] = (b) => {
  b.fill('#a9824e');
  for (let y = 0; y < LOGICAL; y++) {
    for (let x = 0; x < LOGICAL; x++) {
      const dx = x - 7.5;
      const dy = y - 7.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      let c;
      if (d > 7) c = '#5e4227';
      else c = Math.floor(d / 1.5) % 2 === 0 ? '#a9824e' : '#8f6a3c';
      b.dot(x, y, c);
    }
  }
  b.rect(7, 7, 2, 2, '#6b4d2f');
};

// 10 LEAVES
PAINTERS[TILE.LEAVES] = (b) => {
  b.fill('#3f7a2e');
  b.speckle(['#356b26', '#4a8a37', '#2f6322', '#559c41'], 0.8);
  b.blobs(10, ['#274f1c', '#61a94b', '#2b5a1f'], 1, 2);
};

// 11 PLANKS
PAINTERS[TILE.PLANKS] = (b) => {
  b.fill('#a8814f');
  b.speckle(['#a8814f', '#9f7a4a', '#b18a57', '#a37d4c'], 0.8);
  for (let y = 0; y < LOGICAL; y += 4) {
    b.hLine(y, '#7a5a34');
    b.hLine(y + 1, '#b99260');
  }
  for (let row = 0; row < 4; row++) {
    const seam = 2 + Math.floor(b.rand() * 12);
    b.vLine(seam, '#7a5a34', row * 4, row * 4 + 4);
    for (let i = 0; i < 2; i++) {
      const y = row * 4 + 1 + Math.floor(b.rand() * 2);
      b.rect(Math.floor(b.rand() * 12), y, 2 + Math.floor(b.rand() * 3), 1, '#8f6a3e');
    }
  }
};

// 12 BEDROCK
PAINTERS[TILE.BEDROCK] = (b) => {
  b.fill('#383838');
  b.speckle(['#2c2c2c', '#444444', '#333333', '#4d4d4d'], 0.8);
  b.blobs(10, ['#202020', '#555555', '#292929'], 1, 3);
};

// 13 SNOW
PAINTERS[TILE.SNOW] = (b) => {
  b.fill('#f3f8fc');
  b.speckle(['#eef4fa', '#ffffff', '#e9f0f7', '#f7fbff'], 0.5);
  b.blobs(5, ['#e2ebf4'], 1, 2);
};

// 14 SNOW_SIDE
PAINTERS[TILE.SNOW_SIDE] = (b) => {
  b.fill('#8a6140');
  b.speckle(['#7c5537', '#956a48', '#805b3c'], 0.7);
  for (let x = 0; x < LOGICAL; x++) {
    const depth = 4 + Math.floor(b.rand() * 2);
    for (let y = 0; y < depth; y++) {
      b.dot(x, y, ['#f3f8fc', '#e8eff7', '#f8fbff'][Math.floor(b.rand() * 3)]);
    }
  }
};

// 15 SANDSTONE
PAINTERS[TILE.SANDSTONE] = (b) => {
  b.fill('#ded0a0');
  b.speckle(['#d8c997', '#e6d9ac', '#d3c38f'], 0.6);
  b.hLine(0, '#c3b27c');
  b.hLine(15, '#c3b27c');
  b.hLine(5, '#cbbc88');
  b.hLine(10, '#cbbc88');
  b.rect(0, 6, 16, 1, '#e9ddb4');
  b.rect(0, 11, 16, 1, '#e9ddb4');
};

// 16 SANDSTONE_TOP
PAINTERS[TILE.SANDSTONE_TOP] = (b) => {
  b.fill('#e2d4a3');
  b.speckle(['#dccd96', '#eaddb2', '#d7c78e'], 0.7);
  b.blobs(6, ['#cdbb83', '#f0e4bd'], 1, 2);
};

// 17 BRICKS
PAINTERS[TILE.BRICKS] = (b) => {
  b.fill('#b3a596');
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const offset = row % 2 === 0 ? 0 : 4;
    for (let i = -1; i < 3; i++) {
      const x = offset + i * 8;
      const color = ['#9c4a3c', '#93433a', '#a85445', '#8c4034'][Math.floor(b.rand() * 4)];
      b.rect(x, y, 7, 3, color);
      b.rect(x, y, 7, 1, '#b25d4d');
      b.rect(x, y + 2, 7, 1, '#823a2f');
    }
  }
  b.speckle(['#ad9e8e', '#a08f80'], 0.12);
};

// 18 GLASS
PAINTERS[TILE.GLASS] = (b) => {
  b.rect(0, 0, 16, 16, 'rgba(190,225,250,0.10)');
  b.rect(0, 0, 16, 1, 'rgba(225,245,255,0.85)');
  b.rect(0, 15, 16, 1, 'rgba(225,245,255,0.85)');
  b.rect(0, 0, 1, 16, 'rgba(225,245,255,0.85)');
  b.rect(15, 0, 1, 16, 'rgba(225,245,255,0.85)');
  b.rect(1, 1, 14, 1, 'rgba(160,205,235,0.28)');
  b.rect(1, 1, 1, 14, 'rgba(160,205,235,0.28)');
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 4;
    b.rect(x, 14 - i * 3, 1, 2, 'rgba(255,255,255,0.35)');
  }
};

// 19 COAL_ORE
PAINTERS[TILE.COAL_ORE] = (b) => {
  b.fill('#7f7f7f');
  b.speckle(['#8b8b8b', '#747474', '#6c6c6c', '#858585'], 0.75);
  b.blobs(5, ['#232323', '#333333', '#1b1b1b'], 2, 3);
  b.blobs(3, ['#3d3d3d'], 1, 2);
};

// 20 IRON_ORE
PAINTERS[TILE.IRON_ORE] = (b) => {
  b.fill('#7f7f7f');
  b.speckle(['#8b8b8b', '#747474', '#6c6c6c', '#858585'], 0.75);
  b.blobs(5, ['#d9b28c', '#c39a72', '#edc9a3'], 2, 3);
  b.blobs(3, ['#a97f5b'], 1, 2);
};

// 21 GOLD_ORE
PAINTERS[TILE.GOLD_ORE] = (b) => {
  b.fill('#7f7f7f');
  b.speckle(['#8b8b8b', '#747474', '#6c6c6c', '#858585'], 0.75);
  b.blobs(5, ['#ffd84d', '#d9a81e', '#ffe98a'], 2, 3);
  b.blobs(3, ['#a87c12'], 1, 2);
};

// 22 DIAMOND_ORE
PAINTERS[TILE.DIAMOND_ORE] = (b) => {
  b.fill('#7f7f7f');
  b.speckle(['#8b8b8b', '#747474', '#6c6c6c', '#858585'], 0.75);
  b.blobs(5, ['#6fe8e0', '#2fbdb5', '#b7fff9'], 2, 3);
  b.blobs(3, ['#1d8d88'], 1, 2);
};

// 23 GLOWSTONE
PAINTERS[TILE.GLOWSTONE] = (b) => {
  b.fill('#c9a23f');
  b.speckle(['#d6b055', '#b8912f', '#e0bd66'], 0.7);
  b.blobs(12, ['#ffe9a0', '#ffd257', '#fff4c9'], 1, 2);
};

// 24 OBSIDIAN
PAINTERS[TILE.OBSIDIAN] = (b) => {
  b.fill('#181126');
  b.speckle(['#2a1f45', '#33265a', '#100b1a', '#3d2f66'], 0.8);
  b.blobs(6, ['#4a3a7a', '#0c0814'], 1, 2);
};

// 25 STONE_BRICKS
PAINTERS[TILE.STONE_BRICKS] = (b) => {
  b.fill('#5f5f5f');
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const offset = row % 2 === 0 ? 0 : 4;
    for (let i = -1; i < 3; i++) {
      const x = offset + i * 8;
      const c = ['#828282', '#787878', '#8b8b8b', '#7e7e7e'][Math.floor(b.rand() * 4)];
      b.rect(x, y + 1, 7, 2, c);
      b.rect(x, y + 1, 7, 1, '#969696');
      b.rect(x, y + 2, 7, 1, '#6e6e6e');
    }
  }
  b.speckle(['#6f6f6f', '#999999'], 0.2);
};

// 26 CACTUS_SIDE
PAINTERS[TILE.CACTUS_SIDE] = (b) => {
  b.fill('#3d7c33');
  for (let x = 0; x < LOGICAL; x++) {
    if (x % 5 === 0) b.vLine(x, '#2e6227');
    else if (x % 5 === 2) b.vLine(x, '#4b8f3c');
  }
  for (let i = 0; i < 10; i++) {
    const x = 1 + Math.floor(b.rand() * 14);
    const y = 1 + Math.floor(b.rand() * 14);
    b.dot(x, y, '#d7eeb6');
  }
  b.rect(0, 0, 16, 1, '#4f9440');
  b.rect(0, 15, 16, 1, '#295a22');
};

// 27 CACTUS_TOP
PAINTERS[TILE.CACTUS_TOP] = (b) => {
  b.fill('#3d7c33');
  b.rect(3, 3, 10, 10, '#4c8f3c');
  b.rect(5, 5, 6, 6, '#5aa34a');
  b.rect(7, 7, 2, 2, '#6ab659');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x = Math.round(7.5 + Math.cos(a) * 6);
    const y = Math.round(7.5 + Math.sin(a) * 6);
    b.dot(x, y, '#d7eeb6');
  }
};

// 28 BIRCH_LOG
PAINTERS[TILE.BIRCH_LOG] = (b) => {
  b.fill('#dcd8cd');
  b.speckle(['#d3cec2', '#e6e2d8', '#cdc7bb'], 0.6);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(b.rand() * 12);
    const y = Math.floor(b.rand() * 14);
    const w = 1 + Math.floor(b.rand() * 3);
    b.rect(x, y, w, 1, '#3b3730');
    if (b.rand() < 0.4) b.rect(x, y + 1, 1, 1, '#4c473e');
  }
};

// 29 BIRCH_LEAVES
PAINTERS[TILE.BIRCH_LEAVES] = (b) => {
  b.fill('#7aa84a');
  b.speckle(['#6f9c42', '#86b456', '#65913a', '#93c061'], 0.8);
  b.blobs(8, ['#577e31', '#a3ce70'], 1, 2);
};

// 30 SPRUCE_LOG
PAINTERS[TILE.SPRUCE_LOG] = (b) => {
  b.fill('#4a3524');
  for (let x = 0; x < LOGICAL; x++) {
    b.vLine(x, ['#42301f', '#543c29', '#3a2a1b', '#5c4330'][Math.floor(b.rand() * 4)]);
  }
  b.blobs(4, ['#2f2116', '#64492f'], 1, 2);
};

// 31 SPRUCE_LEAVES
PAINTERS[TILE.SPRUCE_LEAVES] = (b) => {
  b.fill('#2f5c2c');
  b.speckle(['#2a5227', '#376a33', '#24461f', '#3d7538'], 0.8);
  b.blobs(8, ['#1d3a19', '#477f42'], 1, 2);
};

// 32 ICE
PAINTERS[TILE.ICE] = (b) => {
  b.rect(0, 0, 16, 16, 'rgba(158,212,248,0.75)');
  b.speckle(['rgba(170,222,252,0.75)', 'rgba(146,201,240,0.75)', 'rgba(190,232,255,0.75)'], 0.5);
  b.rect(2, 2, 5, 1, 'rgba(230,247,255,0.65)');
  b.rect(9, 7, 5, 1, 'rgba(230,247,255,0.55)');
  b.rect(4, 11, 3, 1, 'rgba(230,247,255,0.5)');
  b.rect(10, 3, 1, 3, 'rgba(230,247,255,0.35)');
};

/* ------------------------------------------------------------------ */
/* Atlas assembly                                                      */
/* ------------------------------------------------------------------ */

let cached = null;

/**
 * Build (once) the texture atlas.
 * @returns {{canvas: HTMLCanvasElement, texture: THREE.CanvasTexture}}
 */
export function getAtlas() {
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_TILE * ATLAS_GRID;
  canvas.height = ATLAS_TILE * ATLAS_GRID;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < PAINTERS.length; i++) {
    const painter = PAINTERS[i];
    if (!painter) continue;
    const tx = i % ATLAS_GRID;
    const ty = Math.floor(i / ATLAS_GRID);
    const rand = mulberry32(0x9e3779b1 ^ (i * 2654435761));
    const brush = new Brush(ctx, tx * ATLAS_TILE, ty * ATLAS_TILE, rand);
    painter(brush);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  cached = { canvas, texture };
  return cached;
}

const INSET = 0.5; // half a texel, avoids atlas bleeding

/** UV rectangle for a tile index. */
export function tileUV(index) {
  const tx = index % ATLAS_GRID;
  const ty = Math.floor(index / ATLAS_GRID);
  const w = ATLAS_TILE * ATLAS_GRID;
  const h = w;
  const x0 = tx * ATLAS_TILE;
  const y0 = ty * ATLAS_TILE;
  return {
    u0: (x0 + INSET) / w,
    u1: (x0 + ATLAS_TILE - INSET) / w,
    vTop: 1 - (y0 + INSET) / h,
    vBottom: 1 - (y0 + ATLAS_TILE - INSET) / h,
  };
}

/**
 * Draw an isometric block icon (used by the hotbar and inventory).
 */
export function createBlockIcon(blockId, size = 64) {
  const atlas = getAtlas();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const u = size / 64;
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = true;

  const tiles = {
    top: faceTile(blockId, 2),
    left: faceTile(blockId, 1),
    right: faceTile(blockId, 4),
  };

  const drawFace = (tileIndex, origin, vecX, vecY, darken) => {
    const tx = (tileIndex % ATLAS_GRID) * ATLAS_TILE;
    const ty = Math.floor(tileIndex / ATLAS_GRID) * ATLAS_TILE;
    ctx.save();
    ctx.setTransform(vecX[0] / ATLAS_TILE, vecX[1] / ATLAS_TILE, vecY[0] / ATLAS_TILE, vecY[1] / ATLAS_TILE, origin[0], origin[1]);
    ctx.drawImage(atlas.canvas, tx, ty, ATLAS_TILE, ATLAS_TILE, 0, 0, ATLAS_TILE, ATLAS_TILE);
    ctx.restore();

    if (darken > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(origin[0] + vecX[0], origin[1] + vecX[1]);
      ctx.lineTo(origin[0] + vecX[0] + vecY[0], origin[1] + vecX[1] + vecY[1]);
      ctx.lineTo(origin[0] + vecY[0], origin[1] + vecY[1]);
      ctx.closePath();
      ctx.fillStyle = `rgba(0,0,0,${darken})`;
      ctx.fill();
      ctx.restore();
    }
  };

  // top rhombus
  drawFace(
    tiles.top,
    [2 * u, 17 * u],
    [30 * u, -15 * u],
    [30 * u, 15 * u],
    0,
  );
  // left face
  drawFace(
    tiles.left,
    [2 * u, 17 * u],
    [30 * u, 15 * u],
    [0, 30 * u],
    0.28,
  );
  // right face
  drawFace(
    tiles.right,
    [32 * u, 32 * u],
    [30 * u, -15 * u],
    [0, 30 * u],
    0.12,
  );

  return canvas;
}

/** Icon canvas for a block, cached by block id. */
const iconCache = new Map();
export function getBlockIcon(blockId, size = 64) {
  const key = `${blockId}:${size}`;
  let icon = iconCache.get(key);
  if (!icon) {
    icon = createBlockIcon(blockId, size);
    iconCache.set(key, icon);
  }
  return icon;
}

