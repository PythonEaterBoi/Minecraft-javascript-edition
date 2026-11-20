// Mobs: blocky animals that wander the surface and zombies that hunt at night.
// Each mob is a small THREE.Group of boxes with a cheap wander/chase AI, health
// and drops. Spawning happens around the player and mobs despawn when far away.

import * as THREE from '../../vendor/three/three.module.js';
import { B, BLOCKS } from '../world/blocks.js';
import { I } from '../items/ids.js';

export const MOB_TYPES = {
  pig: {
    name: 'Pig',
    hp: 10,
    speed: 2.1,
    hostile: false,
    width: 0.7,
    height: 0.85,
    body: '#e79aa2',
    head: '#f0b0b6',
    accent: '#d98089',
    drops: [{ id: I.PORKCHOP, min: 1, max: 3 }],
  },
  cow: {
    name: 'Cow',
    hp: 10,
    speed: 1.7,
    hostile: false,
    width: 0.85,
    height: 1.25,
    body: '#5b4433',
    head: '#6f5540',
    accent: '#e6e0d4',
    drops: [{ id: I.BEEF, min: 1, max: 3 }, { id: I.LEATHER, min: 1, max: 2 }],
  },
  chicken: {
    name: 'Chicken',
    hp: 4,
    speed: 2.4,
    hostile: false,
    width: 0.5,
    height: 0.7,
    body: '#f2f2f2',
    head: '#ffffff',
    accent: '#e8b33a',
    drops: [{ id: I.CHICKEN, min: 1, max: 1 }, { id: I.FEATHER, min: 1, max: 2 }],
  },
  sheep: {
    name: 'Sheep',
    hp: 8,
    speed: 1.9,
    hostile: false,
    width: 0.8,
    height: 1.15,
    body: '#efefef',
    head: '#d8c8b8',
    accent: '#c9b9a8',
    drops: [{ id: I.MUTTON, min: 1, max: 2 }, { id: B.WOOL_WHITE, min: 1, max: 2 }],
  },
  titan: {
    name: 'Ember Titan', boss: true, hp: 90, speed: 1.8, hostile: true, damage: 6, width: 1.8, height: 3.5,
    body: '#772e21', head: '#db6928', accent: '#ffbd42',
    drops: [{ id: I.EMBER_EYE, min: 1, max: 1 }, { id: B.GLOWSTONE, min: 6, max: 10 }, { id: I.NETHER_QUARTZ, min: 4, max: 8 }],
    ability: 'slam',
  },
  warden: {
    name: 'Void Warden', boss: true, hp: 72, speed: 3.1, hostile: true, damage: 5, width: 1.2, height: 3.2,
    body: '#332543', head: '#593378', accent: '#d987ff',
    drops: [{ id: I.DIAMOND, min: 3, max: 5 }, { id: B.PURPUR, min: 8, max: 16 }],
    ability: 'blink',
  },
  piglin: {
    name: 'Zombified Piglin', hp: 20, speed: 2.4, hostile: true, damage: 3, width: 0.6, height: 1.9,
    body: '#c98b6b', head: '#e5a585', accent: '#5f8a48',
    drops: [{ id: I.ROTTEN_FLESH, min: 0, max: 2 }, { id: I.GOLD_INGOT, min: 0, max: 1 }],
  },
  zombie: {
    name: 'Zombie',
    hp: 20,
    speed: 2.3,
    hostile: true,
    damage: 3,
    width: 0.6,
    height: 1.85,
    body: '#3f7a4a',
    head: '#4a8a52',
    accent: '#2f5c38',
    drops: [{ id: I.ROTTEN_FLESH, min: 0, max: 2 }],
  },
};

const PASSIVE = ['pig', 'cow', 'chicken', 'sheep'];

let nextId = 1;

function box(w, h, d, color, y, x = 0, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 }),
  );
  mesh.position.set(x, y, z);
  return mesh;
}

function buildModel(type) {
  const def = MOB_TYPES[type];
  const group = new THREE.Group();
  const scale = def.height / 1.0;
  const legHeight = 0.34 * scale;
  const bodyHeight = def.height * 0.45;
  const bodyY = legHeight + bodyHeight / 2;

  const legs = [];
  const legSize = [0.16 * scale, legHeight, 0.16 * scale];
  const insets = def.width * 0.3;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const leg = box(legSize[0], legSize[1], legSize[2], def.accent, legHeight / 2, sx * insets, sz * insets);
    group.add(leg);
    legs.push(leg);
  }

  const body = box(def.width, bodyHeight, def.width * 0.72, def.body, bodyY);
  group.add(body);

  const headSize = type === 'chicken' ? 0.3 : 0.42 * scale;
  const head = box(headSize, headSize, headSize, def.head, bodyY + bodyHeight * 0.55, 0, def.width * 0.34);
  group.add(head);

  if (def.boss) {
    for (const side of [-1, 1]) {
      const horn = box(0.24, type === 'titan' ? 0.8 : 1.2, 0.28, def.accent,
        head.position.y + headSize * 0.48, side * headSize * 0.48, head.position.z);
      horn.rotation.z = -side * 0.38;
      group.add(horn);
    }
  }

  // Eyes.
  const eyeGeo = new THREE.BoxGeometry(headSize * 0.18, headSize * 0.18, 0.02);
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4 });
  for (const ex of [-0.28, 0.28]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(ex * headSize, headSize * 0.12, def.width * 0.34 + headSize / 2);
    group.add(eye);
  }

  if (type === 'chicken') {
    const beak = box(0.12, 0.1, 0.14, '#e8b33a', bodyY + bodyHeight * 0.45, 0, def.width * 0.34 + 0.2);
    group.add(beak);
    const comb = box(0.16, 0.12, 0.14, '#c93a3a', bodyY + bodyHeight * 0.55 + 0.22, 0, def.width * 0.34);
    group.add(comb);
  }
  if (type === 'cow') {
    for (const [dx, dz] of [[-0.2, 0.1], [0.18, -0.12]])
      group.add(box(0.22, 0.16, 0.06, '#f2f2f2', bodyY + bodyHeight * 0.4, dx, def.width * 0.36 + dz * 0.2));
    for (const hx of [-0.16, 0.16]) {
      group.add(box(0.1, 0.2, 0.1, '#d8cfc0', bodyY + bodyHeight * 0.55 + headSize * 0.5, hx, def.width * 0.34));
    }
  }
  if (type === 'pig') {
    group.add(box(0.2, 0.14, 0.1, def.accent, bodyY + bodyHeight * 0.5, 0, def.width * 0.34 + 0.14));
  }
  if (type === 'sheep') {
    const wool = box(def.width * 1.06, bodyHeight * 1.05, def.width * 0.82, '#f4f4f0', bodyY + bodyHeight * 0.1);
    group.add(wool);
  }
  if (type === 'zombie') {
    // Outstretched arms are the zombie signature.
    for (const ax of [-1, 1]) {
      const arm = box(0.18, 0.18, 0.62, def.head, bodyY + 0.06, ax * 0.38, 0.34);
      group.add(arm);
    }
  }

  return { group, legs, head, body };
}

export class Mob {
  constructor(type, x, y, z, scene) {
    this.id = nextId++;
    this.type = type;
    this.def = MOB_TYPES[type];
    this.hp = this.def.hp;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.random() * Math.PI * 2;
    this.targetYaw = this.yaw;
    this.wanderTimer = 1 + Math.random() * 3;
    this.moving = false;
    this.onGround = false;
    this.hurtTimer = 0;
    this.attackCooldown = 0;
    this.phase = Math.random() * 10;
    this.dead = false;
    this.width = this.def.width;
    this.height = this.def.height;

    const model = buildModel(type);
    this.group = model.group;
    this.legs = model.legs;
    this.head = model.head;
    this.body = model.body;
    this.materials = [];
    this.group.traverse((node) => {
      if (node.material && node.material.color) this.materials.push({ mat: node.material, base: node.material.color.clone() });
    });
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  get hostile() {
    return !!this.def.hostile;
  }

  hit(damage, from) {
    if (this.dead) return false;
    this.hp -= damage;
    this.hurtTimer = 0.25;
    if (from) {
      // Knockback away from the attacker.
      const dx = this.pos.x - from.x;
      const dz = this.pos.z - from.z;
      const len = Math.hypot(dx, dz) || 1;
      this.vel.x += (dx / len) * 4.5;
      this.vel.z += (dz / len) * 4.5;
      this.vel.y = Math.max(this.vel.y, 4);
      // Being hit makes animals run and zombies lock on.
      this.wanderTimer = 0;
      if (this.hostile) this.chasing = true;
      else this.fleeTimer = 3;
    }
    if (this.hp <= 0) this.dead = true;
    return this.dead;
  }

  solidAt(world, x, y, z) {
    const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    const def = BLOCKS[id];
    return !!(def && def.solid);
  }

  update(dt, world, player, callbacks) {
    if (this.dead) return;
    const def = this.def;
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.fleeTimer = Math.max(0, (this.fleeTimer || 0) - dt);

    const dx = player.pos.x - this.pos.x;
    const dz = player.pos.z - this.pos.z;
    const dy = player.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dz);

    let wishX = 0;
    let wishZ = 0;
    let wantYaw = this.yaw;

    if (def.hostile && dist < 18 && Math.abs(dy) < 8) {
      // Hunters: walk straight at the player and attack in reach.
      wantYaw = Math.atan2(-dx, -dz);
      if (dist > 1.1) {
        wishX = dx / (dist || 1);
        wishZ = dz / (dist || 1);
      } else if (this.attackCooldown <= 0) {
        this.attackCooldown = 1.1;
        callbacks.onDamage?.(def.damage || 2, this);
      }
      this.moving = dist > 1.1;
    } else if (this.fleeTimer > 0) {
      wantYaw = Math.atan2(-dx, -dz) + Math.PI;
      wishX = Math.sin(wantYaw) * -1;
      wishZ = Math.cos(wantYaw) * -1;
      this.moving = true;
    } else {
      this.wanderTimer -= dt;
      if (this.wanderTimer <= 0) {
        this.wanderTimer = 2 + Math.random() * 5;
        this.moving = Math.random() < 0.65;
        this.targetYaw = Math.random() * Math.PI * 2;
      }
      if (this.moving) {
        wantYaw = this.targetYaw;
        wishX = -Math.sin(wantYaw);
        wishZ = -Math.cos(wantYaw);
      }
    }

    // Boss abilities: the Titan slams the ground, the Warden blinks behind you.
    if (def.boss && def.ability && dist < 20 && Math.abs(dy) < 10) {
      this.abilityTimer = (this.abilityTimer ?? 4) - dt;
      if (this.abilityTimer <= 0) {
        if (def.ability === 'slam' && dist < 5.5 && this.onGround) {
          this.abilityTimer = 6;
          this.vel.y = 7;
          callbacks.onDamage?.(4, this);
          callbacks.onAbility?.(this, 'slam');
        } else if (def.ability === 'blink' && dist > 3) {
          const tx = player.pos.x + (dx / (dist || 1)) * 2.5;
          const tz = player.pos.z + (dz / (dist || 1)) * 2.5;
          const ground = world.getHeight(Math.floor(tx), Math.floor(tz));
          if (ground > 0 && Math.abs(ground + 1 - player.pos.y) < 4) {
            this.pos.set(tx, ground + 1, tz);
            this.vel.set(0, 0, 0);
            this.abilityTimer = 7;
            callbacks.onAbility?.(this, 'blink');
          } else this.abilityTimer = 1;
        } else if (def.ability === 'slam') this.abilityTimer = 0.5;
      }
    }

    // Smooth turn.
    let delta = wantYaw - this.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    this.yaw += delta * Math.min(1, dt * 6);

    const speed = def.speed * (this.hostile ? 1 : 0.75);
    this.vel.x += (wishX * speed - this.vel.x) * Math.min(1, dt * 8);
    this.vel.z += (wishZ * speed - this.vel.z) * Math.min(1, dt * 8);
    this.vel.y -= 26 * dt;
    if (this.vel.y < -40) this.vel.y = -40;

    // Water: float up instead of sinking.
    const inWater = world.isWater(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.2), Math.floor(this.pos.z));
    if (inWater) {
      this.vel.y = Math.min(this.vel.y + 30 * dt, 2.2);
    }

    const stepX = this.vel.x * dt;
    const stepZ = this.vel.z * dt;
    if (stepX && !this.solidAt(world, this.pos.x + stepX + Math.sign(stepX) * this.width * 0.4, this.pos.y + 0.4, this.pos.z)) {
      this.pos.x += stepX;
    } else if (stepX) {
      this.vel.x = 0;
      this.wanderTimer = 0;
    }
    if (stepZ && !this.solidAt(world, this.pos.x, this.pos.y + 0.4, this.pos.z + stepZ + Math.sign(stepZ) * this.width * 0.4)) {
      this.pos.z += stepZ;
    } else if (stepZ) {
      this.vel.z = 0;
      this.wanderTimer = 0;
    }

    this.onGround = false;
    const nextY = this.pos.y + this.vel.y * dt;
    if (this.vel.y <= 0) {
      // Find the floor.
      let grounded = false;
      if (this.solidAt(world, this.pos.x, nextY, this.pos.z)) {
        this.pos.y = Math.floor(nextY) + 1;
        grounded = true;
      } else {
        this.pos.y = nextY;
      }
      // Step up a single block so mobs can climb small hills.
      if (this.solidAt(world, this.pos.x, this.pos.y + 0.05, this.pos.z) && !this.solidAt(world, this.pos.x, this.pos.y + 1.05, this.pos.z)) {
        this.pos.y += 1;
        grounded = true;
      }
      if (grounded) {
        this.vel.y = 0;
        this.onGround = true;
      }
    } else {
      this.pos.y = nextY;
    }

    if (def.boss && this.pos.y < 20) {
      // Bosses never fall out of the world: they climb back to the centre.
      const ground = world.getHeight(0, 0);
      this.pos.set(0.5, Math.max(ground + 1, 60), 0.5);
      this.vel.set(0, 0, 0);
    }
    if (this.pos.y < -10 || this.pos.y > 200) this.dead = true;

    // Animation.
    const speed2 = Math.hypot(this.vel.x, this.vel.z);
    this.phase += dt * (2 + speed2 * 3.2);
    const swing = this.moving ? Math.sin(this.phase) * 0.6 : 0;
    this.legs.forEach((leg, i) => {
      leg.rotation.x = (i % 2 === 0 ? swing : -swing) * (i < 2 ? 1 : 1);
    });
    if (this.head) this.head.rotation.y = Math.sin(this.phase * 0.4) * 0.12;

    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;

    // Hurt flash.
    const flash = this.hurtTimer > 0;
    for (const { mat, base } of this.materials) {
      if (flash) mat.color.setRGB(1, 0.35, 0.35);
      else mat.color.copy(base);
    }
  }

  dispose(scene) {
    scene.remove(this.group);
    this.group.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
      if (node.material) node.material.dispose();
    });
  }
}

export class MobManager {
  constructor(scene) {
    this.scene = scene;
    this.mobs = [];
    this.spawnTimer = 0;
    this.maxMobs = 14;
    this.attackCooldown = 0;
  }

  clear() {
    for (const mob of this.mobs) mob.dispose(this.scene);
    this.mobs = [];
  }

  setWorld(world) {
    this.clear();
    this.world = world;
  }

  add(type, x, y, z) {
    const mob = new Mob(type, x, y, z, this.scene);
    this.mobs.push(mob);
    return mob;
  }

  /** Ray against mob bounding boxes; returns the closest hit. */
  raycast(origin, dir, maxDistance) {
    let best = null;
    for (const mob of this.mobs) {
      if (mob.dead) continue;
      const halfW = mob.width * 0.5;
      const minX = mob.pos.x - halfW;
      const maxX = mob.pos.x + halfW;
      const minY = mob.pos.y;
      const maxY = mob.pos.y + mob.height;
      const minZ = mob.pos.z - halfW;
      const maxZ = mob.pos.z + halfW;
      let tmin = 0;
      let tmax = maxDistance;
      let hit = true;
      for (const axis of ['x', 'y', 'z']) {
        const o = origin[axis];
        const d = dir[axis];
        const lo = axis === 'x' ? minX : axis === 'y' ? minY : minZ;
        const hi = axis === 'x' ? maxX : axis === 'y' ? maxY : maxZ;
        if (Math.abs(d) < 1e-6) {
          if (o < lo || o > hi) {
            hit = false;
            break;
          }
          continue;
        }
        let t1 = (lo - o) / d;
        let t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1);
        tmax = Math.min(tmax, t2);
        if (tmin > tmax) {
          hit = false;
          break;
        }
      }
      if (hit && tmin >= 0 && (!best || tmin < best.distance)) best = { mob, distance: tmin };
    }
    return best;
  }

  damageMob(mob, damage, from, onDrop) {
    const dead = mob.hit(damage, from);
    if (dead) {
      for (const drop of mob.def.drops) {
        const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
        if (count > 0) onDrop?.(drop.id, count);
      }
      this.remove(mob);
    }
    return dead;
  }

  remove(mob) {
    mob.dispose(this.scene);
    this.mobs = this.mobs.filter((m) => m !== mob);
  }

  /** Spawn a random animal or, at night, a zombie near the player. */
  trySpawn(player, isNight, canSpawnBoss = () => true) {
    if (!this.world || this.mobs.length >= this.maxMobs) return;
    const angle = Math.random() * Math.PI * 2;
    const distance = 14 + Math.random() * 22;
    const x = player.pos.x + Math.cos(angle) * distance;
    const z = player.pos.z + Math.sin(angle) * distance;
    const ground = this.world.getHeight(Math.floor(x), Math.floor(z));
    if (ground < 0 || ground >= 120) return;
    const below = this.world.getBlock(Math.floor(x), ground, Math.floor(z));
    if (!BLOCKS[below] || !BLOCKS[below].solid || BLOCKS[below].liquid) return;
    if (BLOCKS[below].name.includes('Leaves') || below === B.OAK_LOG) return;
    const y = ground + 1;
    if (this.world.getBlock(Math.floor(x), y, Math.floor(z)) !== B.AIR) return;

    const distanceToPlayer = Math.hypot(x - player.pos.x, z - player.pos.z);
    if (distanceToPlayer < 10) return;

    const realm = this.world.generator.dimension;
    if (realm === 'nether' || realm === 'end') {
      const boss = realm === 'nether' ? 'titan' : 'warden';
      if (!this.mobs.some((m) => m.type === boss) && canSpawnBoss(boss)) {
        this.add(boss, x + 0.5, y, z + 0.5);
        return;
      }
      if (realm === 'nether' && Math.random() < 0.5 && this.mobs.filter((m) => m.type === 'piglin').length < 6) {
        this.add('piglin', x + 0.5, y, z + 0.5);
      }
      return;
    }
    const hostile = isNight && Math.random() < 0.55;
    const type = hostile ? 'zombie' : PASSIVE[Math.floor(Math.random() * PASSIVE.length)];
    // Animals prefer day, zombies only at night.
    if (!hostile && isNight && Math.random() < 0.5) return;
    this.add(type, x + 0.5, y, z + 0.5);
  }

  update(dt, world, player, callbacks = {}) {
    this.world = world;
    this.spawnTimer += dt;
    const isNight = callbacks.isNight ?? false;
    if (this.spawnTimer > 3.5) {
      this.spawnTimer = 0;
      if (callbacks.allowSpawn !== false) this.trySpawn(player, isNight, callbacks.canSpawnBoss);
    }

    for (const mob of [...this.mobs]) {
      mob.update(dt, world, player, callbacks);
      const far = Math.hypot(mob.pos.x - player.pos.x, mob.pos.z - player.pos.z) > (mob.def.boss ? 140 : 72);
      if (mob.dead || far) {
        if (mob.dead && !mob.dropped) {
          mob.dropped = true;
          for (const drop of mob.def.drops) {
            const count = drop.min + Math.floor(Math.random() * (drop.max - drop.min + 1));
            if (count > 0) callbacks.onDrop?.(drop.id, count);
          }
          callbacks.onKilled?.(mob);
        }
        this.remove(mob);
      }
    }
  }
}
