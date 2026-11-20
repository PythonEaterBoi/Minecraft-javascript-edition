import { I } from '../items/ids.js';

// Block registry. Block ids are stored as bytes inside chunks, so keep the
// list under 256 entries. Textures are indices into the generated atlas.
//
// Every block also carries the survival data the game needs: how hard it is to
// mine, which tool speeds it up, which tool tier it requires for drops, what it
// drops and whether it opens a container.

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  GRAVEL: 6,
  WATER: 7,
  LOG_SIDE: 8,
  LOG_TOP: 9,
  LEAVES: 10,
  PLANKS: 11,
  BEDROCK: 12,
  SNOW: 13,
  SNOW_SIDE: 14,
  SANDSTONE: 15,
  SANDSTONE_TOP: 16,
  BRICKS: 17,
  GLASS: 18,
  COAL_ORE: 19,
  IRON_ORE: 20,
  GOLD_ORE: 21,
  DIAMOND_ORE: 22,
  GLOWSTONE: 23,
  OBSIDIAN: 24,
  STONE_BRICKS: 25,
  CACTUS_SIDE: 26,
  CACTUS_TOP: 27,
  BIRCH_LOG: 28,
  BIRCH_LEAVES: 29,
  SPRUCE_LOG: 30,
  SPRUCE_LEAVES: 31,
  ICE: 32,
  COPPER_ORE: 33,
  REDSTONE_ORE: 34,
  LAPIS_ORE: 35,
  EMERALD_ORE: 36,
  DEEPSLATE: 37,
  COBBLE_DEEPSLATE: 38,
  DEEPSLATE_BRICKS: 39,
  GRANITE: 40,
  DIORITE: 41,
  ANDESITE: 42,
  POLISHED_GRANITE: 43,
  POLISHED_DIORITE: 44,
  POLISHED_ANDESITE: 45,
  TERRACOTTA: 46,
  MOSSY_COBBLE: 47,
  CLAY: 48,
  BIRCH_PLANKS: 49,
  SPRUCE_PLANKS: 50,
  BOOKSHELF: 51,
  CRAFTING_TOP: 52,
  CRAFTING_SIDE: 53,
  FURNACE_SIDE: 54,
  FURNACE_FRONT: 55,
  FURNACE_TOP: 56,
  CHEST_TOP: 57,
  CHEST_SIDE: 58,
  CHEST_FRONT: 59,
  COAL_BLOCK: 60,
  IRON_BLOCK: 61,
  GOLD_BLOCK: 62,
  DIAMOND_BLOCK: 63,
  EMERALD_BLOCK: 64,
  LAPIS_BLOCK: 65,
  REDSTONE_BLOCK: 66,
  COPPER_BLOCK: 67,
  WOOL_WHITE: 68,
  WOOL_RED: 69,
  WOOL_ORANGE: 70,
  WOOL_YELLOW: 71,
  WOOL_GREEN: 72,
  WOOL_BLUE: 73,
  WOOL_PURPLE: 74,
  WOOL_BLACK: 75,
  FLOWER_RED: 76,
  FLOWER_YELLOW: 77,
  TALL_GRASS: 78,
  DEAD_BUSH: 79,
  SAPLING: 80,
  PUMPKIN_SIDE: 81,
  PUMPKIN_TOP: 82,
  HAY_SIDE: 83,
  HAY_TOP: 84,
  MOSSY_STONE_BRICKS: 85,
  CRACKED_STONE_BRICKS: 86,
  SMOOTH_STONE: 87,
  QUARTZ: 88,
  PODZOL_TOP: 89,
  PODZOL_SIDE: 90,
  COARSE_DIRT: 91,
  RED_SAND: 92,
  RED_SANDSTONE: 93,
  MUSHROOM_RED: 94,
  MUSHROOM_BROWN: 95,
  AMETHYST: 96,
  MELON_SIDE: 97,
  MELON_TOP: 98,
  LANTERN: 99,
  BONE_BLOCK: 100,
  NETHERITE_BLOCK: 101,
  TORCH: 102,
  NETHERRACK: 103,
  SOUL_SAND: 104,
  NETHER_QUARTZ_ORE: 105,
  MAGMA: 106,
  NETHER_BRICKS: 107,
  END_STONE: 108,
  PURPUR: 109,
  NETHER_PORTAL: 110,
  END_PORTAL: 111,
  SHROOMLIGHT: 112,
};

// Face order: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
const FACE_PLUS_Z = 4;

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  COBBLE: 4,
  SAND: 5,
  GRAVEL: 6,
  WATER: 7,
  OAK_LOG: 8,
  OAK_LEAVES: 9,
  PLANKS: 10,
  BEDROCK: 11,
  SNOW: 12,
  SNOW_GRASS: 13,
  SANDSTONE: 14,
  BRICKS: 15,
  GLASS: 16,
  COAL_ORE: 17,
  IRON_ORE: 18,
  GOLD_ORE: 19,
  DIAMOND_ORE: 20,
  GLOWSTONE: 21,
  OBSIDIAN: 22,
  STONE_BRICKS: 23,
  CACTUS: 24,
  BIRCH_LOG: 25,
  BIRCH_LEAVES: 26,
  SPRUCE_LOG: 27,
  SPRUCE_LEAVES: 28,
  ICE: 29,
  COPPER_ORE: 30,
  REDSTONE_ORE: 31,
  LAPIS_ORE: 32,
  EMERALD_ORE: 33,
  DEEPSLATE: 34,
  COBBLE_DEEPSLATE: 35,
  DEEPSLATE_BRICKS: 36,
  GRANITE: 37,
  DIORITE: 38,
  ANDESITE: 39,
  POLISHED_GRANITE: 40,
  POLISHED_DIORITE: 41,
  POLISHED_ANDESITE: 42,
  TERRACOTTA: 43,
  MOSSY_COBBLE: 44,
  CLAY: 45,
  BIRCH_PLANKS: 46,
  SPRUCE_PLANKS: 47,
  BOOKSHELF: 48,
  CRAFTING_TABLE: 49,
  FURNACE: 50,
  CHEST: 51,
  COAL_BLOCK: 52,
  IRON_BLOCK: 53,
  GOLD_BLOCK: 54,
  DIAMOND_BLOCK: 55,
  EMERALD_BLOCK: 56,
  LAPIS_BLOCK: 57,
  REDSTONE_BLOCK: 58,
  COPPER_BLOCK: 59,
  WOOL_WHITE: 60,
  WOOL_RED: 61,
  WOOL_ORANGE: 62,
  WOOL_YELLOW: 63,
  WOOL_GREEN: 64,
  WOOL_BLUE: 65,
  WOOL_PURPLE: 66,
  WOOL_BLACK: 67,
  FLOWER_RED: 68,
  FLOWER_YELLOW: 69,
  TALL_GRASS: 70,
  DEAD_BUSH: 71,
  SAPLING: 72,
  PUMPKIN: 73,
  HAY: 74,
  MOSSY_STONE_BRICKS: 75,
  CRACKED_STONE_BRICKS: 76,
  SMOOTH_STONE: 77,
  QUARTZ: 78,
  PODZOL: 79,
  COARSE_DIRT: 80,
  RED_SAND: 81,
  RED_SANDSTONE: 82,
  MUSHROOM_RED: 83,
  MUSHROOM_BROWN: 84,
  AMETHYST: 85,
  MELON: 86,
  LANTERN: 87,
  BONE_BLOCK: 88,
  NETHERITE_BLOCK: 89,
  TORCH: 90,
  NETHERRACK: 91,
  SOUL_SAND: 92,
  NETHER_QUARTZ_ORE: 93,
  MAGMA: 94,
  NETHER_BRICKS: 95,
  END_STONE: 96,
  PURPUR: 97,
  NETHER_PORTAL: 98,
  END_PORTAL: 99,
  SHROOMLIGHT: 100,
};

const TOOL_TIER = { none: 0, wood: 1, stone: 2, iron: 3, gold: 1, diamond: 4 };

function def(id, name, tiles, opts = {}) {
  const t = typeof tiles === 'number' ? { all: tiles } : tiles;
  return {
    id,
    name,
    tiles: t,
    solid: opts.solid !== false,
    // opaque blocks fully hide neighbouring faces and count for ambient occlusion
    opaque: opts.opaque !== false,
    liquid: !!opts.liquid,
    // rendered in the translucent pass
    translucent: !!opts.translucent,
    // drawn as two crossed quads instead of a cube
    cross: !!opts.cross,
    // shown in the block picker / creative inventory
    pickable: opts.pickable !== false,
    tint: opts.tint || null,
    // survival values
    hardness: opts.hardness !== undefined ? opts.hardness : 1,
    tool: opts.tool || 'none',
    tier: opts.tier !== undefined ? opts.tier : 0,
    drop: opts.drop !== undefined ? opts.drop : id,
    drops: opts.drops || null,
    container: opts.container || null,
    light: opts.light || 0,
    blast: !!opts.blast,
    hurts: opts.hurts || 0,
    portal: opts.portal || null,
  };
}

export const BLOCKS = [];
BLOCKS[B.AIR] = {
  id: B.AIR,
  name: 'Air',
  tiles: {},
  solid: false,
  opaque: false,
  liquid: false,
  translucent: false,
  cross: false,
  pickable: false,
  hardness: 0,
  tool: 'none',
  tier: 0,
  drop: null,
  drops: null,
  container: null,
  light: 0,
};

const stoneHard = { hardness: 1.5, tool: 'pickaxe', tier: 1 };

BLOCKS[B.GRASS] = def(B.GRASS, 'Grass Block', { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE }, {
  hardness: 0.6, tool: 'shovel', drop: B.DIRT,
});
BLOCKS[B.DIRT] = def(B.DIRT, 'Dirt', TILE.DIRT, { hardness: 0.5, tool: 'shovel' });
BLOCKS[B.STONE] = def(B.STONE, 'Stone', TILE.STONE, { ...stoneHard, drop: B.COBBLE });
BLOCKS[B.COBBLE] = def(B.COBBLE, 'Cobblestone', TILE.COBBLE, stoneHard);
BLOCKS[B.SAND] = def(B.SAND, 'Sand', TILE.SAND, { hardness: 0.5, tool: 'shovel' });
BLOCKS[B.GRAVEL] = def(B.GRAVEL, 'Gravel', TILE.GRAVEL, {
  hardness: 0.6, tool: 'shovel', drops: [{ id: I.FLINT, count: 1, chance: 0.15 }, { id: B.GRAVEL, count: 1, chance: 0.85 }],
});
BLOCKS[B.WATER] = def(B.WATER, 'Water', TILE.WATER, {
  solid: false, opaque: false, liquid: true, translucent: true, pickable: false, hardness: 0,
});
BLOCKS[B.OAK_LOG] = def(B.OAK_LOG, 'Oak Log', { top: TILE.LOG_TOP, bottom: TILE.LOG_TOP, side: TILE.LOG_SIDE }, {
  hardness: 2, tool: 'axe',
});
BLOCKS[B.OAK_LEAVES] = def(B.OAK_LEAVES, 'Oak Leaves', TILE.LEAVES, {
  opaque: false, hardness: 0.25, drop: null,
  drops: [{ id: B.SAPLING, count: 1, chance: 0.08 }, { id: I.APPLE, count: 1, chance: 0.06 }],
});
BLOCKS[B.PLANKS] = def(B.PLANKS, 'Oak Planks', TILE.PLANKS, { hardness: 2, tool: 'axe' });
BLOCKS[B.BEDROCK] = def(B.BEDROCK, 'Bedrock', TILE.BEDROCK, { pickable: false, hardness: Infinity, drop: null });
BLOCKS[B.SNOW] = def(B.SNOW, 'Snow Block', TILE.SNOW, { hardness: 0.4, tool: 'shovel' });
BLOCKS[B.SNOW_GRASS] = def(B.SNOW_GRASS, 'Snowy Grass', { top: TILE.SNOW, bottom: TILE.DIRT, side: TILE.SNOW_SIDE }, {
  hardness: 0.6, tool: 'shovel', drop: B.DIRT,
});
BLOCKS[B.SANDSTONE] = def(B.SANDSTONE, 'Sandstone', {
  top: TILE.SANDSTONE_TOP, bottom: TILE.SANDSTONE_TOP, side: TILE.SANDSTONE,
}, { hardness: 0.8, tool: 'pickaxe', tier: 1 });
BLOCKS[B.BRICKS] = def(B.BRICKS, 'Bricks', TILE.BRICKS, { hardness: 2, tool: 'pickaxe', tier: 1 });
BLOCKS[B.GLASS] = def(B.GLASS, 'Glass', TILE.GLASS, {
  opaque: false, translucent: true, hardness: 0.3, drop: null,
});
BLOCKS[B.COAL_ORE] = def(B.COAL_ORE, 'Coal Ore', TILE.COAL_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 1, drop: I.COAL, drops: [{ id: I.COAL, count: 1, chance: 1 }],
});
BLOCKS[B.IRON_ORE] = def(B.IRON_ORE, 'Iron Ore', TILE.IRON_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 2, drop: I.RAW_IRON,
});
BLOCKS[B.GOLD_ORE] = def(B.GOLD_ORE, 'Gold Ore', TILE.GOLD_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 3, drop: I.RAW_GOLD,
});
BLOCKS[B.DIAMOND_ORE] = def(B.DIAMOND_ORE, 'Diamond Ore', TILE.DIAMOND_ORE, {
  hardness: 3.5, tool: 'pickaxe', tier: 3, drop: I.DIAMOND,
});
BLOCKS[B.GLOWSTONE] = def(B.GLOWSTONE, 'Glowstone', TILE.GLOWSTONE, { hardness: 0.4, light: 1 });
BLOCKS[B.OBSIDIAN] = def(B.OBSIDIAN, 'Obsidian', TILE.OBSIDIAN, { hardness: 50, tool: 'pickaxe', tier: 4 });
BLOCKS[B.STONE_BRICKS] = def(B.STONE_BRICKS, 'Stone Bricks', TILE.STONE_BRICKS, stoneHard);
BLOCKS[B.CACTUS] = def(B.CACTUS, 'Cactus', { top: TILE.CACTUS_TOP, bottom: TILE.CACTUS_TOP, side: TILE.CACTUS_SIDE }, {
  hardness: 0.4,
});
BLOCKS[B.BIRCH_LOG] = def(B.BIRCH_LOG, 'Birch Log', {
  top: TILE.LOG_TOP, bottom: TILE.LOG_TOP, side: TILE.BIRCH_LOG,
}, { hardness: 2, tool: 'axe' });
BLOCKS[B.BIRCH_LEAVES] = def(B.BIRCH_LEAVES, 'Birch Leaves', TILE.BIRCH_LEAVES, {
  opaque: false, hardness: 0.25, drop: null, drops: [{ id: B.SAPLING, count: 1, chance: 0.08 }],
});
BLOCKS[B.SPRUCE_LOG] = def(B.SPRUCE_LOG, 'Spruce Log', {
  top: TILE.LOG_TOP, bottom: TILE.LOG_TOP, side: TILE.SPRUCE_LOG,
}, { hardness: 2, tool: 'axe' });
BLOCKS[B.SPRUCE_LEAVES] = def(B.SPRUCE_LEAVES, 'Spruce Leaves', TILE.SPRUCE_LEAVES, {
  opaque: false, hardness: 0.25, drop: null, drops: [{ id: B.SAPLING, count: 1, chance: 0.08 }],
});
BLOCKS[B.ICE] = def(B.ICE, 'Ice', TILE.ICE, {
  opaque: false, translucent: true, hardness: 0.5, drop: null, tool: 'pickaxe', tier: 1,
});

BLOCKS[B.COPPER_ORE] = def(B.COPPER_ORE, 'Copper Ore', TILE.COPPER_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 2, drop: I.RAW_COPPER,
});
BLOCKS[B.REDSTONE_ORE] = def(B.REDSTONE_ORE, 'Redstone Ore', TILE.REDSTONE_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 3, drop: I.REDSTONE, drops: [{ id: I.REDSTONE, count: 4, chance: 1 }],
});
BLOCKS[B.LAPIS_ORE] = def(B.LAPIS_ORE, 'Lapis Ore', TILE.LAPIS_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 2, drop: I.LAPIS, drops: [{ id: I.LAPIS, count: 4, chance: 1 }],
});
BLOCKS[B.EMERALD_ORE] = def(B.EMERALD_ORE, 'Emerald Ore', TILE.EMERALD_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 3, drop: I.EMERALD,
});
BLOCKS[B.DEEPSLATE] = def(B.DEEPSLATE, 'Deepslate', TILE.DEEPSLATE, {
  hardness: 3, tool: 'pickaxe', tier: 1, drop: B.COBBLE_DEEPSLATE,
});
BLOCKS[B.COBBLE_DEEPSLATE] = def(B.COBBLE_DEEPSLATE, 'Cobbled Deepslate', TILE.COBBLE_DEEPSLATE, {
  hardness: 3.5, tool: 'pickaxe', tier: 1,
});
BLOCKS[B.DEEPSLATE_BRICKS] = def(B.DEEPSLATE_BRICKS, 'Deepslate Bricks', TILE.DEEPSLATE_BRICKS, {
  hardness: 3.5, tool: 'pickaxe', tier: 1,
});
BLOCKS[B.GRANITE] = def(B.GRANITE, 'Granite', TILE.GRANITE, stoneHard);
BLOCKS[B.DIORITE] = def(B.DIORITE, 'Diorite', TILE.DIORITE, stoneHard);
BLOCKS[B.ANDESITE] = def(B.ANDESITE, 'Andesite', TILE.ANDESITE, stoneHard);
BLOCKS[B.POLISHED_GRANITE] = def(B.POLISHED_GRANITE, 'Polished Granite', TILE.POLISHED_GRANITE, stoneHard);
BLOCKS[B.POLISHED_DIORITE] = def(B.POLISHED_DIORITE, 'Polished Diorite', TILE.POLISHED_DIORITE, stoneHard);
BLOCKS[B.POLISHED_ANDESITE] = def(B.POLISHED_ANDESITE, 'Polished Andesite', TILE.POLISHED_ANDESITE, stoneHard);
BLOCKS[B.TERRACOTTA] = def(B.TERRACOTTA, 'Terracotta', TILE.TERRACOTTA, { hardness: 1.25, tool: 'pickaxe', tier: 1 });
BLOCKS[B.MOSSY_COBBLE] = def(B.MOSSY_COBBLE, 'Mossy Cobblestone', TILE.MOSSY_COBBLE, stoneHard);
BLOCKS[B.CLAY] = def(B.CLAY, 'Clay', TILE.CLAY, {
  hardness: 0.6, tool: 'shovel', drop: I.CLAY_BALL, drops: [{ id: I.CLAY_BALL, count: 4, chance: 1 }],
});
BLOCKS[B.BIRCH_PLANKS] = def(B.BIRCH_PLANKS, 'Birch Planks', TILE.BIRCH_PLANKS, { hardness: 2, tool: 'axe' });
BLOCKS[B.SPRUCE_PLANKS] = def(B.SPRUCE_PLANKS, 'Spruce Planks', TILE.SPRUCE_PLANKS, { hardness: 2, tool: 'axe' });
BLOCKS[B.BOOKSHELF] = def(B.BOOKSHELF, 'Bookshelf', TILE.BOOKSHELF, { hardness: 1.5, tool: 'axe' });
BLOCKS[B.CRAFTING_TABLE] = def(B.CRAFTING_TABLE, 'Crafting Table', {
  top: TILE.CRAFTING_TOP, bottom: TILE.PLANKS, side: TILE.CRAFTING_SIDE,
}, { hardness: 2.5, tool: 'axe', container: 'crafting' });
BLOCKS[B.FURNACE] = def(B.FURNACE, 'Furnace', {
  top: TILE.FURNACE_TOP, bottom: TILE.FURNACE_TOP, side: TILE.FURNACE_SIDE, front: TILE.FURNACE_FRONT,
}, { hardness: 3.5, tool: 'pickaxe', tier: 1, container: 'furnace' });
BLOCKS[B.CHEST] = def(B.CHEST, 'Chest', {
  top: TILE.CHEST_TOP, bottom: TILE.CHEST_TOP, side: TILE.CHEST_SIDE, front: TILE.CHEST_FRONT,
}, { hardness: 2.5, tool: 'axe', container: 'chest' });

BLOCKS[B.COAL_BLOCK] = def(B.COAL_BLOCK, 'Block of Coal', TILE.COAL_BLOCK, { hardness: 5, tool: 'pickaxe', tier: 1 });
BLOCKS[B.IRON_BLOCK] = def(B.IRON_BLOCK, 'Block of Iron', TILE.IRON_BLOCK, { hardness: 5, tool: 'pickaxe', tier: 2 });
BLOCKS[B.GOLD_BLOCK] = def(B.GOLD_BLOCK, 'Block of Gold', TILE.GOLD_BLOCK, { hardness: 3, tool: 'pickaxe', tier: 3 });
BLOCKS[B.DIAMOND_BLOCK] = def(B.DIAMOND_BLOCK, 'Block of Diamond', TILE.DIAMOND_BLOCK, { hardness: 5, tool: 'pickaxe', tier: 3 });
BLOCKS[B.EMERALD_BLOCK] = def(B.EMERALD_BLOCK, 'Block of Emerald', TILE.EMERALD_BLOCK, { hardness: 5, tool: 'pickaxe', tier: 3 });
BLOCKS[B.LAPIS_BLOCK] = def(B.LAPIS_BLOCK, 'Block of Lapis', TILE.LAPIS_BLOCK, { hardness: 3, tool: 'pickaxe', tier: 2 });
BLOCKS[B.REDSTONE_BLOCK] = def(B.REDSTONE_BLOCK, 'Block of Redstone', TILE.REDSTONE_BLOCK, { hardness: 5, tool: 'pickaxe', tier: 2 });
BLOCKS[B.COPPER_BLOCK] = def(B.COPPER_BLOCK, 'Block of Copper', TILE.COPPER_BLOCK, { hardness: 3, tool: 'pickaxe', tier: 2 });
BLOCKS[B.WOOL_WHITE] = def(B.WOOL_WHITE, 'White Wool', TILE.WOOL_WHITE, { hardness: 0.8 });
BLOCKS[B.WOOL_RED] = def(B.WOOL_RED, 'Red Wool', TILE.WOOL_RED, { hardness: 0.8 });
BLOCKS[B.WOOL_ORANGE] = def(B.WOOL_ORANGE, 'Orange Wool', TILE.WOOL_ORANGE, { hardness: 0.8 });
BLOCKS[B.WOOL_YELLOW] = def(B.WOOL_YELLOW, 'Yellow Wool', TILE.WOOL_YELLOW, { hardness: 0.8 });
BLOCKS[B.WOOL_GREEN] = def(B.WOOL_GREEN, 'Green Wool', TILE.WOOL_GREEN, { hardness: 0.8 });
BLOCKS[B.WOOL_BLUE] = def(B.WOOL_BLUE, 'Blue Wool', TILE.WOOL_BLUE, { hardness: 0.8 });
BLOCKS[B.WOOL_PURPLE] = def(B.WOOL_PURPLE, 'Purple Wool', TILE.WOOL_PURPLE, { hardness: 0.8 });
BLOCKS[B.WOOL_BLACK] = def(B.WOOL_BLACK, 'Black Wool', TILE.WOOL_BLACK, { hardness: 0.8 });
BLOCKS[B.FLOWER_RED] = def(B.FLOWER_RED, 'Poppy', TILE.FLOWER_RED, {
  solid: false, opaque: false, cross: true, hardness: 0.1,
});
BLOCKS[B.FLOWER_YELLOW] = def(B.FLOWER_YELLOW, 'Dandelion', TILE.FLOWER_YELLOW, {
  solid: false, opaque: false, cross: true, hardness: 0.1,
});
BLOCKS[B.TALL_GRASS] = def(B.TALL_GRASS, 'Tall Grass', TILE.TALL_GRASS, {
  solid: false, opaque: false, cross: true, hardness: 0.1, drop: null,
  drops: [{ id: I.WHEAT, count: 1, chance: 0.12 }],
});
BLOCKS[B.DEAD_BUSH] = def(B.DEAD_BUSH, 'Dead Bush', TILE.DEAD_BUSH, {
  solid: false, opaque: false, cross: true, hardness: 0.1, drop: I.STICK, drops: [{ id: I.STICK, count: 1, chance: 1 }],
});
BLOCKS[B.SAPLING] = def(B.SAPLING, 'Oak Sapling', TILE.SAPLING, {
  solid: false, opaque: false, cross: true, hardness: 0.1,
});
BLOCKS[B.PUMPKIN] = def(B.PUMPKIN, 'Pumpkin', {
  top: TILE.PUMPKIN_TOP, bottom: TILE.PUMPKIN_TOP, side: TILE.PUMPKIN_SIDE,
}, { hardness: 1, tool: 'axe' });
BLOCKS[B.HAY] = def(B.HAY, 'Hay Bale', {
  top: TILE.HAY_TOP, bottom: TILE.HAY_TOP, side: TILE.HAY_SIDE,
}, { hardness: 0.5 });
BLOCKS[B.MOSSY_STONE_BRICKS] = def(B.MOSSY_STONE_BRICKS, 'Mossy Stone Bricks', TILE.MOSSY_STONE_BRICKS, stoneHard);
BLOCKS[B.CRACKED_STONE_BRICKS] = def(B.CRACKED_STONE_BRICKS, 'Cracked Stone Bricks', TILE.CRACKED_STONE_BRICKS, stoneHard);
BLOCKS[B.SMOOTH_STONE] = def(B.SMOOTH_STONE, 'Smooth Stone', TILE.SMOOTH_STONE, stoneHard);
BLOCKS[B.QUARTZ] = def(B.QUARTZ, 'Quartz Block', TILE.QUARTZ, { hardness: 0.8, tool: 'pickaxe', tier: 1 });
BLOCKS[B.PODZOL] = def(B.PODZOL, 'Podzol', { top: TILE.PODZOL_TOP, bottom: TILE.DIRT, side: TILE.PODZOL_SIDE }, {
  hardness: 0.5, tool: 'shovel', drop: B.DIRT,
});
BLOCKS[B.COARSE_DIRT] = def(B.COARSE_DIRT, 'Coarse Dirt', TILE.COARSE_DIRT, { hardness: 0.5, tool: 'shovel' });
BLOCKS[B.RED_SAND] = def(B.RED_SAND, 'Red Sand', TILE.RED_SAND, { hardness: 0.5, tool: 'shovel' });
BLOCKS[B.RED_SANDSTONE] = def(B.RED_SANDSTONE, 'Red Sandstone', {
  top: TILE.RED_SANDSTONE, bottom: TILE.RED_SANDSTONE, side: TILE.RED_SANDSTONE,
}, { hardness: 0.8, tool: 'pickaxe', tier: 1 });
BLOCKS[B.MUSHROOM_RED] = def(B.MUSHROOM_RED, 'Red Mushroom', TILE.MUSHROOM_RED, {
  solid: false, opaque: false, cross: true, hardness: 0.1,
});
BLOCKS[B.MUSHROOM_BROWN] = def(B.MUSHROOM_BROWN, 'Brown Mushroom', TILE.MUSHROOM_BROWN, {
  solid: false, opaque: false, cross: true, hardness: 0.1,
});
BLOCKS[B.AMETHYST] = def(B.AMETHYST, 'Amethyst Block', TILE.AMETHYST, { hardness: 1.5, tool: 'pickaxe', tier: 2, light: 0.4 });
BLOCKS[B.MELON] = def(B.MELON, 'Melon', { top: TILE.MELON_TOP, bottom: TILE.MELON_TOP, side: TILE.MELON_SIDE }, {
  hardness: 1, tool: 'axe', drop: I.MELON_SLICE, drops: [{ id: I.MELON_SLICE, count: 3, chance: 1 }, { id: I.MELON_SLICE, count: 2, chance: 0.5 }],
});
BLOCKS[B.LANTERN] = def(B.LANTERN, 'Lantern', TILE.LANTERN, {
  opaque: false, hardness: 0.8, tool: 'pickaxe', light: 1,
});
BLOCKS[B.BONE_BLOCK] = def(B.BONE_BLOCK, 'Bone Block', TILE.BONE_BLOCK, { hardness: 2, tool: 'pickaxe', tier: 2 });
BLOCKS[B.NETHERITE_BLOCK] = def(B.NETHERITE_BLOCK, 'Block of Netherite', TILE.NETHERITE_BLOCK, {
  hardness: 8, tool: 'pickaxe', tier: 4,
});
BLOCKS[B.TORCH] = def(B.TORCH, 'Torch', TILE.TORCH, {
  solid: false, opaque: false, cross: true, hardness: 0.05, light: 1,
});

// Nether and End blocks.
BLOCKS[B.NETHERRACK] = def(B.NETHERRACK, 'Netherrack', TILE.NETHERRACK, { hardness: 0.4, tool: 'pickaxe', tier: 1 });
BLOCKS[B.SOUL_SAND] = def(B.SOUL_SAND, 'Soul Sand', TILE.SOUL_SAND, { hardness: 0.5, tool: 'shovel' });
BLOCKS[B.NETHER_QUARTZ_ORE] = def(B.NETHER_QUARTZ_ORE, 'Nether Quartz Ore', TILE.NETHER_QUARTZ_ORE, {
  hardness: 3, tool: 'pickaxe', tier: 1, drop: I.NETHER_QUARTZ,
  drops: [{ id: I.NETHER_QUARTZ, count: 1, chance: 1 }, { id: I.NETHER_QUARTZ, count: 1, chance: 0.35 }],
});
BLOCKS[B.MAGMA] = def(B.MAGMA, 'Magma Block', TILE.MAGMA, { hardness: 0.5, tool: 'pickaxe', tier: 1, light: 0.6, hurts: 1 });
BLOCKS[B.NETHER_BRICKS] = def(B.NETHER_BRICKS, 'Nether Bricks', TILE.NETHER_BRICKS, { hardness: 2, tool: 'pickaxe', tier: 1 });
BLOCKS[B.END_STONE] = def(B.END_STONE, 'End Stone', TILE.END_STONE, { hardness: 3, tool: 'pickaxe', tier: 1 });
BLOCKS[B.PURPUR] = def(B.PURPUR, 'Purpur Block', TILE.PURPUR, { hardness: 1.5, tool: 'pickaxe', tier: 1 });
BLOCKS[B.SHROOMLIGHT] = def(B.SHROOMLIGHT, 'Shroomlight', TILE.SHROOMLIGHT, { hardness: 1, tool: 'axe', light: 1 });
BLOCKS[B.NETHER_PORTAL] = def(B.NETHER_PORTAL, 'Nether Portal', TILE.NETHER_PORTAL, {
  solid: false, opaque: false, translucent: true, pickable: false, hardness: 0, drop: null, light: 0.8, portal: 'nether',
});
BLOCKS[B.END_PORTAL] = def(B.END_PORTAL, 'End Portal', TILE.END_PORTAL, {
  solid: false, opaque: false, translucent: true, pickable: false, hardness: 0, drop: null, light: 0.8, portal: 'end',
});

/** Resolve the atlas tile used by a block face. */
export function faceTile(blockId, face) {
  const block = BLOCKS[blockId];
  if (!block) return TILE.STONE;
  const t = block.tiles;
  if (t.all !== undefined) return t.all;
  if (t.front !== undefined && face === FACE_PLUS_Z) return t.front;
  if (face === 2) return t.top;
  if (face === 3) return t.bottom;
  return t.side;
}

/** Blocks that can be selected from the creative inventory. */
export const PICKABLE_BLOCKS = BLOCKS.filter((b) => b && b.pickable);

export const isBlockItem = (id) => id > 0 && id < 256 && !!BLOCKS[id];

export const DEFAULT_HOTBAR = [
  B.GRASS,
  B.DIRT,
  B.STONE,
  B.COBBLE,
  B.PLANKS,
  B.OAK_LOG,
  B.GLASS,
  B.SAND,
  B.GLOWSTONE,
];

export const TOOL_TIERS = TOOL_TIER;
