// Procedural terrain generation: continents, hills, mountains, biomes, caves,
// ore veins and vegetation. All of it is derived from the world seed, so the
// same seed always produces the same world.

import { fbm2, noise3, smoothstep } from '../core/noise.js';
import { rand2, rand3 } from '../core/random.js';
import { B } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL } from './constants.js';

export const BIOME = {
  OCEAN: 'Ocean',
  BEACH: 'Beach',
  PLAINS: 'Plains',
  FOREST: 'Forest',
  DESERT: 'Desert',
  MOUNTAIN: 'Mountains',
  SNOW: 'Snowy Tundra',
};

const BEACH_BAND = 2;
const TREE_MARGIN = 3;

export class WorldGenerator {
  constructor(seed) {
    this.seed = seed | 0;
  }

  temperatureAt(x, z) {
    return fbm2(x * 0.0024 + 800, z * 0.0024 - 300, 2, this.seed + 71);
  }

  humidityAt(x, z) {
    return fbm2(x * 0.0031 - 500, z * 0.0031 + 700, 2, this.seed + 83);
  }

  /* ---------------- Nether and End shape helpers ---------------- */

  netherValley(x, z) {
    return fbm2(x * 0.011 + 300, z * 0.011 - 120, 2, this.seed + 907) < -0.3;
  }

  netherSpire(x, z) {
    const n = fbm2(x * 0.045 + 50, z * 0.045 + 90, 2, this.seed + 913);
    return Math.min(1, Math.max(0, (n - 0.35) / 0.3));
  }

  netherHeight(x, z) {
    const base = 30 + 16 * fbm2(x * 0.03, z * 0.03, 3, this.seed + 901);
    const valley = this.netherValley(x, z) ? -5 : 0;
    const spire = this.netherSpire(x, z);
    return base + valley + spire * spire * 34;
  }

  endIsland(x, z) {
    const d = Math.hypot(x, z);
    const central = 1 - d / 62;
    // Outer islands only appear past a void gap around the central island.
    const outer = d > 90 ? fbm2(x * 0.02, z * 0.02, 3, this.seed + 931) - 0.25 : -1;
    return Math.max(central, outer * 2.2);
  }

  /** Obsidian pillars ring the End's central island. Returns pillar top or -1. */
  endPillar(x, z) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const cx = Math.round(Math.cos(a) * 34);
      const cz = Math.round(Math.sin(a) * 34);
      const r = 2 + (i % 3) * 0.6;
      if ((x - cx) ** 2 + (z - cz) ** 2 <= r * r) return 72 + ((i * 5) % 14);
    }
    return -1;
  }

  generateNether(chunk, blocks, baseX, baseZ) {
    const seed = this.seed;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const top = Math.min(CHUNK_HEIGHT - 6, Math.floor(this.netherHeight(wx, wz)));
        const valley = this.netherValley(wx, wz);
        const spire = this.netherSpire(wx, wz);
        for (let y = 0; y <= top; y++) {
          let id;
          if (y === 0 || (y <= 2 && rand3(wx, y, wz, seed + 5) < 0.5)) id = B.BEDROCK;
          else if (y >= top - 1 && valley) id = B.SOUL_SAND;
          else if (y === top && top < 27) id = B.MAGMA;
          else {
            id = B.NETHERRACK;
            const r = rand3(wx, y, wz, seed + 977);
            if (r < 0.016) id = B.NETHER_QUARTZ_ORE;
            else if (r > 0.996 && y < 20) id = B.MAGMA;
          }
          blocks[(y << 8) | (lz << 4) | lx] = id;
        }
        // Glowstone crowns on the peaks, shroomlights scattered in the wastes.
        const r2 = rand2(wx, wz, seed + 983);
        if (spire > 0.5 && r2 < 0.22) {
          const h = 1 + Math.floor(rand2(wx, wz, seed + 984) * 3);
          for (let y = top + 1; y <= Math.min(CHUNK_HEIGHT - 2, top + h); y++) blocks[(y << 8) | (lz << 4) | lx] = B.GLOWSTONE;
        } else if (!valley && spire === 0 && r2 < 0.004) {
          blocks[((top + 1) << 8) | (lz << 4) | lx] = B.SHROOMLIGHT;
        }
        // Ruined nether-brick pillars on a coarse grid.
        const gx = ((wx % 56) + 56) % 56;
        const gz = ((wz % 56) + 56) % 56;
        if (gx < 2 && gz < 2 && spire < 0.2) {
          const cell = rand2(Math.floor(wx / 56), Math.floor(wz / 56), seed + 991);
          const h = 4 + Math.floor(cell * 6);
          for (let y = top + 1; y <= Math.min(CHUNK_HEIGHT - 2, top + h); y++) blocks[(y << 8) | (lz << 4) | lx] = B.NETHER_BRICKS;
        }
      }
    }
  }

  generateEnd(chunk, blocks, baseX, baseZ) {
    const seed = this.seed;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const island = this.endIsland(wx, wz);
        if (island <= 0) continue;
        const top = Math.floor(48 + island * 12);
        // Islands taper underneath so they read as floating.
        const bottom = Math.floor(top - 3 - island * 22 - rand2(wx, wz, seed + 941) * 2);
        for (let y = Math.max(1, bottom); y <= top; y++) blocks[(y << 8) | (lz << 4) | lx] = B.END_STONE;
        const pillar = this.endPillar(wx, wz);
        if (pillar > 0) {
          for (let y = top + 1; y <= pillar; y++) blocks[(y << 8) | (lz << 4) | lx] = B.OBSIDIAN;
        } else if (Math.hypot(wx, wz) > 100 && rand2(wx, wz, seed + 947) < 0.006) {
          // Purpur ruins dot the outer islands.
          const h = 2 + Math.floor(rand2(wx, wz, seed + 948) * 5);
          for (let y = top + 1; y <= top + h; y++) blocks[(y << 8) | (lz << 4) | lx] = B.PURPUR;
        }
      }
    }
  }

  /** Continuous terrain height at world coordinates. */
  heightAt(x, z) {
    if (this.dimension === 'nether') return this.netherHeight(x, z);
    if (this.dimension === 'end') {
      const island = this.endIsland(x, z);
      return island > 0 ? 48 + island * 12 : -1;
    }
    const s = this.seed;
    const cont = fbm2(x * 0.0032, z * 0.0032, 4, s + 11);
    const hills = fbm2(x * 0.016, z * 0.016, 3, s + 23);
    const rolling = fbm2(x * 0.0075, z * 0.0075, 3, s + 29);
    const detail = fbm2(x * 0.032, z * 0.032, 2, s + 43);
    const ridgeNoise = 1 - Math.abs(fbm2(x * 0.0055, z * 0.0055, 3, s + 37));
    const ridge = ridgeNoise * ridgeNoise * ridgeNoise;
    const mountainMask = smoothstep(0.02, 0.4, fbm2(x * 0.0016, z * 0.0016, 2, s + 51) + 0.22);
    const h = SEA_LEVEL + 2 + cont * 34 + hills * 9 + rolling * 6 + detail * 2.2 + mountainMask * ridge * 22;
    return h;
  }

  biomeAt(x, z, height = this.heightAt(x, z)) {
    if (this.dimension === 'nether') {
      if (this.netherSpire(x, z) > 0.35) return 'Glowstone Peaks';
      return this.netherValley(x, z) ? 'Soul Sand Valley' : 'Nether Wastes';
    }
    if (this.dimension === 'end') return Math.hypot(x, z) < 70 ? 'The End' : 'Outer Islands';
    const h = Math.floor(height);
    if (h <= SEA_LEVEL - 1) return BIOME.OCEAN;
    if (h <= SEA_LEVEL + BEACH_BAND) return BIOME.BEACH;
    const temp = this.temperatureAt(x, z);
    const humid = this.humidityAt(x, z);
    if (h > 70 || temp < -0.34) return BIOME.SNOW;
    if (h > 62) return BIOME.MOUNTAIN;
    if (temp > 0.18 && humid < 0.06) return BIOME.DESERT;
    if (humid > 0.02) return BIOME.FOREST;
    return BIOME.PLAINS;
  }

  /** Fill a chunk with terrain. Does not recompute the height map. */
  generate(chunk, edits = null) {
    const { blocks } = chunk;
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seed = this.seed;

    if (this.dimension === 'nether' || this.dimension === 'end') {
      if (this.dimension === 'nether') this.generateNether(chunk, blocks, baseX, baseZ);
      else this.generateEnd(chunk, blocks, baseX, baseZ);
      if (edits) chunk.applyEdits(edits);
      chunk.recomputeHeightMap();
      chunk.generated = true;
      return chunk;
    }

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const rawH = this.heightAt(wx, wz);
        const h = Math.max(4, Math.min(CHUNK_HEIGHT - 14, Math.floor(rawH)));
        const biome = this.biomeAt(wx, wz, rawH);
        const temp = this.temperatureAt(wx, wz);

        // Choose the surface palette for this column.
        let top = B.GRASS;
        let filler = B.DIRT;
        let fillerDepth = 3;
        let deep = B.STONE;
        let deepStart = 0;

        switch (biome) {
          case BIOME.DESERT:
            top = B.SAND;
            filler = B.SAND;
            fillerDepth = 4;
            deep = B.SANDSTONE;
            deepStart = 4;
            break;
          case BIOME.SNOW:
            top = h > 64 ? B.SNOW : B.SNOW_GRASS;
            filler = B.DIRT;
            fillerDepth = 3;
            break;
          case BIOME.MOUNTAIN:
            top = h > 66 ? B.SNOW : B.STONE;
            filler = B.STONE;
            fillerDepth = 2;
            break;
          case BIOME.BEACH:
            top = B.SAND;
            filler = B.SAND;
            fillerDepth = 3;
            deep = B.SANDSTONE;
            deepStart = 3;
            break;
          case BIOME.OCEAN: {
            const deepFloor = h < SEA_LEVEL - 7;
            top = deepFloor && rand2(wx, wz, seed + 61) < 0.6 ? B.GRAVEL : B.SAND;
            filler = top;
            fillerDepth = 2 + (rand2(wx, wz, seed + 62) < 0.4 ? 1 : 0);
            deep = B.STONE;
            break;
          }
          default:
            break;
        }

        for (let y = 0; y <= h; y++) {
          let id;
          const depth = h - y;
          if (y === 0) {
            id = B.BEDROCK;
          } else if (y <= 2 && rand3(wx, y, wz, seed + 5) < 0.55) {
            id = B.BEDROCK;
          } else if (depth === 0) {
            id = top;
          } else if (depth <= fillerDepth) {
            id = filler;
          } else if (depth <= fillerDepth + deepStart) {
            id = deep;
          } else {
            // Deepslate below the stone line, with the same ores inside it.
            const deepslate = y < 20;
            id = deepslate ? B.DEEPSLATE : B.STONE;
            const r = rand3(wx, y, wz, seed + 999);
            if (y < 14 && r < 0.0022) id = B.DIAMOND_ORE;
            else if (y < 12 && r < 0.0062) id = B.OBSIDIAN;
            else if (y < 16 && r > 0.994) id = B.REDSTONE_ORE;
            else if (y < 24 && r > 0.9915) id = B.LAPIS_ORE;
            else if (y < 20 && r > 0.9988) id = B.EMERALD_ORE;
            else if (y < 30 && r > 0.9952) id = B.GOLD_ORE;
            else if (y < 46 && r > 0.985) id = B.IRON_ORE;
            else if (y < 60 && r > 0.9765) id = B.COPPER_ORE;
            else if (r < 0.028) id = B.COAL_ORE;
            else if (r > 0.982) id = B.GRAVEL;
            else if (r > 0.972) id = B.DIRT;
            else {
              // Granite / diorite / andesite pockets.
              const pocket = noise3(wx * 0.055, y * 0.055, wz * 0.055, seed + 1201);
              if (pocket > 0.72) id = B.GRANITE;
              else if (pocket < 0.19) id = B.DIORITE;
              else if (pocket > 0.63 && pocket < 0.66) id = B.ANDESITE;
            }
          }
          blocks[(y << 8) | (lz << 4) | lx] = id;
        }

        // Surface dressing: coarse dirt, podzol and clay in the right places.
        if (top === B.GRASS) {
          const patch = rand3(wx, 0, wz, seed + 1301);
          if (patch < 0.012) {
            blocks[(h << 8) | (lz << 4) | lx] = B.COARSE_DIRT;
          } else if (patch < 0.03 && this.humidityAt(wx, wz) > 0.2) {
            blocks[(h << 8) | (lz << 4) | lx] = B.PODZOL;
          }
          if (h <= SEA_LEVEL + 2 && patch > 0.985) {
            for (let d = 0; d < 2; d++) blocks[((h - d) << 8) | (lz << 4) | lx] = B.CLAY;
          }
        }
        if (top === B.SAND && biome === BIOME.DESERT && rand3(wx, 0, wz, seed + 1302) < 0.08) {
          blocks[(h << 8) | (lz << 4) | lx] = B.RED_SAND;
        }

        // Water bodies and frozen surfaces.
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            let id = B.WATER;
            if (y === SEA_LEVEL && temp < -0.28) id = B.ICE;
            blocks[(y << 8) | (lz << 4) | lx] = id;
          }
        }

        // Carve caves below the surface.
        const caveCeiling = h - 3;
        for (let y = 3; y <= caveCeiling; y++) {
          if (h < SEA_LEVEL && y > h - 4) continue; // keep the sea bed sealed
          const index = (y << 8) | (lz << 4) | lx;
          if (blocks[index] === B.BEDROCK) continue;
          const n1 = noise3(wx * 0.045, y * 0.072, wz * 0.045, seed + 301) - 0.5;
          const n2 = noise3(wx * 0.045 + 40, y * 0.072 + 40, wz * 0.045 + 40, seed + 401) - 0.5;
          if (n1 * n1 + n2 * n2 < 0.0026) {
            blocks[index] = B.AIR;
          } else if (y < h - 10) {
            const cavern = noise3(wx * 0.021, y * 0.03, wz * 0.021, seed + 501);
            if (cavern > 0.83) blocks[index] = B.AIR;
          }
        }
      }
    }

    if (!this.dimension || this.dimension === 'overworld') {
      this.stampTrees(chunk);
      this.stampPlants(chunk);
    }
    if (edits) chunk.applyEdits(edits);
    chunk.recomputeHeightMap();
    chunk.generated = true;
    return chunk;
  }

  /** Trees are stamped from a slightly larger area so they cross chunk borders. */
  stampTrees(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seed = this.seed;

    for (let lz = -TREE_MARGIN; lz < CHUNK_SIZE + TREE_MARGIN; lz++) {
      for (let lx = -TREE_MARGIN; lx < CHUNK_SIZE + TREE_MARGIN; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const rawH = this.heightAt(wx, wz);
        const h = Math.floor(rawH);
        if (h <= SEA_LEVEL + 1 || h > CHUNK_HEIGHT - 16) continue;

        const biome = this.biomeAt(wx, wz, rawH);
        const r = rand2(wx, wz, seed + 1234);
        let type = null;
        let density = 0;

        if (biome === BIOME.FOREST) {
          density = 0.075;
          type = r < 0.032 ? 'birch' : 'oak';
        } else if (biome === BIOME.PLAINS) {
          density = 0.008;
          type = 'oak';
        } else if (biome === BIOME.SNOW) {
          density = 0.03;
          type = 'spruce';
        } else if (biome === BIOME.MOUNTAIN) {
          density = 0.012;
          type = 'spruce';
        } else if (biome === BIOME.DESERT) {
          density = 0.01;
          type = 'cactus';
        }

        if (!type || r >= density) continue;

        // Reject steep slopes so trunks do not float.
        const slope =
          Math.abs(this.heightAt(wx + 1, wz) - rawH) +
          Math.abs(this.heightAt(wx - 1, wz) - rawH) +
          Math.abs(this.heightAt(wx, wz + 1) - rawH) +
          Math.abs(this.heightAt(wx, wz - 1) - rawH);
        if (slope > 4) continue;
        if (type === 'cactus' && biome !== BIOME.DESERT) continue;

        const baseY = h + 1;
        if (type === 'cactus') this.stampCactus(chunk, lx, baseY, lz, wx, wz);
        else this.stampTree(chunk, lx, baseY, lz, wx, wz, type);
      }
    }
  }

  setLocal(chunk, x, y, z, id, onlyAir = false) {
    if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT) return;
    const index = (y << 8) | (z << 4) | x;
    if (onlyAir && chunk.blocks[index] !== B.AIR) return;
    chunk.blocks[index] = id;
  }

  stampTree(chunk, lx, baseY, lz, wx, wz, type) {
    const seed = this.seed;
    const rng = (n) => rand3(wx, n, wz, seed + 771);
    let trunk = 5 + Math.floor(rng(1) * 2);
    let leaf = B.OAK_LEAVES;
    let log = B.OAK_LOG;
    let slim = false;

    if (type === 'birch') {
      trunk = 6 + Math.floor(rng(2) * 2);
      leaf = B.BIRCH_LEAVES;
      log = B.BIRCH_LOG;
      slim = true;
    } else if (type === 'spruce') {
      trunk = 7 + Math.floor(rng(3) * 3);
      leaf = B.SPRUCE_LEAVES;
      log = B.SPRUCE_LOG;
    }

    for (let i = 0; i < trunk; i++) {
      this.setLocal(chunk, lx, baseY + i, lz, log);
    }

    if (type === 'spruce') {
      const top = baseY + trunk - 1;
      for (let y = baseY + 2; y <= top; y++) {
        const t = (top - y) / Math.max(1, trunk - 2);
        const radius = Math.max(0, Math.round(t * 3));
        for (let dx = -radius; dx <= radius; dx++) {
          for (let dz = -radius; dz <= radius; dz++) {
            const dist = Math.abs(dx) + Math.abs(dz);
            if (dist > radius + 1) continue;
            if (dist === radius + 1 && radius > 0 && rng(y + dx * 7 + dz * 13) < 0.5) continue;
            if (dx === 0 && dz === 0 && y < top) continue;
            this.setLocal(chunk, lx + dx, y, lz + dz, leaf, true);
          }
        }
      }
      this.setLocal(chunk, lx, top + 1, lz, leaf, true);
      return;
    }

    const top = baseY + trunk - 1;
    const maxRadius = slim ? 1 : 2;
    for (let dy = -2; dy <= 1; dy++) {
      const radius = dy <= 0 ? maxRadius : 1;
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (dx === 0 && dz === 0 && dy <= 0) continue;
          const corner = Math.abs(dx) === radius && Math.abs(dz) === radius;
          if (corner && (radius > 1 ? rng(dy * 31 + dx * 7 + dz * 3) < 0.55 : true)) continue;
          if (dy === 1 && Math.abs(dx) + Math.abs(dz) > 1) continue;
          this.setLocal(chunk, lx + dx, top + dy, lz + dz, leaf, true);
        }
      }
    }
    // a little tuft above the trunk
    this.setLocal(chunk, lx, top + 2, lz, leaf, true);
  }

  /** Flowers, grass, mushrooms, pumpkins and dead bushes on the surface. */
  stampPlants(chunk) {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    const seed = this.seed;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const h = Math.floor(this.heightAt(wx, wz));
        if (h < SEA_LEVEL || h >= CHUNK_HEIGHT - 4) continue;
        const index = ((h + 1) << 8) | (lz << 4) | lx;
        if (chunk.blocks[index] !== B.AIR) continue;
        const ground = chunk.blocks[(h << 8) | (lz << 4) | lx];
        const biome = this.biomeAt(wx, wz);
        const r = rand2(wx, wz, seed + 4321);

        if (biome === BIOME.DESERT) {
          if (ground === B.SAND && r < 0.004) chunk.blocks[index] = B.DEAD_BUSH;
          continue;
        }
        if (ground === B.SAND || ground === B.SNOW) continue;

        if (ground === B.PODZOL || (biome === BIOME.FOREST && r > 0.985)) {
          chunk.blocks[index] = r < 0.5 ? B.MUSHROOM_RED : B.MUSHROOM_BROWN;
          continue;
        }
        if (ground !== B.GRASS) continue;

        if (biome === BIOME.PLAINS) {
          if (r < 0.16) chunk.blocks[index] = B.TALL_GRASS;
          else if (r < 0.178) chunk.blocks[index] = r < 0.169 ? B.FLOWER_YELLOW : B.FLOWER_RED;
          else if (r > 0.9975) chunk.blocks[index] = B.PUMPKIN;
        } else if (biome === BIOME.FOREST) {
          if (r < 0.1) chunk.blocks[index] = B.TALL_GRASS;
          else if (r < 0.107) chunk.blocks[index] = r < 0.103 ? B.FLOWER_RED : B.FLOWER_YELLOW;
          else if (r > 0.997) chunk.blocks[index] = B.PUMPKIN;
        } else if (biome === BIOME.SNOW) {
          if (r < 0.01) chunk.blocks[index] = B.TALL_GRASS;
        }
      }
    }
  }

  stampCactus(chunk, lx, baseY, lz, wx, wz) {
    const height = 2 + Math.floor(rand3(wx, 5, wz, this.seed + 91) * 3);
    for (let i = 0; i < height; i++) {
      this.setLocal(chunk, lx, baseY + i, lz, B.CACTUS);
    }
  }
}
