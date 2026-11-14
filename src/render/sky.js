// Gradient sky dome with sun, stars, fog colours and drifting blocky clouds.

import * as THREE from '../../vendor/three/three.module.js';
import { mulberry32 } from '../core/random.js';

const VERTEX = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vDir = worldPosition.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const FRAGMENT = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDir;
  uniform float uStars;
  varying vec3 vDir;

  float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  float starField(vec3 dir) {
    vec3 p = dir * 320.0;
    vec3 cell = floor(p);
    vec3 f = fract(p) - 0.5;
    float h = hash13(cell);
    float size = smoothstep(0.42, 0.0, length(f));
    return step(0.9965, h) * size;
  }

  void main() {
    vec3 dir = normalize(vDir);
    float up = clamp(dir.y, 0.0, 1.0);
    float t = pow(up, 0.62);
    vec3 color = mix(uHorizon, uZenith, t);
    color = mix(color, uHorizon * 0.72, smoothstep(0.0, -0.22, dir.y));

    vec3 sunDir = normalize(uSunDir);
    float sun = max(dot(dir, sunDir), 0.0);
    color += uSunColor * pow(sun, 420.0) * 1.8;
    color += uSunColor * pow(sun, 9.0) * 0.14;

    if (uStars > 0.01) {
      color += vec3(0.85, 0.9, 1.0) * starField(dir) * uStars * smoothstep(-0.05, 0.2, dir.y);
    }

    gl_FragColor = vec4(color, 1.0);
    #include <colorspace_fragment>
  }
`;

function createCloudTexture() {
  const size = 64;
  const cell = 4;
  const grid = size / cell; // 16 x 16 chunky cloud cells
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = mulberry32(0xc10d5);

  // Soft blobs on a wrapping grid, then thresholded into flat pixel clusters.
  const blobs = [];
  for (let i = 0; i < 26; i++) {
    blobs.push({ x: rand() * grid, y: rand() * grid, r: 1.6 + rand() * 3.4 });
  }
  const mask = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      let value = 0;
      for (const b of blobs) {
        let dx = Math.abs(x + 0.5 - b.x);
        let dy = Math.abs(y + 0.5 - b.y);
        dx = Math.min(dx, grid - dx);
        dy = Math.min(dy, grid - dy);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < b.r) value += 1 - d / b.r;
      }
      mask[y * grid + x] = value > 0.9 ? 1 : 0;
    }
  }

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(255,255,255,0.94)';
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      if (!mask[y * grid + x]) continue;
      // Small ragged edges keep the clouds from looking like perfect blocks.
      const inset = rand() < 0.18 ? 1 : 0;
      ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset, cell - inset);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.repeat.set(4, 4);
  return texture;
}

const COLORS = {
  dayZenith: new THREE.Color('#4f8fd8'),
  dayHorizon: new THREE.Color('#b6d9f5'),
  nightZenith: new THREE.Color('#050a18'),
  nightHorizon: new THREE.Color('#111d36'),
  duskZenith: new THREE.Color('#3b4c78'),
  duskHorizon: new THREE.Color('#ef9153'),
  sunDay: new THREE.Color('#fff6d8'),
  sunDusk: new THREE.Color('#ffb14a'),
  moon: new THREE.Color('#dfe8ff'),
};

export class Sky {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      uZenith: { value: new THREE.Color('#4f8fd8') },
      uHorizon: { value: new THREE.Color('#b6d9f5') },
      uSunColor: { value: new THREE.Color('#fff6d8') },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uStars: { value: 0 },
    };
    const geometry = new THREE.SphereGeometry(700, 24, 16);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
    this.mesh.matrixAutoUpdate = false;
    scene.add(this.mesh);

    this.fogColor = new THREE.Color('#b6d9f5');
    this.dayFactor = 1;
    this.sunDir = new THREE.Vector3(0.4, 0.8, 0.3);

    scene.fog = new THREE.Fog(this.fogColor.getHex(), 60, 140);

    const cloudTexture = createCloudTexture();
    this.cloudMaterial = new THREE.MeshBasicMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), this.cloudMaterial);
    this.clouds.rotation.x = -Math.PI / 2;
    this.clouds.position.y = 168;
    this.clouds.renderOrder = -5;
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.cloudTexture = cloudTexture;
    this.cloudDrift = 0;
    this.cloudsVisible = true;
  }

  setCloudsVisible(visible) {
    this.cloudsVisible = visible;
    this.clouds.visible = visible;
  }

  /**
   * @param {THREE.Camera} camera
   * @param {number} timeOfDay 0..1 where 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
   * @param {number} dt
   * @param {number} fogFar
   */
  update(camera, timeOfDay, dt, fogFar) {
    const angle = timeOfDay * Math.PI * 2;
    const sunDir = new THREE.Vector3(Math.cos(angle - Math.PI / 2), Math.sin(angle - Math.PI / 2), 0.32).normalize();
    this.sunDir.copy(sunDir);
    const elevation = sunDir.y;

    const dayFactor = THREE.MathUtils.smoothstep(elevation, -0.18, 0.22);
    this.dayFactor = dayFactor;
    const duskFactor = Math.max(0, 1 - Math.abs(elevation) / 0.36) * (elevation > -0.3 ? 1 : 0);
    const starFactor = 1 - THREE.MathUtils.smoothstep(elevation, -0.3, 0.05);

    const zenith = COLORS.nightZenith.clone().lerp(COLORS.dayZenith, dayFactor);
    const horizon = COLORS.nightHorizon.clone().lerp(COLORS.dayHorizon, dayFactor);
    zenith.lerp(COLORS.duskZenith, duskFactor * 0.55);
    horizon.lerp(COLORS.duskHorizon, duskFactor * 0.85);

    this.uniforms.uZenith.value.copy(zenith);
    this.uniforms.uHorizon.value.copy(horizon);
    this.uniforms.uSunDir.value.copy(sunDir);
    this.uniforms.uSunColor.value.copy(COLORS.sunDay).lerp(COLORS.sunDusk, duskFactor);
    if (elevation < 0) {
      this.uniforms.uSunColor.value.copy(COLORS.moon);
    }
    this.uniforms.uStars.value = starFactor;

    this.fogColor.copy(horizon);
    if (this.scene.fog) {
      this.scene.fog.color.copy(this.fogColor);
      this.scene.fog.far = fogFar;
      this.scene.fog.near = fogFar * 0.48;
    }

    this.mesh.position.copy(camera.position);
    this.mesh.updateMatrix();

    this.cloudDrift += dt * 0.0016;
    this.cloudTexture.offset.set(this.cloudDrift, this.cloudDrift * 0.35);
    this.clouds.position.x = camera.position.x;
    this.clouds.position.z = camera.position.z;
    this.cloudMaterial.opacity = 0.07 + dayFactor * 0.78;
    this.clouds.visible = this.cloudsVisible;
  }
}
