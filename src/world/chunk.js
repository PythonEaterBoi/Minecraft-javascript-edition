import { CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_AREA } from './constants.js';

/** A 16 x 96 x 16 column of blocks. */
export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_AREA * CHUNK_HEIGHT);
    // Height of the highest non-air block for each column (sky light lookup).
    this.heightMap = new Uint8Array(CHUNK_AREA);
    this.generated = false;
    this.dirty = true;
    this.mesh = null;
    this.meshTranslucent = null;
    this.lastUsed = 0;
  }

  static index(x, y, z) {
    return (y << 8) | (z << 4) | x;
  }

  get(x, y, z) {
    return this.blocks[(y << 8) | (z << 4) | x];
  }

  set(x, y, z, id) {
    this.blocks[(y << 8) | (z << 4) | x] = id;
  }

  /** Height of the highest non-air block in a column, -1 when empty. */
  columnTop(x, z) {
    return this.heightMap[(z << 4) | x] - 1;
  }

  recomputeHeightMap() {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        let top = -1;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          if (this.blocks[(y << 8) | (z << 4) | x] !== 0) {
            top = y;
            break;
          }
        }
        this.heightMap[(z << 4) | x] = top + 1;
      }
    }
  }

  /** Apply a Map of blockIndex -> blockId (player edits) onto this chunk. */
  applyEdits(edits) {
    if (!edits || edits.size === 0) return;
    for (const [index, id] of edits) {
      if (index >= 0 && index < this.blocks.length) this.blocks[index] = id;
    }
  }
}
