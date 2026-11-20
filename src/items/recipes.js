// Crafting and smelting recipes. Recipes are shapeless ingredient lists, which
// keeps the crafting screen simple and readable: pick a recipe, the ingredients
// are taken from the inventory and the result appears.

import { B } from '../world/blocks.js';
import { I } from './ids.js';

const R = (out, count, ingredients, opts = {}) => ({
  out,
  count,
  in: ingredients,
  table: !!opts.table,
  tier: opts.tier || '',
});

const plankSets = [
  [B.OAK_LOG, B.PLANKS],
  [B.BIRCH_LOG, B.BIRCH_PLANKS],
  [B.SPRUCE_LOG, B.SPRUCE_PLANKS],
];

export const RECIPES = [
  ...plankSets.map(([log, planks]) => R(planks, 4, [[log, 1]])),
  R(I.STICK, 4, [[B.PLANKS, 2]]),
  R(B.CRAFTING_TABLE, 1, [[B.PLANKS, 4]]),
  R(B.CHEST, 1, [[B.PLANKS, 8]]),
  R(B.FURNACE, 1, [[B.COBBLE, 8]], { table: true }),
  R(B.TORCH, 4, [[I.COAL, 1], [I.STICK, 1]]),
  R(I.FLINT_AND_STEEL, 1, [[I.IRON_INGOT, 1], [I.FLINT, 1]]),
  R(B.QUARTZ, 1, [[I.NETHER_QUARTZ, 4]]),
  R(B.NETHER_BRICKS, 4, [[B.NETHERRACK, 4]], { table: true }),
  R(B.PURPUR, 4, [[B.END_STONE, 4]], { table: true }),
  R(B.LANTERN, 1, [[I.IRON_INGOT, 1], [B.TORCH, 1]], { table: true }),
  R(B.STONE_BRICKS, 4, [[B.STONE, 4]], { table: true }),
  R(B.MOSSY_STONE_BRICKS, 1, [[B.STONE_BRICKS, 1], [B.OAK_LEAVES, 1]]),
  R(B.BRICKS, 1, [[I.BRICK, 4]], { table: true }),
  R(B.SANDSTONE, 1, [[B.SAND, 4]]),
  R(B.RED_SANDSTONE, 1, [[B.RED_SAND, 4]]),
  R(B.GLASS, 1, [[B.SAND, 4], [I.COAL, 1]], { table: true }),
  R(B.BOOKSHELF, 1, [[B.PLANKS, 6], [I.LEATHER, 3]], { table: true }),
  R(B.IRON_BLOCK, 1, [[I.IRON_INGOT, 9]], { table: true }),
  R(B.GOLD_BLOCK, 1, [[I.GOLD_INGOT, 9]], { table: true }),
  R(B.DIAMOND_BLOCK, 1, [[I.DIAMOND, 9]], { table: true }),
  R(B.EMERALD_BLOCK, 1, [[I.EMERALD, 9]], { table: true }),
  R(B.LAPIS_BLOCK, 1, [[I.LAPIS, 9]], { table: true }),
  R(B.REDSTONE_BLOCK, 1, [[I.REDSTONE, 9]], { table: true }),
  R(B.COAL_BLOCK, 1, [[I.COAL, 9]], { table: true }),
  R(B.COPPER_BLOCK, 1, [[I.COPPER_INGOT, 9]], { table: true }),
  R(B.QUARTZ, 1, [[B.SMOOTH_STONE, 4]], { table: true }),
  R(B.POLISHED_GRANITE, 4, [[B.GRANITE, 4]], { table: true }),
  R(B.POLISHED_DIORITE, 4, [[B.DIORITE, 4]], { table: true }),
  R(B.POLISHED_ANDESITE, 4, [[B.ANDESITE, 4]], { table: true }),
  R(B.SMOOTH_STONE, 4, [[B.STONE, 4]], { table: true }),
  R(B.DEEPSLATE_BRICKS, 4, [[B.COBBLE_DEEPSLATE, 4]], { table: true }),
  R(B.HAY, 1, [[I.WHEAT, 9]], { table: true }),
  R(B.WOOL_WHITE, 1, [[I.LEATHER, 4]], { table: true }),
  R(B.WOOL_RED, 1, [[B.WOOL_WHITE, 1], [B.FLOWER_RED, 1]]),
  R(B.WOOL_YELLOW, 1, [[B.WOOL_WHITE, 1], [B.FLOWER_YELLOW, 1]]),
  R(B.WOOL_GREEN, 1, [[B.WOOL_WHITE, 1], [B.OAK_LEAVES, 1]]),
  R(B.WOOL_BLUE, 1, [[B.WOOL_WHITE, 1], [I.LAPIS, 1]]),
  R(B.WOOL_PURPLE, 1, [[B.WOOL_WHITE, 1], [B.AMETHYST, 1]], { table: true }),
  R(B.WOOL_BLACK, 1, [[B.WOOL_WHITE, 1], [I.COAL, 1]]),
  R(B.WOOL_ORANGE, 1, [[B.WOOL_RED, 1], [B.FLOWER_YELLOW, 1]]),
  R(I.BREAD, 1, [[I.WHEAT, 3]], { table: true }),
  R(I.GOLDEN_APPLE, 1, [[I.APPLE, 1], [I.GOLD_INGOT, 8]], { table: true }),
  R(I.MELON_SLICE, 3, [[B.MELON, 1]]),
  R(B.GLOWSTONE, 1, [[I.REDSTONE, 4], [I.EMERALD, 1], [I.GOLD_INGOT, 4]], { table: true }),
  R(B.AMETHYST, 1, [[I.DIAMOND, 2], [I.LAPIS, 4]], { table: true }),
  R(B.BONE_BLOCK, 1, [[I.BONE, 9]], { table: true }),
  R(B.OBSIDIAN, 1, [[B.COBBLE, 8], [I.REDSTONE, 4]], { table: true }),
];

const TOOL_RECIPES = [
  ['PICKAXE', I.WOODEN_PICKAXE, I.STICK],
  ['AXE', I.WOODEN_AXE, I.STICK],
  ['SHOVEL', I.WOODEN_SHOVEL, I.STICK],
  ['SWORD', I.WOODEN_SWORD, I.STICK],
];

const TOOL_MATERIALS = [
  [I.STICK, 0, 'Wooden'],
  [B.COBBLE, 0, 'Stone'],
  [I.IRON_INGOT, 0, 'Iron'],
  [I.GOLD_INGOT, 0, 'Golden'],
  [I.DIAMOND, 0, 'Diamond'],
];

for (let tierIndex = 0; tierIndex < 5; tierIndex++) {
  const [material, , label] = TOOL_MATERIALS[tierIndex];
  for (const [, baseId] of TOOL_RECIPES) {
    const id = baseId + tierIndex;
    const kind = TOOL_RECIPES.find(([, base]) => base === baseId)[0];
    const materialUses = kind === 'SWORD' ? 2 : 3;
    const stickUses = kind === 'SWORD' ? 1 : 2;
    const table = tierIndex >= 2;
    RECIPES.push(
      R(id, 1, [[material, materialUses], [I.STICK, stickUses]], { table, tier: label }),
    );
  }
}

export const RECIPE_BY_OUTPUT = new Map();
for (const recipe of RECIPES) {
  if (!RECIPE_BY_OUTPUT.has(recipe.out)) RECIPE_BY_OUTPUT.set(recipe.out, []);
  RECIPE_BY_OUTPUT.get(recipe.out).push(recipe);
}

/** Can this recipe be crafted from the inventory right now? */
export function canCraft(inventory, recipe) {
  return recipe.in.every(([id, count]) => inventory.count(id) >= count);
}

/** All recipes, with an `available` flag for this inventory and table access. */
export function recipeStates(inventory, hasTable) {
  return RECIPES.map((recipe) => ({
    recipe,
    available: (!recipe.table || hasTable) && canCraft(inventory, recipe),
    blocked: recipe.table && !hasTable,
  }));
}

/** Craft one item from a recipe. Returns the produced stack or null. */
export function craft(inventory, recipe) {
  for (const [id, count] of recipe.in) {
    if (inventory.count(id) < count) return null;
  }
  for (const [id, count] of recipe.in) inventory.remove(id, count);
  const leftover = inventory.add(recipe.out, recipe.count);
  return { id: recipe.out, count: recipe.count - leftover, leftover };
}

/* ------------------------------------------------------------------ */
/* Smelting and fuel                                                   */
/* ------------------------------------------------------------------ */

export const SMELTING = {
  [I.RAW_IRON]: I.IRON_INGOT,
  [I.RAW_GOLD]: I.GOLD_INGOT,
  [I.RAW_COPPER]: I.COPPER_INGOT,
  [B.COBBLE]: B.STONE,
  [B.SAND]: B.GLASS,
  [B.RED_SAND]: B.GLASS,
  [B.CLAY]: B.TERRACOTTA,
  [I.CLAY_BALL]: I.BRICK,
  [I.PORKCHOP]: I.COOKED_PORKCHOP,
  [I.BEEF]: I.COOKED_BEEF,
  [I.CHICKEN]: I.COOKED_CHICKEN,
  [I.MUTTON]: I.COOKED_MUTTON,
  [B.OAK_LOG]: I.CHARCOAL,
  [B.BIRCH_LOG]: I.CHARCOAL,
  [B.SPRUCE_LOG]: I.CHARCOAL,
};

const FUELS = {
  [I.COAL]: 80,
  [I.CHARCOAL]: 80,
  [B.COAL_BLOCK]: 800,
  [B.PLANKS]: 15,
  [B.BIRCH_PLANKS]: 15,
  [B.SPRUCE_PLANKS]: 15,
  [B.OAK_LOG]: 15,
  [B.BIRCH_LOG]: 15,
  [B.SPRUCE_LOG]: 15,
  [I.STICK]: 5,
  [B.CRAFTING_TABLE]: 15,
  [B.CHEST]: 15,
  [B.BOOKSHELF]: 15,
};

/** Seconds of burn time an item gives in a furnace (0 = not a fuel). */
export function fuelValue(id) {
  return FUELS[id] || 0;
}

export function smeltResult(id) {
  return SMELTING[id] || null;
}
