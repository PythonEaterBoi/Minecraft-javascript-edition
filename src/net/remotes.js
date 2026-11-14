// Blocky avatars for the other players in a multiplayer session.
// Positions arrive ~10 times a second and are interpolated here.

import * as THREE from '../../vendor/three/three.module.js';

const SHIRTS = ['#3f7fd0', '#c9483f', '#3fa05a', '#c9a03f', '#8a5cd0', '#d06a9e', '#4fb3b3', '#7f8794'];
const SKINS = ['#e8b58c', '#c98d63', '#f0c9a0', '#a9714b'];
const PANTS = '#33384a';

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function makeNameTag(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.6, 0.65, 1);
  sprite.position.y = 2.3;
  const draw = (text) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.strokeText(text, 128, 34);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(text, 128, 34);
    texture.needsUpdate = true;
  };
  draw(name);
  return { sprite, draw };
}

export class RemotePlayers {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map();
  }

  get count() {
    return this.players.size;
  }

  add(id, name = 'Player') {
    if (this.players.has(id)) {
      this.rename(id, name);
      return;
    }
    const seed = hashString(id);
    const shirt = SHIRTS[seed % SHIRTS.length];
    const skin = SKINS[(seed >>> 3) % SKINS.length];

    const group = new THREE.Group();
    group.position.set(0, 60, 0);
    const tintables = [];
    const material = (color) => {
      const mat = new THREE.MeshBasicMaterial({ color });
      tintables.push({ mat, base: new THREE.Color(color) });
      return mat;
    };
    const box = (w, h, d, color, x, y, z) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    };

    const legL = box(0.24, 0.75, 0.24, PANTS, -0.14, 0.375, 0);
    const legR = box(0.24, 0.75, 0.24, PANTS, 0.14, 0.375, 0);
    const body = box(0.5, 0.72, 0.28, shirt, 0, 1.11, 0);
    const armL = box(0.2, 0.7, 0.2, shirt, -0.36, 1.1, 0);
    const armR = box(0.2, 0.7, 0.2, shirt, 0.36, 1.1, 0);
    box(0.5, 0.5, 0.5, skin, 0, 1.75, 0);

    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x1b1b1b });
    for (const ex of [-0.11, 0.11]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.02), eyeMaterial);
      eye.position.set(ex, 1.79, 0.26);
      group.add(eye);
    }

    const tag = makeNameTag(name);
    group.add(tag.sprite);
    this.scene.add(group);

    this.players.set(id, {
      id,
      name,
      group,
      tintables,
      label: tag,
      eyeMaterial,
      parts: { legL, legR, armL, armR, body },
      target: new THREE.Vector3(group.position.x, group.position.y, group.position.z),
      yaw: 0,
      targetYaw: 0,
      phase: 0,
      speed: 0,
    });
  }

  rename(id, name) {
    const player = this.players.get(id);
    if (!player || !name || player.name === name) return;
    player.name = name;
    player.label.draw(name);
  }

  remove(id) {
    const player = this.players.get(id);
    if (!player) return;
    this.scene.remove(player.group);
    player.group.traverse((node) => {
      if (node.geometry) node.geometry.dispose();
    });
    for (const { mat } of player.tintables) mat.dispose();
    player.eyeMaterial.dispose();
    player.label.sprite.material.map?.dispose();
    player.label.sprite.material.dispose();
    this.players.delete(id);
  }

  clear() {
    for (const id of [...this.players.keys()]) this.remove(id);
  }

  setState(id, data) {
    if (!data) return;
    if (!this.players.has(id)) this.add(id, data.name || 'Player');
    const player = this.players.get(id);
    if (data.name) this.rename(id, data.name);
    const p = data.p;
    if (Array.isArray(p) && p.length === 3 && p.every(Number.isFinite)) {
      player.speed = Math.hypot(p[0] - player.target.x, p[2] - player.target.z);
      player.target.set(p[0], p[1], p[2]);
    }
    if (Number.isFinite(data.yaw)) player.targetYaw = data.yaw;
  }

  update(dt, light) {
    for (const player of this.players.values()) {
      const smooth = 1 - Math.exp(-14 * Math.min(dt, 0.1));
      player.group.position.lerp(player.target, smooth);

      let delta = player.targetYaw - player.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      player.yaw += delta * Math.min(1, 10 * dt);
      player.group.rotation.y = player.yaw + Math.PI;

      const moving = player.speed > 0.9;
      player.phase += dt * (moving ? 9 : 2);
      const swing = moving ? Math.sin(player.phase) * 0.55 : Math.sin(player.phase) * 0.05;
      player.parts.legL.rotation.x = swing;
      player.parts.legR.rotation.x = -swing;
      player.parts.armL.rotation.x = -swing * 0.8;
      player.parts.armR.rotation.x = swing * 0.8;
      player.parts.body.position.y = 1.11 + (moving ? Math.abs(Math.sin(player.phase)) * 0.03 : 0);

      for (const { mat, base } of player.tintables) {
        mat.color.copy(base).multiplyScalar(light);
      }
      player.eyeMaterial.color.setRGB(0.06 * light, 0.06 * light, 0.06 * light);
    }
  }
}
