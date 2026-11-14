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

  /** Continuous terrain height at world coordinates. */
  heightAt(x, z) {
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

    this.stampTrees(chunk);
    this.stampPlants(chunk);
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
