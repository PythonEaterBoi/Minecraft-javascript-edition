// Procedurally painted 16x16 pixel-art textures packed into a single atlas.
// Generating them in a canvas keeps the repository free of binary assets and
// lets the game run entirely offline from GitHub Pages.

import * as THREE from '../../vendor/three/three.module.js';
import { mulberry32 } from '../core/random.js';
import { TILE, faceTile } from './blocks.js';

export const ATLAS_TILE = 32; // on-screen pixels per tile
export const ATLAS_GRID = 16; // tiles per row/column
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
/* Expanded palette: stone variants, ores, metals, functional blocks,   */
/* wool, plants and decorations.                                        */
/* ------------------------------------------------------------------ */

const solidTile = (b, base, specks, extras) => {
  b.fill(base);
  b.speckle(specks, 0.55);
  if (extras) extras(b);
  b.blobs(4, specks, 1, 2);
};

const oreTile = (b, gems, shade) => {
  b.fill('#7f7f7f');
  b.speckle(['#858585', '#787878', '#7b7b7b', '#838383'], 0.5);
  b.blobs(5, ['#727272', '#8b8b8b'], 1, 2);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(b.rand() * 10);
    const y = 2 + Math.floor(b.rand() * 10);
    const w = 2 + Math.floor(b.rand() * 2);
    const h = 2 + Math.floor(b.rand() * 2);
    b.rect(x, y, w, h, gems[0]);
    b.dot(x, y, gems[1]);
    if (shade) b.dot(x + w - 1, y + h - 1, shade);
  }
};

const planksTile = (b, tint) => {
  b.fill(tint.base);
  for (let y = 0; y < LOGICAL; y += 4) {
    b.hLine(y, tint.line);
    b.hLine(y + 3, tint.dark);
    for (let i = 0; i < 3; i++) {
      b.rect(Math.floor(b.rand() * 12), y + 1, 2 + Math.floor(b.rand() * 3), 1, tint.grain);
    }
    const seam = Math.floor(b.rand() * 14) + 1;
    b.vLine(seam, tint.dark, y + 1, y + 3);
  }
};

const metalTile = (b, base, light, dark) => {
  b.fill(base);
  b.speckle([base, light, dark], 0.25);
  b.rect(1, 1, 14, 1, light);
  b.rect(1, 1, 1, 14, light);
  b.rect(14, 1, 1, 14, dark);
  b.rect(1, 14, 14, 1, dark);
  b.rect(3, 3, 4, 1, light);
  b.rect(9, 10, 4, 1, dark);
};

const woolTile = (b, base, light, dark) => {
  b.fill(base);
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(b.rand() * LOGICAL);
    const y = Math.floor(b.rand() * LOGICAL);
    b.dot(x, y, b.rand() < 0.5 ? light : dark);
  }
  b.hLine(3, light);
  b.hLine(11, dark);
};

// 33 COPPER_ORE
PAINTERS[TILE.COPPER_ORE] = (b) => oreTile(b, ['#d07a45', '#f0a06a'], '#8f4f2a');
// 34 REDSTONE_ORE
PAINTERS[TILE.REDSTONE_ORE] = (b) => oreTile(b, ['#c9271f', '#ff5a4a'], '#7a1512');
// 35 LAPIS_ORE
PAINTERS[TILE.LAPIS_ORE] = (b) => oreTile(b, ['#2f5bc4', '#6f92f0'], '#1d3a86');
// 36 EMERALD_ORE
PAINTERS[TILE.EMERALD_ORE] = (b) => oreTile(b, ['#3fbf5f', '#8ff0a8'], '#258a3f');
// 37 DEEPSLATE
PAINTERS[TILE.DEEPSLATE] = (b) => {
  b.fill('#4c4c52');
  b.speckle(['#52525a', '#454549', '#4a4a50', '#565660'], 0.6);
  for (let i = 0; i < 6; i++) b.rect(Math.floor(b.rand() * 13), Math.floor(b.rand() * 15), 3, 1, '#3c3c42');
  b.blobs(4, ['#3a3a40', '#5c5c64'], 1, 2);
};
// 38 COBBLE_DEEPSLATE
PAINTERS[TILE.COBBLE_DEEPSLATE] = (b) => {
  b.fill('#3a3a40');
  const shades = ['#4a4a52', '#54545c', '#42424a', '#5c5c66'];
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(b.rand() * 12);
    const y = Math.floor(b.rand() * 12);
    b.rect(x, y, 3 + Math.floor(b.rand() * 3), 3, shades[i % shades.length]);
    b.dot(x, y, '#66666f');
  }
};
// 39 DEEPSLATE_BRICKS
PAINTERS[TILE.DEEPSLATE_BRICKS] = (b) => {
  b.fill('#43434a');
  for (let y = 0; y < LOGICAL; y += 4) {
    b.hLine(y, '#33333a');
    const offset = (y / 4) % 2 === 0 ? 0 : 4;
    for (let x = offset; x < LOGICAL; x += 8) b.vLine(x, '#33333a', y, y + 4);
    for (let x = 0; x < LOGICAL; x += 2) b.dot(x, y + 1, '#4d4d55');
  }
};
// 40 GRANITE
PAINTERS[TILE.GRANITE] = (b) => solidTile(b, '#9a6a5c', ['#a1746a', '#8d5f52', '#a87a6c'], (bb) => {
  bb.blobs(5, ['#b98f80', '#7d5246'], 1, 2);
});
// 41 DIORITE
PAINTERS[TILE.DIORITE] = (b) => solidTile(b, '#c5c5c5', ['#cfcfcf', '#b8b8b8', '#c9c9c9'], (bb) => {
  for (let i = 0; i < 8; i++) bb.dot(Math.floor(bb.rand() * 16), Math.floor(bb.rand() * 16), '#8f8f8f');
});
// 42 ANDESITE
PAINTERS[TILE.ANDESITE] = (b) => solidTile(b, '#8f9296', ['#979a9e', '#84878b', '#9a9da1'], (bb) => {
  for (let i = 0; i < 4; i++) bb.hLine(Math.floor(bb.rand() * 15), '#77797d');
});
// 43 POLISHED_GRANITE
PAINTERS[TILE.POLISHED_GRANITE] = (b) => {
  b.fill('#9a6a5c');
  b.speckle(['#a1746a', '#94695b'], 0.3);
  b.rect(0, 0, 16, 1, '#b08272');
  b.rect(0, 15, 16, 1, '#7d5246');
  b.rect(0, 0, 1, 16, '#b08272');
};
// 44 POLISHED_DIORITE
PAINTERS[TILE.POLISHED_DIORITE] = (b) => {
  b.fill('#c5c5c5');
  b.speckle(['#cdcdcd', '#bdbdbd'], 0.3);
  b.rect(0, 0, 16, 1, '#dedede');
  b.rect(0, 15, 16, 1, '#a8a8a8');
};
// 45 POLISHED_ANDESITE
PAINTERS[TILE.POLISHED_ANDESITE] = (b) => {
  b.fill('#8f9296');
  b.speckle(['#96999d', '#888b8f'], 0.3);
  b.rect(0, 0, 16, 1, '#a3a6aa');
  b.rect(0, 15, 16, 1, '#74777b');
};
// 46 TERRACOTTA
PAINTERS[TILE.TERRACOTTA] = (b) => {
  b.fill('#a8543a');
  b.speckle(['#b05c40', '#9c4b33', '#a8543a'], 0.5);
  b.hLine(5, '#8f422c');
  b.hLine(11, '#bb6749');
  b.blobs(4, ['#8f422c', '#bb6749'], 1, 2);
};
// 47 MOSSY_COBBLE
PAINTERS[TILE.MOSSY_COBBLE] = (b) => {
  PAINTERS[TILE.COBBLE](b);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(b.rand() * LOGICAL);
    const y = Math.floor(b.rand() * LOGICAL);
    b.dot(x, y, b.rand() < 0.5 ? '#4f7a35' : '#6a9c47');
  }
};
// 48 CLAY
PAINTERS[TILE.CLAY] = (b) => {
  b.fill('#a4a9c0');
  b.speckle(['#adb2c8', '#9ba0b6', '#b4b9ce'], 0.45);
  b.blobs(3, ['#969bb2', '#b8bed3'], 1, 2);
};
// 49 BIRCH_PLANKS
PAINTERS[TILE.BIRCH_PLANKS] = (b) => planksTile(b, { base: '#d7c99a', line: '#c9b985', dark: '#b3a271', grain: '#e2d6ad' });
// 50 SPRUCE_PLANKS
PAINTERS[TILE.SPRUCE_PLANKS] = (b) => planksTile(b, { base: '#6b4f31', line: '#5c432a', dark: '#4a3521', grain: '#7d5e3c' });
// 51 BOOKSHELF
PAINTERS[TILE.BOOKSHELF] = (b) => {
  planksTile(b, { base: '#a8814f', line: '#96703f', dark: '#7d5c33', grain: '#b8915c' });
  b.rect(1, 2, 14, 5, '#5a3a20');
  b.rect(1, 9, 14, 5, '#5a3a20');
  const books = ['#b8433a', '#3a6fb8', '#3aa85c', '#c9a227', '#8a5cd0', '#c96a2f'];
  for (const y of [2, 9]) {
    let x = 2;
    while (x < 14) {
      const w = 1 + Math.floor(b.rand() * 2);
      b.rect(x, y, w, 4, books[Math.floor(b.rand() * books.length)]);
      x += w + 1;
    }
  }
};
// 52 CRAFTING_TOP
PAINTERS[TILE.CRAFTING_TOP] = (b) => {
  planksTile(b, { base: '#a8814f', line: '#96703f', dark: '#7d5c33', grain: '#b8915c' });
  b.rect(0, 0, 16, 1, '#6b4a2a');
  b.rect(0, 0, 1, 16, '#6b4a2a');
  b.rect(7, 2, 1, 12, '#6b4a2a');
  b.rect(2, 7, 12, 1, '#6b4a2a');
  b.rect(9, 9, 3, 3, '#8f6a3f');
};
// 53 CRAFTING_SIDE
PAINTERS[TILE.CRAFTING_SIDE] = (b) => {
  planksTile(b, { base: '#9c7748', line: '#8a6739', dark: '#74552e', grain: '#ab8552' });
  b.rect(2, 2, 4, 4, '#6b6b6b');
  b.rect(9, 2, 1, 4, '#6b4a2a');
  b.rect(10, 3, 3, 1, '#6b4a2a');
  b.rect(3, 10, 5, 1, '#b9b9b9');
};
// 54 FURNACE_SIDE
PAINTERS[TILE.FURNACE_SIDE] = (b) => {
  b.fill('#8a8a8a');
  b.speckle(['#929292', '#7f7f7f'], 0.35);
  for (let i = 0; i < 4; i++) b.rect(Math.floor(b.rand() * 12), Math.floor(b.rand() * 14), 3, 1, '#747474');
  b.rect(0, 0, 16, 1, '#9e9e9e');
  b.rect(0, 15, 16, 1, '#6b6b6b');
};
// 55 FURNACE_FRONT
PAINTERS[TILE.FURNACE_FRONT] = (b) => {
  PAINTERS[TILE.FURNACE_SIDE](b);
  b.rect(3, 6, 10, 7, '#2b2b2b');
  b.rect(4, 11, 8, 2, '#f28b20');
  b.rect(5, 9, 2, 2, '#e5561f');
  b.rect(9, 8, 2, 3, '#ffb648');
  b.rect(3, 5, 10, 1, '#a8a8a8');
};
// 56 FURNACE_TOP
PAINTERS[TILE.FURNACE_TOP] = (b) => {
  PAINTERS[TILE.FURNACE_SIDE](b);
  b.rect(5, 5, 6, 6, '#5a5a5a');
  b.rect(6, 6, 4, 4, '#3d3d3d');
};
// 57 CHEST_TOP
PAINTERS[TILE.CHEST_TOP] = (b) => {
  planksTile(b, { base: '#b08447', line: '#9c7440', dark: '#7f5c31', grain: '#c0955a' });
  b.rect(0, 0, 16, 1, '#6b4a2a');
  b.rect(0, 15, 16, 1, '#6b4a2a');
  b.rect(0, 0, 1, 16, '#6b4a2a');
  b.rect(15, 0, 1, 16, '#6b4a2a');
  b.rect(4, 7, 8, 2, '#6b4a2a');
};
// 58 CHEST_SIDE
PAINTERS[TILE.CHEST_SIDE] = (b) => {
  planksTile(b, { base: '#b08447', line: '#9c7440', dark: '#7f5c31', grain: '#c0955a' });
  b.rect(0, 5, 16, 1, '#6b4a2a');
  b.rect(0, 0, 16, 1, '#6b4a2a');
  b.rect(0, 15, 16, 1, '#6b4a2a');
};
// 59 CHEST_FRONT
PAINTERS[TILE.CHEST_FRONT] = (b) => {
  PAINTERS[TILE.CHEST_SIDE](b);
  b.rect(7, 5, 3, 3, '#c9a227');
  b.rect(8, 6, 1, 2, '#7a6314');
};
// 60 COAL_BLOCK
PAINTERS[TILE.COAL_BLOCK] = (b) => {
  b.fill('#232323');
  b.speckle(['#2b2b2b', '#1c1c1c', '#333333'], 0.7);
  b.blobs(6, ['#3a3a3a', '#151515'], 1, 3);
  for (let i = 0; i < 5; i++) b.dot(Math.floor(b.rand() * 16), Math.floor(b.rand() * 16), '#5a5a5a');
};
// 61 IRON_BLOCK
PAINTERS[TILE.IRON_BLOCK] = (b) => metalTile(b, '#d8d8d8', '#f2f2f2', '#a8a8a8');
// 62 GOLD_BLOCK
PAINTERS[TILE.GOLD_BLOCK] = (b) => metalTile(b, '#f2cf4a', '#fff3a8', '#c9a227');
// 63 DIAMOND_BLOCK
PAINTERS[TILE.DIAMOND_BLOCK] = (b) => {
  metalTile(b, '#57cfc8', '#a8fff8', '#2f9c96');
  b.rect(6, 6, 4, 4, '#b9fff8');
};
// 64 EMERALD_BLOCK
PAINTERS[TILE.EMERALD_BLOCK] = (b) => {
  metalTile(b, '#3fbf5f', '#8ff0a8', '#258a3f');
  b.rect(6, 6, 4, 4, '#a8ffc0');
};
// 65 LAPIS_BLOCK
PAINTERS[TILE.LAPIS_BLOCK] = (b) => {
  b.fill('#2f5bc4');
  b.speckle(['#3a68d6', '#2849a8', '#6f92f0'], 0.6);
  b.blobs(5, ['#8fa8ff', '#1d3a86'], 1, 2);
};
// 66 REDSTONE_BLOCK
PAINTERS[TILE.REDSTONE_BLOCK] = (b) => {
  b.fill('#a8231c');
  b.speckle(['#c9271f', '#8f1a14', '#e6392f'], 0.6);
  for (let i = 0; i < 6; i++) b.dot(Math.floor(b.rand() * 16), Math.floor(b.rand() * 16), '#ff7a4a');
};
// 67 COPPER_BLOCK
PAINTERS[TILE.COPPER_BLOCK] = (b) => {
  metalTile(b, '#d08b56', '#f0ab74', '#a5683a');
  b.rect(2, 12, 3, 1, '#6fa87a');
  b.rect(11, 3, 2, 1, '#6fa87a');
};
// 68-75 WOOL
PAINTERS[TILE.WOOL_WHITE] = (b) => woolTile(b, '#eeeeee', '#fbfbfb', '#d8d8d8');
PAINTERS[TILE.WOOL_RED] = (b) => woolTile(b, '#b8433a', '#d15b50', '#8f2f28');
PAINTERS[TILE.WOOL_ORANGE] = (b) => woolTile(b, '#dd7a2f', '#f0954a', '#b45f22');
PAINTERS[TILE.WOOL_YELLOW] = (b) => woolTile(b, '#d9c04a', '#f0d968', '#b09a2f');
PAINTERS[TILE.WOOL_GREEN] = (b) => woolTile(b, '#5c9c40', '#74b554', '#427a2c');
PAINTERS[TILE.WOOL_BLUE] = (b) => woolTile(b, '#3a6fb8', '#5188d1', '#2a5490');
PAINTERS[TILE.WOOL_PURPLE] = (b) => woolTile(b, '#8a5cd0', '#a075e0', '#6a42a8');
PAINTERS[TILE.WOOL_BLACK] = (b) => woolTile(b, '#2b2b2b', '#3a3a3a', '#1c1c1c');
// 76 FLOWER_RED
PAINTERS[TILE.FLOWER_RED] = (b) => {
  b.vLine(8, '#4f7a35', 8, 16);
  b.rect(6, 10, 2, 1, '#5f9941');
  b.rect(9, 12, 2, 1, '#5f9941');
  b.rect(6, 4, 4, 4, '#b8433a');
  b.rect(7, 3, 2, 6, '#b8433a');
  b.rect(7, 5, 2, 2, '#f2cf4a');
};
// 77 FLOWER_YELLOW
PAINTERS[TILE.FLOWER_YELLOW] = (b) => {
  b.vLine(8, '#4f7a35', 7, 16);
  b.rect(5, 11, 3, 1, '#5f9941');
  b.rect(9, 13, 2, 1, '#5f9941');
  b.rect(5, 3, 6, 5, '#e8c93a');
  b.rect(7, 2, 3, 7, '#e8c93a');
  b.rect(7, 5, 3, 2, '#c9a227');
};
// 78 TALL_GRASS
PAINTERS[TILE.TALL_GRASS] = (b) => {
  for (let i = 0; i < 9; i++) {
    const x = 1 + Math.floor(b.rand() * 14);
    const h = 4 + Math.floor(b.rand() * 9);
    const color = ['#5f9941', '#6da84a', '#4f7a35'][Math.floor(b.rand() * 3)];
    b.vLine(x, color, 16 - h, 16);
    if (b.rand() < 0.5) b.rect(x + 1, 16 - h + 1, 1, 2, color);
  }
};
// 79 DEAD_BUSH
PAINTERS[TILE.DEAD_BUSH] = (b) => {
  b.vLine(8, '#6b4a2a', 8, 16);
  b.rect(5, 10, 3, 1, '#6b4a2a');
  b.rect(9, 9, 3, 1, '#6b4a2a');
  b.rect(4, 6, 2, 1, '#7d5a35');
  b.rect(10, 5, 2, 1, '#7d5a35');
};
// 80 SAPLING
PAINTERS[TILE.SAPLING] = (b) => {
  b.vLine(8, '#6b4a2a', 9, 16);
  b.rect(5, 6, 6, 3, '#4f7a35');
  b.rect(6, 4, 4, 3, '#5f9941');
  b.rect(3, 8, 3, 2, '#4f7a35');
  b.rect(10, 8, 3, 2, '#4f7a35');
};
// 81 PUMPKIN_SIDE
PAINTERS[TILE.PUMPKIN_SIDE] = (b) => {
  b.fill('#d97b1f');
  for (let x = 0; x < LOGICAL; x += 3) b.vLine(x, '#c46a16', 0, 16);
  b.hLine(0, '#a85a12');
  b.hLine(15, '#a85a12');
  b.blobs(3, ['#e88a2a', '#c46a16'], 1, 2);
};
// 82 PUMPKIN_TOP
PAINTERS[TILE.PUMPKIN_TOP] = (b) => {
  b.fill('#c46a16');
  for (let i = 0; i < 5; i++) b.rect(2, 2 + i * 3, 12, 1, '#d97b1f');
  b.rect(7, 7, 2, 3, '#6b4a2a');
};
// 83 HAY_SIDE
PAINTERS[TILE.HAY_SIDE] = (b) => {
  b.fill('#d3b13c');
  for (let i = 0; i < 60; i++) {
    const x = Math.floor(b.rand() * LOGICAL);
    const y = Math.floor(b.rand() * LOGICAL);
    b.rect(x, y, 1, 2 + Math.floor(b.rand() * 3), b.rand() < 0.5 ? '#e3c95c' : '#b99a2f');
  }
  b.hLine(4, '#8f6a1f');
  b.hLine(12, '#8f6a1f');
};
// 84 HAY_TOP
PAINTERS[TILE.HAY_TOP] = (b) => {
  b.fill('#d3b13c');
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(b.rand() * LOGICAL);
    const y = Math.floor(b.rand() * LOGICAL);
    b.dot(x, y, b.rand() < 0.5 ? '#e3c95c' : '#b99a2f');
  }
  b.rect(6, 6, 4, 4, '#b99a2f');
};
// 85 MOSSY_STONE_BRICKS
PAINTERS[TILE.MOSSY_STONE_BRICKS] = (b) => {
  PAINTERS[TILE.STONE_BRICKS](b);
  for (let i = 0; i < 22; i++) {
    const x = Math.floor(b.rand() * LOGICAL);
    const y = Math.floor(b.rand() * LOGICAL);
    b.dot(x, y, b.rand() < 0.5 ? '#4f7a35' : '#6a9c47');
  }
};
// 86 CRACKED_STONE_BRICKS
PAINTERS[TILE.CRACKED_STONE_BRICKS] = (b) => {
  PAINTERS[TILE.STONE_BRICKS](b);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(b.rand() * 12);
    const y = Math.floor(b.rand() * 12);
    b.rect(x, y, 2, 1, '#5a5a5a');
    b.rect(x + 1, y + 1, 1, 2, '#5a5a5a');
  }
};
// 87 SMOOTH_STONE
PAINTERS[TILE.SMOOTH_STONE] = (b) => {
  b.fill('#9a9a9a');
  b.speckle(['#a2a2a2', '#939393'], 0.25);
  b.rect(0, 0, 16, 1, '#adadad');
  b.rect(0, 15, 16, 1, '#7f7f7f');
};
// 88 QUARTZ
PAINTERS[TILE.QUARTZ] = (b) => {
  b.fill('#e6e2da');
  b.speckle(['#efece6', '#dcd7cd'], 0.3);
  b.rect(0, 0, 16, 1, '#f5f3ee');
  b.rect(0, 15, 16, 1, '#cbc5b9');
};
// 89 PODZOL_TOP
PAINTERS[TILE.PODZOL_TOP] = (b) => {
  b.fill('#8a5a2a');
  b.speckle(['#96642f', '#7d5025', '#a5703a'], 0.6);
  b.blobs(5, ['#6a4420', '#b07a42'], 1, 3);
};
// 90 PODZOL_SIDE
PAINTERS[TILE.PODZOL_SIDE] = (b) => {
  b.fill('#8a6140');
  b.speckle(['#835a3b', '#956a48'], 0.6);
  for (let x = 0; x < LOGICAL; x++) {
    const depth = 4 + Math.floor(b.rand() * 3);
    for (let y = 0; y < depth; y++) b.dot(x, y, ['#8a5a2a', '#96642f', '#7d5025'][Math.floor(b.rand() * 3)]);
  }
};
// 91 COARSE_DIRT
PAINTERS[TILE.COARSE_DIRT] = (b) => {
  b.fill('#7d5637');
  b.speckle(['#8a6140', '#6a4629', '#916848'], 0.7);
  b.blobs(8, ['#5f4026', '#9c7355'], 1, 2);
};
// 92 RED_SAND
PAINTERS[TILE.RED_SAND] = (b) => {
  b.fill('#c47a3a');
  b.speckle(['#cd8442', '#b96f31', '#d18f52'], 0.5);
  b.blobs(5, ['#b0652a', '#d99a5c'], 1, 2);
};
// 93 RED_SANDSTONE
PAINTERS[TILE.RED_SANDSTONE] = (b) => {
  b.fill('#c47a3a');
  b.speckle(['#cb8142', '#bd7133'], 0.3);
  b.hLine(3, '#a85f28');
  b.hLine(9, '#d99a5c');
  b.hLine(13, '#a85f28');
};
// 94 MUSHROOM_RED
PAINTERS[TILE.MUSHROOM_RED] = (b) => {
  b.rect(7, 10, 2, 5, '#efe6d0');
  b.rect(4, 4, 8, 6, '#c9342f');
  b.rect(5, 3, 6, 2, '#c9342f');
  b.rect(6, 5, 2, 2, '#f2f2f2');
  b.rect(9, 7, 2, 2, '#f2f2f2');
};
// 95 MUSHROOM_BROWN
PAINTERS[TILE.MUSHROOM_BROWN] = (b) => {
  b.rect(7, 9, 2, 6, '#efe6d0');
  b.rect(4, 5, 8, 5, '#a8875c');
  b.rect(5, 4, 6, 2, '#b8966a');
  b.rect(6, 6, 2, 1, '#8f6f47');
};
// 96 AMETHYST
PAINTERS[TILE.AMETHYST] = (b) => {
  b.fill('#8a5cd0');
  b.speckle(['#9668d8', '#7a4ec0', '#a87ce8'], 0.5);
  for (let i = 0; i < 4; i++) {
    const x = 2 + Math.floor(b.rand() * 10);
    const y = 2 + Math.floor(b.rand() * 10);
    b.rect(x, y, 3, 2, '#c9a8f5');
    b.dot(x, y, '#f0e6ff');
  }
};
// 97 MELON_SIDE
PAINTERS[TILE.MELON_SIDE] = (b) => {
  b.fill('#5f9941');
  for (let x = 1; x < LOGICAL; x += 3) b.vLine(x, '#4f7a35', 0, 16);
  b.rect(0, 0, 16, 1, '#6da84a');
  b.rect(0, 15, 16, 1, '#4a6f30');
  b.hLine(8, '#7fbf4d');
};
// 98 MELON_TOP
PAINTERS[TILE.MELON_TOP] = (b) => {
  b.fill('#4f7a35');
  b.rect(3, 3, 10, 10, '#5f9941');
  b.rect(6, 6, 4, 4, '#4a6f30');
  b.rect(7, 7, 2, 2, '#7fbf4d');
};
// 99 LANTERN
PAINTERS[TILE.LANTERN] = (b) => {
  b.rect(5, 3, 6, 3, '#6b6b6b');
  b.rect(4, 6, 8, 7, '#8a8a8a');
  b.rect(5, 7, 6, 5, '#ffcf5a');
  b.rect(6, 8, 4, 3, '#fff0a0');
  b.rect(5, 13, 6, 2, '#6b6b6b');
  b.rect(7, 1, 2, 2, '#8a8a8a');
};
// 100 BONE_BLOCK
PAINTERS[TILE.BONE_BLOCK] = (b) => {
  b.fill('#e6dfc9');
  b.speckle(['#efe9d6', '#d8d0b8'], 0.5);
  b.hLine(4, '#c3bba2');
  b.hLine(11, '#c3bba2');
  b.rect(2, 6, 4, 2, '#f5f0e0');
  b.rect(9, 8, 4, 2, '#c3bba2');
};
// 101 NETHERITE_BLOCK
PAINTERS[TILE.NETHERITE_BLOCK] = (b) => metalTile(b, '#4a4038', '#6a5c50', '#2b241f');
// 102 TORCH
PAINTERS[TILE.TORCH] = (b) => {
  b.rect(7, 7, 2, 9, '#8a6538');
  b.rect(6, 4, 4, 4, '#ffcf5a');
  b.rect(7, 3, 2, 2, '#fff0a0');
  b.rect(6, 8, 4, 1, '#c96a2f');
};

// 103 NETHERRACK
PAINTERS[TILE.NETHERRACK] = (b) => {
  b.fill('#6e2a2a');
  b.speckle(['#7a3030', '#5e2222', '#843838', '#672727'], 0.7);
  b.blobs(8, ['#4f1a1a', '#934242'], 1, 2);
};
// 104 SOUL_SAND
PAINTERS[TILE.SOUL_SAND] = (b) => {
  b.fill('#4f3b2d');
  b.speckle(['#5a4434', '#443226', '#614a39'], 0.6);
  for (let i = 0; i < 3; i++) {
    const x = 2 + Math.floor(b.rand() * 10);
    const y = 2 + Math.floor(b.rand() * 9);
    b.rect(x, y, 1, 2, '#2c1f17');
    b.rect(x + 2, y, 1, 2, '#2c1f17');
    b.rect(x, y + 3, 3, 1, '#2c1f17');
  }
};
// 105 NETHER_QUARTZ_ORE
PAINTERS[TILE.NETHER_QUARTZ_ORE] = (b) => {
  PAINTERS[TILE.NETHERRACK](b);
  for (let i = 0; i < 6; i++) {
    const x = 1 + Math.floor(b.rand() * 12);
    const y = 1 + Math.floor(b.rand() * 12);
    b.rect(x, y, 3, 1, '#ebe3d6');
    b.dot(x + 1, y + 1, '#c9bfae');
    b.dot(x, y - 1 < 0 ? y : y - 1, '#fffaf0');
  }
};
// 106 MAGMA
PAINTERS[TILE.MAGMA] = (b) => {
  b.fill('#5a1f12');
  b.speckle(['#6b2614', '#4a180e'], 0.5);
  for (let i = 0; i < 9; i++) {
    const x = Math.floor(b.rand() * 14);
    const y = Math.floor(b.rand() * 14);
    b.rect(x, y, 2 + Math.floor(b.rand() * 2), 1, '#ff8a1e');
    b.dot(x, y + 1, '#ffc23d');
  }
};
// 107 NETHER_BRICKS
PAINTERS[TILE.NETHER_BRICKS] = (b) => {
  b.fill('#2c1418');
  for (let row = 0; row < 4; row++) {
    const y = row * 4;
    const offset = row % 2 === 0 ? 0 : 4;
    for (let i = -1; i < 3; i++) {
      const x = offset + i * 8;
      b.rect(Math.max(0, x), y, Math.min(7, 16 - Math.max(0, x)), 3, '#46202a');
      b.rect(Math.max(0, x), y, Math.min(7, 16 - Math.max(0, x)), 1, '#552a33');
    }
  }
};
// 108 END_STONE
PAINTERS[TILE.END_STONE] = (b) => {
  b.fill('#dbdca0');
  b.speckle(['#e3e4ab', '#cfd093', '#e8e9b6', '#d5d699'], 0.6);
  b.blobs(7, ['#c4c486', '#ececc0'], 1, 2);
};
// 109 PURPUR
PAINTERS[TILE.PURPUR] = (b) => {
  b.fill('#a77aa7');
  b.speckle(['#b086b0', '#9c6e9c', '#b58eb5'], 0.4);
  b.hLine(0, '#8a5f8a');
  b.hLine(8, '#8a5f8a');
  b.vLine(0, '#8a5f8a', 0, 8);
  b.vLine(8, '#8a5f8a', 8, 16);
  b.hLine(1, '#c7a2c7', 1, 16);
  b.hLine(9, '#c7a2c7', 1, 16);
};
// 110 NETHER_PORTAL (translucent swirl)
PAINTERS[TILE.NETHER_PORTAL] = (b) => {
  b.rect(0, 0, 16, 16, 'rgba(110,30,200,0.62)');
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(b.rand() * 15);
    const y = Math.floor(b.rand() * 16);
    b.rect(x, y, 2, 1, b.rand() < 0.5 ? 'rgba(190,110,255,0.8)' : 'rgba(70,10,150,0.75)');
  }
};
// 111 END_PORTAL (starry void)
PAINTERS[TILE.END_PORTAL] = (b) => {
  b.rect(0, 0, 16, 16, 'rgba(10,22,30,0.92)');
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(b.rand() * 16);
    const y = Math.floor(b.rand() * 16);
    b.dot(x, y, ['rgba(90,230,200,0.95)', 'rgba(160,120,255,0.9)', 'rgba(230,250,255,0.95)'][i % 3]);
  }
};
// 112 SHROOMLIGHT
PAINTERS[TILE.SHROOMLIGHT] = (b) => {
  b.fill('#f09a3e');
  b.speckle(['#f6ac52', '#e88a2e', '#ffc46e'], 0.6);
  b.blobs(6, ['#ffe0a0', '#d9742a'], 1, 2);
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

