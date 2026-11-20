// Amanatides & Woo voxel traversal, used for the block highlight and for
// breaking/placing blocks.

/**
 * @param {import('../world/world.js').World} world
 * @param {{x:number,y:number,z:number}} origin
 * @param {{x:number,y:number,z:number}} dir normalized direction
 * @param {number} maxDistance
 * @param {(id:number) => boolean} [targetable]
 */
export function raycast(world, origin, dir, maxDistance = 6, targetable) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);

  const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
  const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
  const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

  const tDeltaX = stepX === 0 ? Infinity : Math.abs(1 / dir.x);
  const tDeltaY = stepY === 0 ? Infinity : Math.abs(1 / dir.y);
  const tDeltaZ = stepZ === 0 ? Infinity : Math.abs(1 / dir.z);

  let tMaxX =
    stepX === 0
      ? Infinity
      : stepX > 0
        ? (x + 1 - origin.x) / dir.x
        : (origin.x - x) / -dir.x;
  let tMaxY =
    stepY === 0
      ? Infinity
      : stepY > 0
        ? (y + 1 - origin.y) / dir.y
        : (origin.y - y) / -dir.y;
  let tMaxZ =
    stepZ === 0
      ? Infinity
      : stepZ > 0
        ? (z + 1 - origin.z) / dir.z
        : (origin.z - z) / -dir.z;

  const isTarget = targetable || ((id) => id !== 0);

  let normal = { x: 0, y: 0, z: 0 };
  let distance = 0;

  // The starting voxel can already be targetable (e.g. standing in tall grass).
  if (isTarget(world.getBlock(x, y, z))) {
    return { x, y, z, normal, distance: 0, id: world.getBlock(x, y, z) };
  }

  for (let i = 0; i < 256; i++) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX;
      distance = tMaxX;
      tMaxX += tDeltaX;
      normal = { x: -stepX, y: 0, z: 0 };
    } else if (tMaxY < tMaxZ) {
      y += stepY;
      distance = tMaxY;
      tMaxY += tDeltaY;
      normal = { x: 0, y: -stepY, z: 0 };
    } else {
      z += stepZ;
      distance = tMaxZ;
      tMaxZ += tDeltaZ;
      normal = { x: 0, y: 0, z: -stepZ };
    }
    if (distance > maxDistance) return null;
    if (y < 0 || y >= 128) continue;
    const id = world.getBlock(x, y, z);
    if (isTarget(id)) {
      return { x, y, z, normal, distance, id };
    }
  }
  return null;
}
