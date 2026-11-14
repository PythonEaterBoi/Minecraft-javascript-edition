// Item registry: everything that is not a plain block — materials, tools and
// food. Block items are looked up through the block registry, so `itemDef()`
// is the single entry point for anything that can sit in an inventory slot.

import { BLOCKS, isBlockItem } from '../world/blocks.js';
import { I, MAX_STACK } from './ids.js';

export const KIND = { BLOCK: 'block', MATERIAL: 'material', TOOL: 'tool', FOOD: 'food' };

const TOOL_STATS = {
  wood: { tier: 1, speed: 2, durability: 59, damage: 3, color: '#9c7a4d', head: '#b08a55' },
  stone: { tier: 2, speed: 4, durability: 131, damage: 4, color: '#8a8a8a', head: '#9d9d9d' },
  iron: { tier: 3, speed: 6, durability: 250, damage: 5, color: '#d8d8d8', head: '#e8e8e8' },
  gold: { tier: 1, speed: 12, durability: 32, damage: 4, color: '#f2cf4a', head: '#f7dc6a' },
  diamond: { tier: 4, speed: 8, durability: 1561, damage: 6, color: '#4fd6d0', head: '#7ef0e8' },
};

export const ITEMS = {};
const list = [];

function item(def) {
  const full = {
    stack: MAX_STACK,
    kind: KIND.MATERIAL,
    ...def,
  };
  ITEMS[full.id] = full;
  list.push(full);
  return full;
}

function material(id, name, extra = {}) {
  return item({ id, name, kind: KIND.MATERIAL, ...extra });
}

material(I.COAL, 'Coal');
material(I.CHARCOAL, 'Charcoal');
material(I.RAW_IRON, 'Raw Iron');
material(I.IRON_INGOT, 'Iron Ingot');
material(I.RAW_GOLD, 'Raw Gold');
material(I.GOLD_INGOT, 'Gold Ingot');
material(I.RAW_COPPER, 'Raw Copper');
material(I.COPPER_INGOT, 'Copper Ingot');
material(I.DIAMOND, 'Diamond');
material(I.EMERALD, 'Emerald');
material(I.LAPIS, 'Lapis Lazuli');
material(I.REDSTONE, 'Redstone');
material(I.CLAY_BALL, 'Clay Ball');
material(I.BRICK, 'Brick');
material(I.FLINT, 'Flint');
material(I.STICK, 'Stick');
material(I.WHEAT, 'Wheat');
material(I.LEATHER, 'Leather');
material(I.FEATHER, 'Feather');
material(I.BONE, 'Bone');

const FOODS = [
  [I.APPLE, 'Apple', 4, 2.4],
  [I.BREAD, 'Bread', 5, 6],
  [I.MELON_SLICE, 'Melon Slice', 2, 1.2],
  [I.PORKCHOP, 'Raw Porkchop', 3, 1.8],
  [I.COOKED_PORKCHOP, 'Cooked Porkchop', 8, 12.8],
  [I.BEEF, 'Raw Beef', 3, 1.8],
  [I.COOKED_BEEF, 'Steak', 8, 12.8],
  [I.CHICKEN, 'Raw Chicken', 2, 1.2],
  [I.COOKED_CHICKEN, 'Cooked Chicken', 6, 7.2],
  [I.MUTTON, 'Raw Mutton', 2, 1.2],
  [I.COOKED_MUTTON, 'Cooked Mutton', 6, 9.6],
  [I.ROTTEN_FLESH, 'Rotten Flesh', 2, 0.4],
];
for (const [id, name, hunger, saturation] of FOODS) {
  item({ id, name, kind: KIND.FOOD, food: { hunger, saturation }, stack: 64 });
}
item({
  id: I.GOLDEN_APPLE,
  name: 'Golden Apple',
  kind: KIND.FOOD,
  food: { hunger: 10, saturation: 9.6, heal: 8 },
  stack: 16,
});

function tool(id, name, type, tierName) {
  const stats = TOOL_STATS[tierName];
  return item({
    id,
    name,
    kind: KIND.TOOL,
    stack: 1,
    tool: type,
    tier: stats.tier,
    speed: type === 'sword' ? 1.5 : stats.speed,
    durability: stats.durability,
    damage: type === 'sword' ? stats.damage + 3 : stats.damage,
    tierName,
  });
}

for (const [index, tierName] of ['wood', 'stone', 'iron', 'gold', 'diamond'].entries()) {
  const T = (name) => (tierName === 'wood' ? 'Wooden' : tierName.charAt(0).toUpperCase() + tierName.slice(1)) + ' ' + name;
  tool(I.WOODEN_PICKAXE + index, T('Pickaxe'), 'pickaxe', tierName);
}
for (const [index, tierName] of ['wood', 'stone', 'iron', 'gold', 'diamond'].entries()) {
  const T = (name) => (tierName === 'wood' ? 'Wooden' : tierName.charAt(0).toUpperCase() + tierName.slice(1)) + ' ' + name;
  tool(I.WOODEN_AXE + index, T('Axe'), 'axe', tierName);
}
for (const [index, tierName] of ['wood', 'stone', 'iron', 'gold', 'diamond'].entries()) {
  const T = (name) => (tierName === 'wood' ? 'Wooden' : tierName.charAt(0).toUpperCase() + tierName.slice(1)) + ' ' + name;
  tool(I.WOODEN_SHOVEL + index, T('Shovel'), 'shovel', tierName);
}
for (const [index, tierName] of ['wood', 'stone', 'iron', 'gold', 'diamond'].entries()) {
  const T = (name) => (tierName === 'wood' ? 'Wooden' : tierName.charAt(0).toUpperCase() + tierName.slice(1)) + ' ' + name;
  tool(I.WOODEN_SWORD + index, T('Sword'), 'sword', tierName);
}

/** Every registered non-block item. */
export const ITEM_LIST = list;

/** Definition for any inventory id (block or item), or null. */
export function itemDef(id) {
  if (!id) return null;
  if (isBlockItem(id)) {
    const block = BLOCKS[id];
    if (!block || !block.pickable) return null;
    return { id, name: block.name, kind: KIND.BLOCK, stack: 64, block };
  }
  return ITEMS[id] || null;
}

export function itemName(id) {
  const def = itemDef(id);
  return def ? def.name : 'Unknown';
}

export function itemStackSize(id) {
  const def = itemDef(id);
  return def ? def.stack : 64;
}

export const TOOL_MATERIALS = TOOL_STATS;

export { I };
