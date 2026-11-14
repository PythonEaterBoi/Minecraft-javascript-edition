// Procedural 2D icons for items (tools, food, materials). Block icons come
// from the atlas; everything else is painted here so the game still ships
// without a single binary asset.

import { getBlockIcon } from '../world/atlas.js';
import { isBlockItem } from '../world/blocks.js';
import { ITEMS, KIND, TOOL_MATERIALS } from './items.js';
import { I } from './ids.js';

const cache = new Map();

const METAL = {
  wood: ['#7a5a35', '#b08a55', '#8f6a3f'],
  stone: ['#6f6f6f', '#a9a9a9', '#868686'],
  iron: ['#b9b9b9', '#f0f0f0', '#d2d2d2'],
  gold: ['#c9a227', '#ffe066', '#f2cf4a'],
  diamond: ['#2f9c96', '#8df5ec', '#5fd8d0'],
};

function px(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function shape(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function gem(ctx, cx, cy, color, light, dark) {
  shape(ctx, [[cx, cy - 5], [cx + 5, cy - 1], [cx + 3, cy + 5], [cx - 3, cy + 5], [cx - 5, cy - 1]], color);
  shape(ctx, [[cx, cy - 5], [cx + 5, cy - 1], [cx + 1, cy + 0], [cx - 3, cy - 2]], light);
  shape(ctx, [[cx - 3, cy + 5], [cx + 3, cy + 5], [cx + 1, cy + 2], [cx - 1, cy + 2]], dark || color);
}

function nugget(ctx, color, light, dark) {
  shape(ctx, [[5, 9], [8, 4], [12, 5], [14, 9], [11, 13], [6, 12]], color);
  shape(ctx, [[8, 5], [12, 6], [10, 9], [7, 8]], light);
  px(ctx, 6, 11, 3, 2, dark);
}

function ingot(ctx, color, light, dark) {
  shape(ctx, [[4, 10], [7, 5], [13, 5], [15, 9], [11, 12], [5, 12]], color);
  px(ctx, 7, 6, 6, 2, light);
  px(ctx, 5, 10, 8, 2, dark);
}

function handle(ctx) {
  // A worn wooden handle running from the bottom-left to the middle.
  for (let i = 0; i < 9; i++) {
    px(ctx, 3 + i, 14 - i, 2, 2, i % 3 === 0 ? '#8a6538' : '#a67c48');
  }
}

function toolHead(ctx, type, colors) {
  const [base, light, dark] = colors;
  if (type === 'pickaxe') {
    px(ctx, 8, 2, 6, 2, base);
    px(ctx, 11, 4, 4, 2, base);
    px(ctx, 6, 3, 3, 2, dark);
    px(ctx, 9, 2, 4, 1, light);
  } else if (type === 'axe') {
    shape(ctx, [[9, 2], [14, 4], [14, 9], [10, 8], [8, 5]], base);
    shape(ctx, [[10, 3], [13, 4], [13, 6], [10, 5]], light);
    px(ctx, 8, 6, 2, 3, dark);
  } else if (type === 'shovel') {
    shape(ctx, [[9, 2], [14, 3], [13, 9], [10, 8]], base);
    px(ctx, 10, 3, 3, 1, light);
    px(ctx, 9, 7, 3, 2, dark);
  } else if (type === 'sword') {
    shape(ctx, [[10, 2], [14, 4], [8, 11], [6, 10]], base);
    px(ctx, 10, 3, 3, 1, light);
    px(ctx, 5, 10, 6, 2, '#6b4a2a');
    px(ctx, 4, 12, 3, 2, '#8a6538');
  }
}

function drawFood(ctx, id) {
  switch (id) {
    case I.APPLE:
    case I.GOLDEN_APPLE: {
      const golden = id === I.GOLDEN_APPLE;
      const body = golden ? '#f6cf3d' : '#c9342f';
      const light = golden ? '#fff0a0' : '#e8564f';
      px(ctx, 7, 2, 1, 3, '#5d4322');
      shape(ctx, [[5, 5], [11, 5], [13, 9], [10, 14], [6, 14], [3, 9]], body);
      px(ctx, 5, 6, 3, 4, light);
      px(ctx, 8, 12, 3, 2, golden ? '#c9a227' : '#8f2320');
      if (golden) px(ctx, 8, 3, 3, 1, '#5f9941');
      break;
    }
    case I.BREAD: {
      shape(ctx, [[3, 9], [5, 5], [11, 5], [13, 9], [11, 12], [5, 12]], '#b98544');
      px(ctx, 5, 6, 7, 2, '#d9a860');
      px(ctx, 6, 8, 1, 3, '#8f6229');
      px(ctx, 9, 8, 1, 3, '#8f6229');
      break;
    }
    case I.WHEAT: {
      for (const dx of [2, 6, 10]) {
        px(ctx, dx + 1, 4, 1, 10, '#b99a3f');
        px(ctx, dx, 3, 3, 2, '#e3c95c');
        px(ctx, dx, 6, 3, 2, '#d4b64d');
        px(ctx, dx, 9, 3, 2, '#d4b64d');
      }
      break;
    }
    case I.MELON_SLICE: {
      shape(ctx, [[2, 13], [4, 5], [12, 5], [14, 13]], '#e5564f');
      px(ctx, 4, 11, 8, 2, '#7fbf4d');
      px(ctx, 6, 7, 1, 2, '#2b2b2b');
      px(ctx, 9, 8, 1, 2, '#2b2b2b');
      px(ctx, 10, 6, 1, 2, '#2b2b2b');
      break;
    }
    case I.PORKCHOP:
    case I.COOKED_PORKCHOP:
    case I.BEEF:
    case I.COOKED_BEEF:
    case I.MUTTON:
    case I.COOKED_MUTTON: {
      const cooked = id === I.COOKED_PORKCHOP || id === I.COOKED_BEEF || id === I.COOKED_MUTTON;
      const pink = id === I.BEEF || id === I.COOKED_BEEF;
      const body = cooked ? '#8c4a25' : pink ? '#c9504a' : '#e58d8d';
      const light = cooked ? '#b06a35' : pink ? '#e0706a' : '#f2b0b0';
      shape(ctx, [[3, 10], [6, 5], [11, 4], [13, 8], [10, 13], [6, 13]], body);
      px(ctx, 5, 6, 4, 3, light);
      px(ctx, 9, 10, 3, 2, '#efe6d0');
      px(ctx, 4, 11, 2, 2, '#efe6d0');
      break;
    }
    case I.CHICKEN:
    case I.COOKED_CHICKEN: {
      const cooked = id === I.COOKED_CHICKEN;
      px(ctx, 3, 3, 2, 2, '#efe6d0');
      shape(ctx, [[4, 4], [9, 6], [12, 10], [9, 13], [6, 10]], cooked ? '#a9652c' : '#e8b0a8');
      px(ctx, 9, 9, 3, 3, cooked ? '#c98a45' : '#f0c9c2');
      break;
    }
    case I.ROTTEN_FLESH: {
      shape(ctx, [[3, 8], [6, 5], [11, 6], [13, 10], [9, 13], [5, 12]], '#6f7a3a');
      px(ctx, 6, 7, 3, 2, '#8f9c4a');
      px(ctx, 8, 10, 2, 2, '#4c5426');
      break;
    }
    default:
      px(ctx, 4, 4, 8, 8, '#c9a227');
  }
}

function drawMaterial(ctx, id) {
  switch (id) {
    case I.COAL:
    case I.CHARCOAL:
      nugget(ctx, id === I.COAL ? '#2b2b2b' : '#3c3228', '#4a4a4a', '#141414');
      break;
    case I.RAW_IRON:
    case I.RAW_GOLD:
    case I.RAW_COPPER:
      nugget(
        ctx,
        id === I.RAW_IRON ? '#b08a76' : id === I.RAW_GOLD ? '#c9a227' : '#c07f52',
        id === I.RAW_IRON ? '#d8b09a' : '#ffe066',
        '#6b5a4a',
      );
      break;
    case I.IRON_INGOT:
      ingot(ctx, '#d8d8d8', '#ffffff', '#9a9a9a');
      break;
    case I.GOLD_INGOT:
      ingot(ctx, '#f2cf4a', '#fff3a8', '#c9a227');
      break;
    case I.COPPER_INGOT:
      ingot(ctx, '#d08b56', '#f0ab74', '#a5683a');
      break;
    case I.DIAMOND:
      gem(ctx, 8, 8, '#4fd6d0', '#a8fff8', '#2a9c96');
      break;
    case I.EMERALD:
      gem(ctx, 8, 8, '#3fbf5f', '#a8ffc0', '#258a3f');
      break;
    case I.LAPIS:
      gem(ctx, 6, 7, '#2f5bc4', '#7a9bff', '#1d3a86');
      gem(ctx, 11, 10, '#2f5bc4', '#7a9bff', '#1d3a86');
      break;
    case I.REDSTONE:
      px(ctx, 3, 9, 2, 2, '#c9271f');
      px(ctx, 6, 6, 2, 2, '#e6392f');
      px(ctx, 9, 8, 2, 2, '#c9271f');
      px(ctx, 11, 5, 2, 2, '#e6392f');
      px(ctx, 7, 11, 2, 2, '#e6392f');
      break;
    case I.CLAY_BALL:
      shape(ctx, [[5, 5], [11, 5], [13, 9], [10, 13], [5, 12], [3, 8]], '#a3a9c4');
      px(ctx, 6, 6, 3, 2, '#c3c8de');
      break;
    case I.BRICK:
      px(ctx, 3, 6, 10, 5, '#a8503a');
      px(ctx, 3, 8, 10, 1, '#e0cfc0');
      px(ctx, 7, 6, 1, 2, '#e0cfc0');
      break;
    case I.FLINT:
      shape(ctx, [[5, 4], [11, 5], [13, 10], [8, 13], [4, 9]], '#3b3b44');
      px(ctx, 6, 6, 3, 2, '#5a5a66');
      break;
    case I.STICK:
      for (let i = 0; i < 9; i++) px(ctx, 4 + i, 13 - i, 2, 2, i % 3 === 0 ? '#6b4a2a' : '#8a6538');
      break;
    case I.LEATHER:
      shape(ctx, [[3, 6], [12, 4], [14, 10], [8, 13], [4, 11]], '#9a6234');
      px(ctx, 5, 7, 4, 2, '#b57a45');
      px(ctx, 9, 9, 3, 2, '#7a4a26');
      break;
    case I.FEATHER:
      for (let i = 0; i < 9; i++) px(ctx, 4 + i, 14 - i, 1, 1, '#c9c9c9');
      shape(ctx, [[7, 3], [12, 4], [11, 10], [8, 9]], '#f2f2f2');
      px(ctx, 8, 5, 2, 2, '#d9d9d9');
      break;
    case I.BONE:
      px(ctx, 4, 8, 8, 3, '#efe6d0');
      px(ctx, 3, 6, 3, 3, '#f7f0dd');
      px(ctx, 3, 10, 3, 3, '#f7f0dd');
      px(ctx, 11, 6, 3, 3, '#f7f0dd');
      px(ctx, 11, 10, 3, 3, '#f7f0dd');
      break;
    default:
      px(ctx, 4, 4, 8, 8, '#8f8f8f');
  }
}

function paint(ctx, def, size) {
  const s = size / 16;
  ctx.save();
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = false;
  if (def.kind === KIND.TOOL) {
    const colors = METAL[def.tierName] || METAL.iron;
    handle(ctx);
    toolHead(ctx, def.tool, colors);
  } else if (def.kind === KIND.FOOD) {
    drawFood(ctx, def.id);
  } else {
    drawMaterial(ctx, def.id);
  }
  ctx.restore();
  void size;
}

/** Icon canvas for any inventory id, cached. */
export function getItemIcon(id, size = 64) {
  if (!id) return null;
  const key = `${id}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let canvas;
  if (isBlockItem(id)) {
    canvas = getBlockIcon(id, size);
  } else {
    const def = ITEMS[id];
    if (!def) return null;
    canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    paint(canvas.getContext('2d'), def, size);
  }
  cache.set(key, canvas);
  return canvas;
}

export function getToolColors(tierName) {
  return TOOL_MATERIALS[tierName] || TOOL_MATERIALS.iron;
}
