// Chunk lifecycle management: streaming generation/meshing around the player,
// block edits, persistence-friendly save data and simple block queries.

import * as THREE from '../../vendor/three/three.module.js';
import { Chunk } from './chunk.js';
import { WorldGenerator, BIOME } from './worldgen.js';
import { buildChunkMesh } from './mesher.js';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, DEFAULT_RENDER_DISTANCE } from './constants.js';
import { B, BLOCKS } from './blocks.js';

const OFFSET = 32768;
const chunkKey = (cx, cz) => (cx + OFFSET) * 65536 + (cz + OFFSET);

function offsetsFor(radius) {
  const list = [];
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      list.push({ dx, dz, d2: dx * dx + dz * dz });
    }
  }
  list.sort((a, b) => a.d2 - b.d2);
  return list;
}

export class World {
  constructor({ seed = 38, scene, materials, renderDistance = DEFAULT_RENDER_DISTANCE }) {
    this.seed = seed | 0;
    this.scene = scene;
    this.materials = materials;
    this.renderDistance = renderDistance;
    this.generator = new WorldGenerator(this.seed);
    this.chunks = new Map();
    /** @type {Map<number, Map<number, number>>} chunkKey -> (blockIndex -> id) */
    this.edits = new Map();
    this.offsets = offsetsFor(renderDistance);
    this.offsetsAll = offsetsFor(renderDistance + 1);
    this.progressOffsets = offsetsFor(6);
    this.time = 0;
    this.centerCX = null;
    this.centerCZ = null;
    this.meshedCount = 0;
    this._lastChunk = null;

    // Loading progress: chunks inside the view that still need work.
    this.progressTotal = 0;
    this.progressDone = 0;
  }

  key(cx, cz) {
    return chunkKey(cx, cz);
  }

  getChunk(cx, cz) {
    if (this._lastChunk && this._lastChunk.cx === cx && this._lastChunk.cz === cz) return this._lastChunk;
    const chunk = this.chunks.get(chunkKey(cx, cz)) || null;
    if (chunk) this._lastChunk = chunk;
    return chunk;
  }

  setRenderDistance(radius) {
    this.renderDistance = radius;
    this.offsets = offsetsFor(radius);
    this.offsetsAll = offsetsFor(radius + 1);
    this.centerCX = null; // force a refresh pass
    for (const chunk of this.chunks.values()) chunk.dirty = true;
  }

  /** Block id at world coordinates (air outside the vertical range). */
  getBlock(x, y, z) {
    if (y < 0) return B.BEDROCK;
    if (y >= CHUNK_HEIGHT) return B.AIR;
    const chunk = this.getChunk(x >> 4, z >> 4);
    if (!chunk || !chunk.generated) return B.AIR;
    return chunk.blocks[(y << 8) | ((z & 15) << 4) | (x & 15)];
  }

  isSolid(x, y, z) {
    const id = this.getBlock(x, y, z);
    return !!(BLOCKS[id] && BLOCKS[id].solid);
  }

  isWater(x, y, z) {
    const id = this.getBlock(x, y, z);
    return !!(BLOCKS[id] && BLOCKS[id].liquid);
  }

  /** Highest solid/water block in a column, or -1. */
  getHeight(x, z) {
    const chunk = this.getChunk(x >> 4, z >> 4);
    if (!chunk || !chunk.generated) return -1;
    return chunk.heightMap[((z & 15) << 4) | (x & 15)] - 1;
  }

  markDirty(cx, cz) {
    const chunk = this.chunks.get(chunkKey(cx, cz));
    if (chunk) chunk.dirty = true;
  }

  /** Place/remove a block, remeshing the affected chunk and its neighbours. */
  setBlock(x, y, z, id, record = true) {
    if (y < 0 || y >= CHUNK_HEIGHT) return false;
    const cx = x >> 4;
    const cz = z >> 4;
    const chunk = this.getChunk(cx, cz);
    if (!chunk || !chunk.generated) return false;
    const lx = x & 15;
    const lz = z & 15;
    const index = (y << 8) | (lz << 4) | lx;
    if (chunk.blocks[index] === id) return false;
    chunk.blocks[index] = id;
    this.updateColumnHeight(chunk, lx, lz);
    chunk.dirty = true;
    chunk.lastUsed = this.time;

    if (lx === 0) this.markDirty(cx - 1, cz);
    if (lx === 15) this.markDirty(cx + 1, cz);
    if (lz === 0) this.markDirty(cx, cz - 1);
    if (lz === 15) this.markDirty(cx, cz + 1);
    if (lx === 0 && lz === 0) this.markDirty(cx - 1, cz - 1);
    if (lx === 15 && lz === 0) this.markDirty(cx + 1, cz - 1);
    if (lx === 0 && lz === 15) this.markDirty(cx - 1, cz + 1);
    if (lx === 15 && lz === 15) this.markDirty(cx + 1, cz + 1);

    if (record) {
      const key = chunkKey(cx, cz);
      let editMap = this.edits.get(key);
      if (!editMap) {
        editMap = new Map();
        this.edits.set(key, editMap);
      }
      editMap.set(index, id);
    }
    return true;
  }

  updateColumnHeight(chunk, lx, lz) {
    let top = -1;
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (chunk.blocks[(y << 8) | (lz << 4) | lx] !== B.AIR) {
        top = y;
        break;
      }
    }
    chunk.heightMap[(lz << 4) | lx] = top + 1;
  }

  neighborsReady(cx, cz) {
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const chunk = this.chunks.get(chunkKey(cx + dx, cz + dz));
        if (!chunk || !chunk.generated) return false;
      }
    }
    return true;
  }

  buildMesh(chunk) {
    const data = buildChunkMesh(chunk, (cx, cz) => this.chunks.get(chunkKey(cx, cz)));
    this.applyGroup(chunk, 'mesh', data.opaque, this.materials.opaque, 0);
    this.applyGroup(chunk, 'meshWater', data.water, this.materials.water, 2);
    this.applyGroup(chunk, 'meshGlass', data.glass, this.materials.glass, 1);
    chunk.dirty = false;
    chunk.lastUsed = this.time;
  }

  applyGroup(chunk, slot, data, material, renderOrder) {
    let mesh = chunk[slot];
    if (!data) {
      if (mesh) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        chunk[slot] = null;
      }
      return;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(data.uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(data.colors, 3, true));
    geometry.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geometry.computeBoundingSphere();

    if (!mesh) {
      mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(chunk.cx * CHUNK_SIZE, 0, chunk.cz * CHUNK_SIZE);
      mesh.matrixAutoUpdate = false;
      mesh.updateMatrix();
      mesh.renderOrder = renderOrder;
      mesh.frustumCulled = true;
      chunk[slot] = mesh;
      this.scene.add(mesh);
    } else {
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      mesh.material = material;
    }
  }

  /**
   * Stream chunks around a position, spending at most `budgetMs` per call.
   */
  update(playerX, playerZ, budgetMs = 8) {
    this.time += 1;
    const ccx = Math.floor(playerX / CHUNK_SIZE);
    const ccz = Math.floor(playerZ / CHUNK_SIZE);
    if (ccx !== this.centerCX || ccz !== this.centerCZ) {
      this.centerCX = ccx;
      this.centerCZ = ccz;
      this._lastChunk = null;
    }

    const start = performance.now();
    const genBudget = budgetMs * 0.55;

    // 1. Generate chunk data, nearest first, including a 1 chunk border.
    for (let i = 0; i < this.offsetsAll.length; i++) {
      if (performance.now() - start > genBudget) break;
      const { dx, dz } = this.offsetsAll[i];
      const cx = ccx + dx;
      const cz = ccz + dz;
      const key = chunkKey(cx, cz);
      let chunk = this.chunks.get(key);
      if (!chunk) {
        chunk = new Chunk(cx, cz);
        this.chunks.set(key, chunk);
      }
      if (!chunk.generated) {
        this.generator.generate(chunk, this.edits.get(key));
        chunk.lastUsed = this.time;
      }
    }

    // 2. Mesh dirty chunks whose neighbours exist.
    for (let i = 0; i < this.offsets.length; i++) {
      if (performance.now() - start > budgetMs) break;
      const { dx, dz } = this.offsets[i];
      const cx = ccx + dx;
      const cz = ccz + dz;
      const chunk = this.chunks.get(chunkKey(cx, cz));
      if (!chunk) continue;
      if (!chunk.generated) continue;
      if (!chunk.dirty) continue;
      if (!this.neighborsReady(cx, cz)) continue;
      this.buildMesh(chunk);
    }

    // 3. Drop chunks that are far away.
    const maxDist = this.renderDistance + 2;
    for (const [key, chunk] of this.chunks) {
      const dx = chunk.cx - ccx;
      const dz = chunk.cz - ccz;
      if (Math.abs(dx) > maxDist || Math.abs(dz) > maxDist) {
        this.unloadChunk(key, chunk);
      }
    }
  }

  unloadChunk(key, chunk) {
    this.scene.remove(chunk.mesh);
    if (chunk.mesh) chunk.mesh.geometry.dispose();
    this.scene.remove(chunk.meshWater);
    if (chunk.meshWater) chunk.meshWater.geometry.dispose();
    this.scene.remove(chunk.meshGlass);
    if (chunk.meshGlass) chunk.meshGlass.geometry.dispose();
    this.chunks.delete(key);
    if (this._lastChunk === chunk) this._lastChunk = null;
  }

  /** Fraction (0..1) of visible chunks that are fully meshed. */
  getLoadProgress(playerX, playerZ) {
    const ccx = Math.floor(playerX / CHUNK_SIZE);
    const ccz = Math.floor(playerZ / CHUNK_SIZE);
    const radius = Math.min(this.renderDistance, 6);
    const maxD2 = radius * radius;
    let total = 0;
    let done = 0;
    for (const { dx, dz, d2 } of this.progressOffsets) {
      if (d2 > maxD2) continue;
      total++;
      const chunk = this.chunks.get(chunkKey(ccx + dx, ccz + dz));
      if (chunk && chunk.generated && !chunk.dirty) done++;
    }
    return total ? done / total : 0;
  }

  /** Find a pleasant grassy spawn near the origin. */
  findSpawn() {
    const candidates = [];
    for (let radius = 0; radius <= 40; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = dx * 6;
          const z = dz * 6;
          const h = this.generator.heightAt(x, z);
          const biome = this.generator.biomeAt(x, z, h);
          if (h < SEA_LEVEL + 2 || h > 76) continue;
          if (biome === BIOME.OCEAN || biome === BIOME.BEACH) continue;
          const slope =
            Math.abs(this.generator.heightAt(x + 1, z) - h) +
            Math.abs(this.generator.heightAt(x - 1, z) - h) +
            Math.abs(this.generator.heightAt(x, z + 1) - h) +
            Math.abs(this.generator.heightAt(x, z - 1) - h);
          if (slope > 3) continue;
          candidates.push({ x, z, y: Math.floor(h) + 1, biome, dist: dx * dx + dz * dz });
        }
      }
      if (candidates.length > 6) break;
    }
    if (!candidates.length) {
      return { x: 0, z: 0, y: Math.floor(this.generator.heightAt(0, 0)) + 2, biome: 'Plains', dist: 0 };
    }
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0];
  }

  /** Serializable list of player edits. */
  serializeEdits() {
    const out = [];
    for (const [key, map] of this.edits) {
      if (!map.size) continue;
      const cx = Math.floor(key / 65536) - OFFSET;
      const cz = (key % 65536) - OFFSET;
      out.push([cx, cz, Array.from(map.entries())]);
    }
    return out;
  }

  loadEdits(data) {
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      if (!Array.isArray(entry) || entry.length < 3) continue;
      const [cx, cz, pairs] = entry;
      if (typeof cx !== 'number' || typeof cz !== 'number' || !Array.isArray(pairs)) continue;
      const key = chunkKey(cx, cz);
      const map = new Map();
      for (const pair of pairs) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const [index, id] = pair;
        if (typeof index !== 'number' || typeof id !== 'number') continue;
        if (index < 0 || index >= 256 * CHUNK_HEIGHT) continue;
        map.set(index, id & 255);
      }
      if (map.size) this.edits.set(key, map);
    }
  }

  get editCount() {
    let n = 0;
    for (const map of this.edits.values()) n += map.size;
    return n;
  }

  dispose() {
    for (const [key, chunk] of this.chunks) this.unloadChunk(key, chunk);
    this.chunks.clear();
    this.edits.clear();
  }
}
