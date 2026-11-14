// Turns a chunk's voxels into render-ready triangles. One buffer per material
// class (opaque, water, glass) so a whole chunk is a handful of draw calls.
// Faces get baked directional shading, ambient occlusion and a cheap sky-depth
// term so caves and cliffs read well without a light engine.

import { BLOCKS, B, faceTile } from './blocks.js';
import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants.js';
import { tileUV } from './atlas.js';
import { hash3i } from '../core/random.js';

// Face order: 0:+X 1:-X 2:+Y 3:-Y 4:+Z 5:-Z
const FACES = [
  { dir: [1, 0, 0], corners: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.8 },
  { dir: [-1, 0, 0], corners: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.72 },
  { dir: [0, 1, 0], corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { dir: [0, -1, 0], corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.52 },
  { dir: [0, 0, 1], corners: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.66 },
  { dir: [0, 0, -1], corners: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.74 },
];

const AO_LEVELS = [0.46, 0.66, 0.85, 1.0];
const SKY_MIN = 0.55;
const SKY_FALLOFF = 0.058;

// Precompute UVs for every atlas slot.
const UV = [];
for (let i = 0; i < 256; i++) UV.push(tileUV(i));

const PAD = CHUNK_SIZE + 2; // 18
const PAD_AREA = PAD * PAD;

/** Is the face between `selfId` and `neighborId` visible? */
function faceVisible(selfId, neighborId) {
  if (neighborId === B.AIR) return true;
  const self = BLOCKS[selfId];
  const neighbor = BLOCKS[neighborId];
  if (!neighbor) return true;
  if (neighbor.opaque) return false;
  if (self.liquid || self.translucent) return neighborId !== selfId;
  return true;
}

/** Unit normal of a quad, from its two edge vectors. */
function quadNormal(corners) {
  const e1 = [corners[1][0] - corners[0][0], corners[1][1] - corners[0][1], corners[1][2] - corners[0][2]];
  const e2 = [corners[3][0] - corners[0][0], corners[3][1] - corners[0][1], corners[3][2] - corners[0][2]];
  let nx = e1[1] * e2[2] - e1[2] * e2[1];
  let ny = e1[2] * e2[0] - e1[0] * e2[2];
  let nz = e1[0] * e2[1] - e1[1] * e2[0];
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

class BufferBuilder {
  constructor() {
    this.positions = [];
    this.uvs = [];
    this.colors = [];
    this.normals = [];
    this.tangents = [];
    this.indices = [];
    this.vertexCount = 0;
  }

  quad(px, py, pz, face, tile, colors) {
    const uv = UV[tile];
    const corners = face.corners;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      this.positions.push(px + c[0], py + c[1], pz + c[2]);
      if (i === 0 || i === 1) {
        this.uvs.push(i === 0 ? uv.u0 : uv.u1, uv.vBottom);
      } else {
        this.uvs.push(i === 2 ? uv.u1 : uv.u0, uv.vTop);
      }
      const v = Math.max(0, Math.min(255, Math.round(colors[i] * 255)));
      this.colors.push(v, v, v);
    }
    const nrm = quadNormal(corners);
    for (let i = 0; i < 4; i++) this.normals.push(nrm[0], nrm[1], nrm[2]);
    // Tangent frame for normal mapping (U direction of the quad).
    let tx = corners[1][0] - corners[0][0];
    let ty = corners[1][1] - corners[0][1];
    let tz = corners[1][2] - corners[0][2];
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    for (let i = 0; i < 4; i++) this.tangents.push(tx, ty, tz, 1);
    const base = this.vertexCount;
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vertexCount += 4;
  }

  /** Two crossed quads (plants, torches). */
  cross(px, py, pz, tile, brightness, width = 0.86, height = 1, yOffset = 0) {
    const uv = UV[tile];
    const half = width / 2;
    const cx = px + 0.5;
    const cz = pz + 0.5;
    const y0 = py + yOffset;
    const y1 = py + yOffset + height;
    const quads = [
      [[cx - half, y0, cz - half], [cx + half, y0, cz + half], [cx + half, y1, cz + half], [cx - half, y1, cz - half]],
      [[cx - half, y0, cz + half], [cx + half, y0, cz - half], [cx + half, y1, cz - half], [cx - half, y1, cz + half]],
    ];
    for (const corners of quads) {
      for (let i = 0; i < 4; i++) {
        const c = corners[i];
        this.positions.push(c[0], c[1], c[2]);
        const u = i === 0 || i === 3 ? uv.u0 : uv.u1;
        const v = i < 2 ? uv.vBottom : uv.vTop;
        this.uvs.push(u, v);
        const value = Math.max(0, Math.min(255, Math.round(brightness * 255)));
        this.colors.push(value, value, value);
      }
      const nrm = quadNormal(corners);
      for (let i = 0; i < 4; i++) this.normals.push(nrm[0], nrm[1], nrm[2]);
      let tx = corners[1][0] - corners[0][0];
      let ty = corners[1][1] - corners[0][1];
      let tz = corners[1][2] - corners[0][2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      for (let i = 0; i < 4; i++) {
        this.tangents.push(tx, ty, tz, 1);
      }
      // Both windings so the quad is visible from either side even with
      // front-face culling.
      const base = this.vertexCount;
      this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
      this.vertexCount += 4;
    }
  }

  build() {
    if (this.vertexCount === 0) return null;
    return {
      positions: new Float32Array(this.positions),
      uvs: new Float32Array(this.uvs),
      colors: new Uint8Array(this.colors),
      normals: new Float32Array(this.normals),
      tangents: new Float32Array(this.tangents),
      indices: new Uint32Array(this.indices),
      vertexCount: this.vertexCount,
    };
  }
}

/**
 * Build mesh buffers for a chunk.
 * @param {import('./chunk.js').Chunk} chunk
 * @param {(cx:number, cz:number) => import('./chunk.js').Chunk|undefined} getChunk
 */
export function buildChunkMesh(chunk, getChunk) {
  const padded = new Uint8Array(PAD_AREA * CHUNK_HEIGHT);
  const heights = new Uint8Array(PAD_AREA);

  // Copy the chunk plus a one-block border from neighbours into a flat array.
  for (let pz = -1; pz <= CHUNK_SIZE; pz++) {
    const pz1 = pz + 1;
    for (let px = -1; px <= CHUNK_SIZE; px++) {
      const px1 = px + 1;
      const ncx = chunk.cx + (px < 0 ? -1 : px >= CHUNK_SIZE ? 1 : 0);
      const ncz = chunk.cz + (pz < 0 ? -1 : pz >= CHUNK_SIZE ? 1 : 0);
      const nc = getChunk(ncx, ncz);
      if (!nc) continue;
      const lx = (px + CHUNK_SIZE) & 15;
      const lz = (pz + CHUNK_SIZE) & 15;
      const base = pz1 * PAD + px1;
      heights[base] = nc.heightMap[(lz << 4) | lx];
      let src = (lz << 4) | lx;
      let dst = base;
      for (let y = 0; y < CHUNK_HEIGHT; y++) {
        padded[dst] = nc.blocks[src];
        src += 256;
        dst += PAD_AREA;
      }
    }
  }

  const opaque = new BufferBuilder();
  const water = new BufferBuilder();
  const glass = new BufferBuilder();
  const plants = new BufferBuilder();

  const blockAt = (px, y, pz) => {
    if (y < 0) return B.BEDROCK;
    if (y >= CHUNK_HEIGHT) return B.AIR;
    return padded[(y * PAD + (pz + 1)) * PAD + (px + 1)];
  };
  const opaqueAt = (px, y, pz) => {
    if (y < 0) return true;
    if (y >= CHUNK_HEIGHT) return false;
    return BLOCKS[padded[(y * PAD + (pz + 1)) * PAD + (px + 1)]].opaque;
  };
  const heightAt = (px, pz) => heights[(pz + 1) * PAD + (px + 1)];

  const brightness = [1, 1, 1, 1];

  for (let y = 3; y < CHUNK_HEIGHT; y++) {
    for (let pz = 0; pz < CHUNK_SIZE; pz++) {
      for (let px = 0; px < CHUNK_SIZE; px++) {
        const id = padded[(y * PAD + (pz + 1)) * PAD + (px + 1)];
        if (id === B.AIR) continue;
        const def = BLOCKS[id];
        if (!def) continue;

        if (def.cross) {
          const isTorch = id === B.TORCH;
          const noise = hash3i(chunk.cx * CHUNK_SIZE + px, y, chunk.cz * CHUNK_SIZE + pz, 777) / 4294967296;
          // Plants are thin, unshaded quads, so they read over-bright next to
          // terrain that carries baked face shading — keep them a touch darker.
          const shade = isTorch ? 1 : 0.74 + noise * 0.2;
          plants.cross(
            px, y, pz, faceTile(id, 4), shade,
            isTorch ? 0.42 : 0.9,
            isTorch ? 0.65 : 1,
            isTorch ? 0.15 : 0,
          );
          continue;
        }

        let builder;
        if (def.liquid) builder = water;
        else if (def.translucent) builder = glass;
        else builder = opaque;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const [nx, ny, nz] = face.dir;
          const neighbor = blockAt(px + nx, y + ny, pz + nz);
          if (!faceVisible(id, neighbor)) continue;

          const tile = faceTile(id, f);
          const isLiquid = def.liquid;
          const shade = isLiquid ? (f === 2 ? 1.0 : 0.84) : face.shade;
          const hm = heightAt(px + nx, pz + nz);

          const jitter = def.translucent
            ? 1
            : 0.955 + (hash3i(chunk.cx * CHUNK_SIZE + px, y, chunk.cz * CHUNK_SIZE + pz, 4242) / 4294967296) * 0.09;

          for (let i = 0; i < 4; i++) {
            const c = face.corners[i];
            let ao = 1;
            let sky = 1;

            if (!def.translucent) {
              // Ambient occlusion from the three blocks around this corner.
              const axis = f >> 1; // 0 = X faces, 1 = Y faces, 2 = Z faces
              const t1 = axis === 0 ? 1 : 0;
              const t2 = axis === 2 ? 1 : 2;
              const s1 = c[t1] ? 1 : -1;
              const s2 = c[t2] ? 1 : -1;
              const nx2 = px + nx;
              const ny2 = y + ny;
              const nz2 = pz + nz;
              const o1x = t1 === 0 ? s1 : 0;
              const o1y = t1 === 1 ? s1 : 0;
              const o1z = t1 === 2 ? s1 : 0;
              const o2x = t2 === 0 ? s2 : 0;
              const o2y = t2 === 1 ? s2 : 0;
              const o2z = t2 === 2 ? s2 : 0;
              const side1 = opaqueAt(nx2 + o1x, ny2 + o1y, nz2 + o1z) ? 1 : 0;
              const side2 = opaqueAt(nx2 + o2x, ny2 + o2y, nz2 + o2z) ? 1 : 0;
              const corner = opaqueAt(nx2 + o1x + o2x, ny2 + o1y + o2y, nz2 + o1z + o2z) ? 1 : 0;
              const level = side1 && side2 ? 0 : 3 - (side1 + side2 + corner);
              ao = AO_LEVELS[level];
            }

            if (hm > 0) {
              const depth = hm - (y + c[1]);
              if (depth > 0) sky = Math.max(SKY_MIN, 1 - depth * SKY_FALLOFF);
            }

            brightness[i] = shade * ao * sky * jitter;
          }

          builder.quad(px, y, pz, face, tile, brightness);
        }
      }
    }
  }

  return {
    opaque: opaque.build(),
    water: water.build(),
    glass: glass.build(),
    plants: plants.build(),
  };
}
