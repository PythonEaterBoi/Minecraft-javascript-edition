// Block registry. Block ids are stored as bytes inside chunks, so keep the
// list under 256 entries. Textures are indices into the generated atlas.

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
};

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
};

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
    // shown in the block picker / creative inventory
    pickable: opts.pickable !== false,
    tint: opts.tint || null,
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
  pickable: false,
};

BLOCKS[B.GRASS] = def(B.GRASS, 'Grass Block', { top: TILE.GRASS_TOP, bottom: TILE.DIRT, side: TILE.GRASS_SIDE });
BLOCKS[B.DIRT] = def(B.DIRT, 'Dirt', TILE.DIRT);
BLOCKS[B.STONE] = def(B.STONE, 'Stone', TILE.STONE);
BLOCKS[B.COBBLE] = def(B.COBBLE, 'Cobblestone', TILE.COBBLE);
BLOCKS[B.SAND] = def(B.SAND, 'Sand', TILE.SAND);
BLOCKS[B.GRAVEL] = def(B.GRAVEL, 'Gravel', TILE.GRAVEL);
BLOCKS[B.WATER] = def(B.WATER, 'Water', TILE.WATER, {
  solid: false,
  opaque: false,
  liquid: true,
  translucent: true,
  pickable: false,
});
BLOCKS[B.OAK_LOG] = def(B.OAK_LOG, 'Oak Log', { top: TILE.LOG_TOP, bottom: TILE.LOG_TOP, side: TILE.LOG_SIDE });
BLOCKS[B.OAK_LEAVES] = def(B.OAK_LEAVES, 'Oak Leaves', TILE.LEAVES);
BLOCKS[B.PLANKS] = def(B.PLANKS, 'Oak Planks', TILE.PLANKS);
BLOCKS[B.BEDROCK] = def(B.BEDROCK, 'Bedrock', TILE.BEDROCK, { pickable: false });
BLOCKS[B.SNOW] = def(B.SNOW, 'Snow Block', TILE.SNOW);
BLOCKS[B.SNOW_GRASS] = def(B.SNOW_GRASS, 'Snowy Grass', { top: TILE.SNOW, bottom: TILE.DIRT, side: TILE.SNOW_SIDE });
BLOCKS[B.SANDSTONE] = def(B.SANDSTONE, 'Sandstone', {
  top: TILE.SANDSTONE_TOP,
  bottom: TILE.SANDSTONE_TOP,
  side: TILE.SANDSTONE,
});
BLOCKS[B.BRICKS] = def(B.BRICKS, 'Bricks', TILE.BRICKS);
BLOCKS[B.GLASS] = def(B.GLASS, 'Glass', TILE.GLASS, {
  opaque: false,
  translucent: true,
});
BLOCKS[B.COAL_ORE] = def(B.COAL_ORE, 'Coal Ore', TILE.COAL_ORE);
BLOCKS[B.IRON_ORE] = def(B.IRON_ORE, 'Iron Ore', TILE.IRON_ORE);
BLOCKS[B.GOLD_ORE] = def(B.GOLD_ORE, 'Gold Ore', TILE.GOLD_ORE);
BLOCKS[B.DIAMOND_ORE] = def(B.DIAMOND_ORE, 'Diamond Ore', TILE.DIAMOND_ORE);
BLOCKS[B.GLOWSTONE] = def(B.GLOWSTONE, 'Glowstone', TILE.GLOWSTONE);
BLOCKS[B.OBSIDIAN] = def(B.OBSIDIAN, 'Obsidian', TILE.OBSIDIAN);
BLOCKS[B.STONE_BRICKS] = def(B.STONE_BRICKS, 'Stone Bricks', TILE.STONE_BRICKS);
BLOCKS[B.CACTUS] = def(B.CACTUS, 'Cactus', { top: TILE.CACTUS_TOP, bottom: TILE.CACTUS_TOP, side: TILE.CACTUS_SIDE });
BLOCKS[B.BIRCH_LOG] = def(B.BIRCH_LOG, 'Birch Log', {
  top: TILE.LOG_TOP,
  bottom: TILE.LOG_TOP,
  side: TILE.BIRCH_LOG,
});
BLOCKS[B.BIRCH_LEAVES] = def(B.BIRCH_LEAVES, 'Birch Leaves', TILE.BIRCH_LEAVES);
BLOCKS[B.SPRUCE_LOG] = def(B.SPRUCE_LOG, 'Spruce Log', {
  top: TILE.LOG_TOP,
  bottom: TILE.LOG_TOP,
  side: TILE.SPRUCE_LOG,
});
BLOCKS[B.SPRUCE_LEAVES] = def(B.SPRUCE_LEAVES, 'Spruce Leaves', TILE.SPRUCE_LEAVES);
BLOCKS[B.ICE] = def(B.ICE, 'Ice', TILE.ICE, {
  opaque: false,
  translucent: true,
});

// Face order: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
const SIDE_FACES = [0, 1, 4, 5];

/** Resolve the atlas tile used by a block face. */
export function faceTile(blockId, face) {
  const block = BLOCKS[blockId];
  if (!block) return TILE.STONE;
  const t = block.tiles;
  if (t.all !== undefined) return t.all;
  if (face === 2) return t.top;
  if (face === 3) return t.bottom;
  return t.side;
}

/** Blocks that can be selected from the creative inventory. */
export const PICKABLE_BLOCKS = BLOCKS.filter((b) => b && b.pickable);

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

export const isSideFace = (face) => SIDE_FACES.includes(face);
