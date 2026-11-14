// First person player: AABB collision against the voxel world, walking,
// sprinting, jumping, swimming and creative flight.

import * as THREE from '../../vendor/three/three.module.js';
import { BLOCKS } from '../world/blocks.js';

const GRAVITY = 28;
const TERMINAL_VELOCITY = 55;
const WALK_SPEED = 4.4;
const SPRINT_SPEED = 6.6;
const FLY_SPEED = 11;
const FLY_SPRINT_SPEED = 22;
const JUMP_VELOCITY = 8.6;
const SWIM_SPEED = 3.0;
const EPS = 0.001;

export class Player {
  constructor(world, spawn) {
    this.world = world;
    // Spawn positions are already in world space (block centres).
    this.pos = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 0.3;
    this.height = 1.8;
    this.eyeHeight = 1.62;
    this.onGround = false;
    this.flying = false;
    this.inWater = false;
    this.headInWater = false;
    this.sprinting = false;
    this.walkDistance = 0;
    this.sensitivity = 1;
    this.lastStep = 0;
  }

  get eyePosition() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
  }

  getForward() {
    const cosPitch = Math.cos(this.pitch);
    return new THREE.Vector3(
      -Math.sin(this.yaw) * cosPitch,
      Math.sin(this.pitch),
      -Math.cos(this.yaw) * cosPitch,
    );
  }

  look(dx, dy) {
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= dx * sens;
    this.pitch -= dy * sens;
    const limit = Math.PI / 2 - 0.001;
    this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
  }

  /** Does the player's AABB intersect this block cell? */
  intersectsBlock(x, y, z) {
    const r = this.radius;
    return (
      this.pos.x + r > x &&
      this.pos.x - r < x + 1 &&
      this.pos.y + this.height > y &&
      this.pos.y < y + 1 &&
      this.pos.z + r > z &&
      this.pos.z - r < z + 1
    );
  }

  collidesAt(x = this.pos.x, y = this.pos.y, z = this.pos.z) {
    const r = this.radius - EPS;
    const minX = Math.floor(x - r);
    const maxX = Math.floor(x + r);
    const minY = Math.floor(y + EPS);
    const maxY = Math.floor(y + this.height - EPS);
    const minZ = Math.floor(z - r);
    const maxZ = Math.floor(z + r);
    for (let by = minY; by <= maxY; by++) {
      for (let bz = minZ; bz <= maxZ; bz++) {
        for (let bx = minX; bx <= maxX; bx++) {
          const id = this.world.getBlock(bx, by, bz);
          if (BLOCKS[id] && BLOCKS[id].solid) return true;
        }
      }
    }
    return false;
  }

  update(dt, input) {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    let wishX = 0;
    let wishZ = 0;
    if (input.forward) {
      wishX += forward.x;
      wishZ += forward.z;
    }
    if (input.back) {
      wishX -= forward.x;
      wishZ -= forward.z;
    }
    if (input.right) {
      wishX += right.x;
      wishZ += right.z;
    }
    if (input.left) {
      wishX -= right.x;
      wishZ -= right.z;
    }
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) {
      wishX /= wishLen;
      wishZ /= wishLen;
    }

    const eyeY = this.pos.y + this.eyeHeight;
    this.inWater = this.world.isWater(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    this.headInWater = this.world.isWater(Math.floor(this.pos.x), Math.floor(eyeY), Math.floor(this.pos.z));

    const sprinting =
      !this.flying && input.sprint && wishLen > 0 && !this.inWater;
    this.sprinting = sprinting;

    let speed = this.flying
      ? input.sprint
        ? FLY_SPRINT_SPEED
        : FLY_SPEED
      : this.inWater
        ? SWIM_SPEED
        : sprinting
          ? SPRINT_SPEED
          : WALK_SPEED;

    if (this.flying) {
      const accel = 1 - Math.exp(-12 * dt);
      this.vel.x += (wishX * speed - this.vel.x) * accel;
      this.vel.z += (wishZ * speed - this.vel.z) * accel;
      let vertical = 0;
      if (input.jump) vertical += speed;
      if (input.descend) vertical -= speed;
      this.vel.y += (vertical - this.vel.y) * accel;
    } else {
      const accel = this.inWater ? 1 - Math.exp(-6 * dt) : this.onGround ? 1 - Math.exp(-16 * dt) : 1 - Math.exp(-4 * dt);
      this.vel.x += (wishX * speed - this.vel.x) * accel;
      this.vel.z += (wishZ * speed - this.vel.z) * accel;

      if (this.inWater) {
        this.vel.y -= 8.5 * dt;
        if (input.jump) this.vel.y += 30 * dt;
        if (input.descend) this.vel.y -= 24 * dt;
        this.vel.y *= 1 - Math.min(1, 2.4 * dt);
        this.vel.y = Math.max(this.vel.y, -4.5);
      } else {
        this.vel.y -= GRAVITY * dt;
        if (this.vel.y < -TERMINAL_VELOCITY) this.vel.y = -TERMINAL_VELOCITY;
        if (input.jump && this.onGround) {
          this.vel.y = JUMP_VELOCITY;
          this.onGround = false;
        }
      }
    }

    this.onGround = false;
    const prevY = this.pos.y;
    this.move(this.vel.x * dt, this.vel.y * dt, this.vel.z * dt);

    // Ground probe so sprinting/jumping stays responsive on slopes and edges.
    if (!this.onGround && this.vel.y <= 0) {
      this.onGround = this.collidesAt(this.pos.x, this.pos.y - 0.06, this.pos.z);
    }
    if (this.onGround && this.vel.y < 0) this.vel.y = 0;

    // Footstep distance tracker (used for sounds).
    if (this.onGround) {
      const moved = Math.hypot(this.pos.x - (this.pos.x - this.vel.x * dt), this.pos.z - (this.pos.z - this.vel.z * dt));
      this.walkDistance += moved;
    } else {
      this.walkDistance = 0;
    }
    if (this.pos.y < -20) {
      // Safety net: respawn above the world if something goes wrong.
      this.pos.y = 100;
      this.vel.set(0, 0, 0);
    }
    return { prevY, inWater: this.inWater, sprinting };
  }

  move(dx, dy, dz) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.4));
    const sx = dx / steps;
    const sy = dy / steps;
    const sz = dz / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis('x', sx);
      this.moveAxis('z', sz);
      this.moveAxis('y', sy);
    }
  }

  moveAxis(axis, amount) {
    if (amount === 0) return false;
    const before = this.pos[axis];
    this.pos[axis] = before + amount;
    if (!this.collidesAt()) return false;

    if (axis === 'y') {
      if (amount > 0) {
        this.pos.y = Math.floor(this.pos.y + this.height) - this.height - EPS;
        this.vel.y = 0;
      } else {
        this.pos.y = Math.floor(this.pos.y) + 1 + EPS;
        this.vel.y = 0;
        this.onGround = true;
      }
    } else if (amount > 0) {
      this.pos[axis] = Math.floor(this.pos[axis] + this.radius) - this.radius - EPS;
      this.vel[axis] = 0;
    } else {
      this.pos[axis] = Math.floor(this.pos[axis] - this.radius) + 1 + this.radius + EPS;
      this.vel[axis] = 0;
    }

    if (this.collidesAt()) {
      this.pos[axis] = before;
      this.vel[axis] = 0;
      if (axis === 'y' && amount < 0) this.onGround = true;
      return true;
    }
    return true;
  }

  /** Is the player's head inside water? */
  isUnderwater() {
    const eyeY = this.pos.y + this.eyeHeight;
    return this.world.isWater(
      Math.floor(this.pos.x),
      Math.floor(eyeY),
      Math.floor(this.pos.z),
    );
  }

  teleportTo(x, y, z) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
  }
}
