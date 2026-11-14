// Minecraft: JavaScript Edition
// Application bootstrap + game loop. Everything is static: no build step, no
// server, no external asset requests — so GitHub Pages can host it directly.

import * as THREE from '../vendor/three/three.module.js';
import { getAtlas } from './world/atlas.js';
import { World } from './world/world.js';
import { Player } from './player/player.js';
import { Input } from './player/input.js';
import { raycast } from './player/raycast.js';
import { Sky } from './render/sky.js';
import { UI } from './ui/ui.js';
import { Sfx } from './audio/sfx.js';
import { B, BLOCKS, DEFAULT_HOTBAR } from './world/blocks.js';
import { CHUNK_HEIGHT, MAX_RENDER_DISTANCE } from './world/constants.js';

const SAVE_KEY = 'mje.save.v1';
const DEFAULT_SEED = 38;
const DAY_LENGTH = 480; // seconds for a full day/night cycle
const REACH = 6;

function seedFromString(input) {
  const text = String(input).trim();
  if (/^-?\d+$/.test(text)) {
    const n = Number(text);
    if (Number.isFinite(n)) return n | 0;
  }
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash | 0;
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ui = new UI(this.canvas);
    this.sfx = new Sfx();
    this.settings = this.ui.getSettings();
    this.state = 'title';
    this.world = null;
    this.player = null;
    this.hotbar = DEFAULT_HOTBAR.slice();
    this.selected = 0;
    this.timeOfDay = 0.38;
    this.timeFrozen = false;
    this.dayLength = DAY_LENGTH;
    this.worldReady = false;
    this.spawnAdjusted = false;
    this.lastTime = performance.now();
    this.fps = 60;
    this.frameMs = 16;
    this.titleSpin = 0;
    this.target = null;
    this.lastBreak = 0;
    this.lastPlace = 0;
    this.lastSave = performance.now();
    this.saveDirty = false;
    this.debugTimer = 0;
    this.stepDistance = 0;
    this.bobPhase = 0;
    this.pendingNewWorld = false;

    this.setupRenderer();
    this.setupScene();
    this.setupInput();
    this.setupUI();
    this.setupHighlight();
    this.bindWindowEvents();
    this.loadOrCreateWorld();

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  /* ------------------------------------------------------------------ */
  /* Setup                                                               */
  /* ------------------------------------------------------------------ */

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    const maxRatio = this.ui.isTouch ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = true;
    this.renderer.setClearColor(0x9ec8e8, 1);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1000);
    this.camera.rotation.order = 'YXZ';

    this.atlas = getAtlas();
    const map = this.atlas.texture;
    this.materials = {
      opaque: new THREE.MeshBasicMaterial({ map, vertexColors: true, fog: true }),
      water: new THREE.MeshBasicMaterial({
        map,
        vertexColors: true,
        transparent: true,
        opacity: 0.74,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: true,
      }),
      glass: new THREE.MeshBasicMaterial({
        map,
        vertexColors: true,
        transparent: true,
        depthWrite: true,
        alphaTest: 0.01,
        fog: true,
      }),
    };

    this.sky = new Sky(this.scene);
  }

  setupHighlight() {
    const geometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geometry);
    this.highlight = new THREE.LineSegments(
      edges,
      new THREE.LineBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.65, depthTest: true }),
    );
    this.highlight.visible = false;
    this.highlight.renderOrder = 5;
    this.scene.add(this.highlight);
  }

  setupInput() {
    this.input = new Input(this.canvas, {
      onAction: (type, event) => this.handleAction(type, event),
      onLockChange: (locked) => this.handleLockChange(locked),
      onMouseButton: (button, pressed) => this.handleMouseButton(button, pressed),
      onWheel: (dir) => this.cycleSlot(dir),
    });
    this.input.touchMode = this.ui.isTouch;
  }

  setupUI() {
    this.ui.setCallbacks({
      onUiSound: () => {
        this.sfx.ensure();
        this.sfx.click();
      },
      onPlay: () => this.play(),
      onNewWorld: (seedText) => this.startNewWorld(seedText),
      onResume: () => this.resume(),
      onSave: () => {
        this.saveGame(true);
      },
      onQuit: () => this.quitToTitle(),
      onSelectSlot: (index) => this.selectSlot(index),
      onPickBlock: (id) => this.pickFromInventory(id),
      onInventoryClose: () => this.closeInventory(),
      onInventoryOpen: () => this.openInventory(),
      onTouchPause: () => this.pause(),
      onSettingsChange: (settings) => this.applySettings(settings),
      onToggleFly: () => this.toggleFly(),
      onTouchBreak: () => this.breakBlock(),
      onTouchPlace: () => this.placeBlock(),
      onTouchLook: (dx, dy) => {
        if (this.state === 'playing' && this.ui.isTouch) this.player.look(dx * 1.6, dy * 1.6);
      },
      getSeed: () => this.world?.seed ?? DEFAULT_SEED,
      isPaused: () => this.state === 'paused',
    });
    this.ui.setHotbar(this.hotbar);
    this.ui.setSelectedSlot(this.selected);
    this.applySettings(this.settings);
  }

  bindWindowEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.ui.isTouch ? 1.5 : 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.pause();
      if (document.hidden) this.saveGame();
    });

    window.addEventListener('beforeunload', () => {
      if (this.world) this.saveGame();
    });

    this.canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.ui.showFatal('The WebGL context was lost. Reload the page to keep building.');
    });

    // Clicking the pause/title backdrop does not accidentally resume.
    document.addEventListener('mousedown', () => {
      this.sfx.ensure();
    });
  }

  /* ------------------------------------------------------------------ */
  /* World lifecycle                                                     */
  /* ------------------------------------------------------------------ */

  readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      if (typeof data.seed !== 'number') return null;
      return data;
    } catch {
      return null;
    }
  }

  loadOrCreateWorld() {
    const save = this.readSave();
    if (save) {
      this.timeOfDay = typeof save.time === 'number' ? save.time : this.timeOfDay;
      this.createWorld(save.seed, save);
    } else {
      this.createWorld(DEFAULT_SEED, null);
    }
    this.state = 'title';
    this.ui.showTitle();
    this.ui.setPlayProgress(0);
  }

  createWorld(seed, save) {
    if (this.world) this.world.dispose();

    this.world = new World({
      seed,
      scene: this.scene,
      materials: this.materials,
      renderDistance: this.settings.renderDistance,
    });

    if (save && Array.isArray(save.edits)) this.world.loadEdits(save.edits);

    let spawn;
    this.freshSpawn = !(save && save.player && Number.isFinite(save.player.x));
    if (this.freshSpawn) {
      const s = this.world.findSpawn();
      spawn = { x: s.x + 0.5, y: s.y, z: s.z + 0.5 };
    } else {
      spawn = { x: save.player.x, y: save.player.y, z: save.player.z };
    }

    this.player = new Player(this.world, spawn);
    this.player.sensitivity = this.settings.sensitivity;
    if (save && save.player) {
      this.player.yaw = Number(save.player.yaw) || 0;
      this.player.pitch = Number(save.player.pitch) || 0;
      this.player.flying = !!save.player.flying;
    }

    this.hotbar =
      save && Array.isArray(save.hotbar) && save.hotbar.length === 9
        ? save.hotbar.map((id) => (BLOCKS[id] ? id : B.STONE))
        : DEFAULT_HOTBAR.slice();
    this.selected = save && Number.isInteger(save.selected) ? Math.max(0, Math.min(8, save.selected)) : 0;

    this.worldReady = false;
    this.spawnAdjusted = false;
    this.saveDirty = false;
    this.lastSave = performance.now();

    this.ui.setHotbar(this.hotbar);
    this.ui.setSelectedSlot(this.selected);
    this.ui.setSeed(seed);

    // Prime the camera so the very first frame is not at the origin.
    this.updateCamera(0, true);
  }

  startNewWorld(seedText) {
    const seed = seedFromString(seedText);
    this.saveGame();
    this.state = 'loading';
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.hideTitle();
    this.ui.hidePause();
    this.ui.hideHud();
    this.ui.showLoading('Generating terrain…');
    this.ui.setLoading(0.02, `seed ${seed} · building terrain`);
    this.timeOfDay = 0.38;
    this.pendingNewWorld = true;
    this.createWorld(seed, null);
  }

  quitToTitle() {
    this.saveGame();
    this.state = 'title';
    this.ui.hidePause();
    this.ui.hideHud();
    this.ui.closeInventory();
    this.ui.closeModal();
    this.ui.showTitle();
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.setPlayProgress(1, 'click to play');
  }

  /* ------------------------------------------------------------------ */
  /* State transitions                                                   */
  /* ------------------------------------------------------------------ */

  play() {
    if (!this.worldReady) return;
    this.sfx.ensure();
    this.state = 'playing';
    this.ui.hideTitle();
    this.ui.hidePause();
    this.ui.showHud();
    this.input.enabled = true;
    this.titleSpin = 0;
    this.adjustSpawn();
    if (!this.ui.isTouch) this.requestLockWithHint();
    else this.ui.toast('Drag to look · joystick to move', 3200);
    this.ui.setDebugVisible(this.ui.debugVisible);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.saveGame();
    this.input.enabled = false;
    this.ui.showPause(this.pauseMeta());
    this.input.exitLock();
  }

  resume() {
    if (this.state !== 'paused' && this.state !== 'inventory') return;
    this.state = 'playing';
    this.ui.hidePause();
    this.ui.showHud();
    this.input.enabled = true;
    if (!this.ui.isTouch) this.requestLockWithHint();
  }

  openInventory() {
    if (this.state !== 'playing') return;
    this.state = 'inventory';
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.openInventory(this.hotbar, this.selected);
  }

  closeInventory() {
    if (this.state !== 'inventory') return;
    this.ui.closeInventory();
    this.state = 'playing';
    this.input.enabled = true;
    if (!this.ui.isTouch) this.requestLockWithHint();
  }

  requestLockWithHint() {
    this.input.requestLock();
    setTimeout(() => {
      if (this.state === 'playing' && !this.input.locked && !this.ui.isTouch) {
        this.ui.toast('Click the world to look around', 2600);
      }
    }, 350);
  }

  handleLockChange(locked) {
    if (locked) {
      if (this.state === 'playing') this.ui.hidePause();
      return;
    }
    if (this.state === 'playing' && !this.ui.isTouch) this.pause();
  }

  pauseMeta() {
    const edits = this.world ? this.world.editCount : 0;
    const pos = this.player
      ? `${this.player.pos.x.toFixed(1)} / ${this.player.pos.y.toFixed(1)} / ${this.player.pos.z.toFixed(1)}`
      : '';
    return `seed ${this.world?.seed ?? DEFAULT_SEED} · ${edits} edit${edits === 1 ? '' : 's'} · ${pos}`;
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  applySettings(settings) {
    this.settings = settings;
    if (this.player) this.player.sensitivity = settings.sensitivity;
    this.sfx.toggle(!!settings.sound);
    if (this.sky) this.sky.setCloudsVisible(!!settings.clouds);
    if (this.world) {
      const rd = Math.max(4, Math.min(MAX_RENDER_DISTANCE, Math.round(settings.renderDistance)));
      if (this.world.renderDistance !== rd) this.world.setRenderDistance(rd);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Input handling                                                      */
  /* ------------------------------------------------------------------ */

  handleAction(type, event) {
    if (type === 'keyup') return;
    const code = event.code;

    if (this.ui.modalOpen) {
      if (code === 'Escape') {
        event.preventDefault();
        this.ui.closeModal();
      }
      return;
    }

    if (this.state === 'inventory') {
      if (code === 'KeyE' || code === 'Escape') {
        event.preventDefault();
        this.closeInventory();
      }
      return;
    }

    if (this.state === 'paused') {
      if (code === 'Escape') {
        event.preventDefault();
        this.resume();
      }
      return;
    }

    if (this.state === 'title') {
      if (code === 'Enter' && this.worldReady) this.play();
      return;
    }

    if (this.state !== 'playing') return;

    if (code.startsWith('Digit')) {
      const n = Number(code.slice(5));
      if (n >= 1 && n <= 9) this.selectSlot(n - 1);
      return;
    }

    switch (code) {
      case 'KeyE':
        event.preventDefault();
        this.openInventory();
        break;
      case 'KeyF':
        this.toggleFly();
        break;
      case 'F3':
        event.preventDefault();
        this.ui.toggleDebug();
        break;
      case 'KeyT':
        this.timeFrozen = !this.timeFrozen;
        this.ui.toast(this.timeFrozen ? 'Time paused' : 'Time flowing');
        break;
      case 'Escape':
        this.pause();
        break;
      default:
        break;
    }
  }

  handleMouseButton(button, pressed) {
    if (this.state !== 'playing' || !this.input.locked) return;
    if (button === 0) {
      if (pressed) {
        this.breakBlock();
        this.lastBreak = performance.now();
      }
    } else if (button === 2) {
      if (pressed) {
        this.placeBlock();
        this.lastPlace = performance.now();
      }
    } else if (button === 1) {
      if (pressed) this.pickBlock();
    }
  }

  selectSlot(index) {
    if (index < 0 || index > 8) return;
    this.selected = index;
    this.ui.setSelectedSlot(index);
    this.sfx.click();
  }

  cycleSlot(direction) {
    const next = (this.selected + direction + 9) % 9;
    this.selectSlot(next);
  }

  pickFromInventory(id) {
    this.hotbar[this.selected] = id;
    this.ui.setHotbar(this.hotbar);
    this.ui.setSelectedSlot(this.selected);
    this.saveDirty = true;
  }

  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    if (!BLOCKS[id] || !BLOCKS[id].pickable) return;
    this.pickFromInventory(id);
    const existing = this.hotbar.indexOf(id);
    if (existing >= 0) this.selectSlot(existing);
    else this.ui.toast(`${BLOCKS[id].name} → slot ${this.selected + 1}`);
  }

  toggleFly() {
    if (!this.player || this.state !== 'playing') return;
    this.player.flying = !this.player.flying;
    this.player.vel.y = 0;
    this.ui.toast(this.player.flying ? 'Flight enabled · Space / Shift to rise and sink' : 'Flight disabled');
  }

  /* ------------------------------------------------------------------ */
  /* Block interaction                                                   */
  /* ------------------------------------------------------------------ */

  updateTarget() {
    if (!this.player) return;
    const origin = this.player.eyePosition;
    const dir = this.player.getForward();
    const isTargetable = (id) => !!(BLOCKS[id] && BLOCKS[id].solid);
    this.target = raycast(this.world, origin, dir, REACH, isTargetable);
    if (this.target && this.target.distance > REACH - 0.9) this.target = null;
    if (this.state === 'playing' && this.target) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  breakBlock() {
    if (this.state !== 'playing' || !this.target) return;
    const target = this.target;
    const id = target.id;
    if (id === B.BEDROCK) {
      this.ui.toast('Bedrock is unbreakable');
      return;
    }
    if (this.world.setBlock(target.x, target.y, target.z, B.AIR)) {
      this.sfx.breakBlock(id);
      this.ui.swingHand();
      this.saveDirty = true;
      this.updateTarget();
    }
  }

  placeBlock() {
    if (this.state !== 'playing' || !this.target) return;
    const id = this.hotbar[this.selected];
    if (!id) return;
    const { x, y, z, normal } = this.target;
    const px = x + normal.x;
    const py = y + normal.y;
    const pz = z + normal.z;
    if (py < 0 || py >= CHUNK_HEIGHT) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== B.AIR && !(BLOCKS[existing] && BLOCKS[existing].liquid)) return;
    if (this.player.intersectsBlock(px, py, pz)) return;
    if (this.world.setBlock(px, py, pz, id)) {
      this.sfx.placeBlock(id);
      this.ui.swingHand();
      this.saveDirty = true;
      this.updateTarget();
    }
  }

  /* ------------------------------------------------------------------ */
  /* Save / load                                                         */
  /* ------------------------------------------------------------------ */

  saveGame(notify = false) {
    if (!this.world || !this.player) return;
    try {
      const data = {
        version: 1,
        savedAt: Date.now(),
        seed: this.world.seed,
        time: this.timeOfDay,
        player: {
          x: this.player.pos.x,
          y: this.player.pos.y,
          z: this.player.pos.z,
          yaw: this.player.yaw,
          pitch: this.player.pitch,
          flying: this.player.flying,
        },
        hotbar: this.hotbar.slice(),
        selected: this.selected,
        edits: this.world.serializeEdits(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      this.saveDirty = false;
      this.lastSave = performance.now();
      if (notify) this.ui.toast('World saved');
    } catch (error) {
      console.warn('Save failed', error);
      this.ui.toast('Could not save — browser storage may be full', 3000);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Loop                                                                */
  /* ------------------------------------------------------------------ */

  loop(now) {
    const raw = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const dt = Math.min(0.1, Math.max(0.0005, raw));
    if (raw > 0.0005) {
      this.frameMs = this.frameMs * 0.9 + Math.min(200, raw * 1000) * 0.1;
      this.fps = 1000 / this.frameMs;
    }
    try {
      this.update(dt);
      this.render(dt);
    } catch (error) {
      console.error(error);
      this.ui.showFatal(error instanceof Error ? error.message : String(error));
      return;
    }
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const playing = this.state === 'playing';
    const touch = this.ui.isTouch;

    // Day/night.
    if (this.settings.dayCycle && !this.timeFrozen) {
      this.timeOfDay = (this.timeOfDay + dt / this.dayLength) % 1;
    }

    // Look.
    if (playing && (this.input.locked || touch)) {
      const look = this.input.consumeLook();
      if (look.x || look.y) this.player.look(look.x, look.y);
    }

    // Movement.
    if (playing && this.player) {
      const move = this.input.getMoveState();
      if (touch) {
        const joystick = this.ui.getTouchState();
        move.forward = -joystick.y > 0.22;
        move.back = -joystick.y < -0.22;
        move.right = joystick.x > 0.22;
        move.left = joystick.x < -0.22;
        move.jump = move.jump || joystick.jump;
        move.descend = move.descend || joystick.descend;
        move.sprint = false;
      }
      const wasInWater = this.player.inWater;
      this.player.update(dt, move);
      if (!wasInWater && this.player.inWater) this.sfx.splash();

      // Footstep sounds.
      if (this.player.onGround) {
        this.stepDistance += Math.hypot(this.player.vel.x, this.player.vel.z) * dt;
        if (this.stepDistance > 2.1) {
          this.stepDistance = 0;
          const below = this.world.getBlock(
            Math.floor(this.player.pos.x),
            Math.floor(this.player.pos.y - 0.2),
            Math.floor(this.player.pos.z),
          );
          this.sfx.step(below);
        }
      } else {
        this.stepDistance = 1.4;
      }

      // Continuous breaking/placing.
      const now = performance.now();
      if (this.input.mouseDown.has(0) && now - this.lastBreak > 190) {
        this.breakBlock();
        this.lastBreak = now;
      }
      if (this.input.mouseDown.has(2) && now - this.lastPlace > 190) {
        this.placeBlock();
        this.lastPlace = now;
      }

      this.updateTarget();
    } else {
      this.highlight.visible = false;
      if (this.state === 'title') this.titleSpin += dt * 0.045;
    }

    // Stream chunks.
    if (this.world && this.player) {
      const budget = this.state === 'loading' ? 20 : playing ? 8 : 16;
      this.world.update(this.player.pos.x, this.player.pos.z, budget);

      if (!this.worldReady && !this.pendingNewWorld) {
        const progress = this.world.getLoadProgress(this.player.pos.x, this.player.pos.z);
        this.ui.setPlayProgress(progress);
        if (progress >= 0.985) {
          this.worldReady = true;
          this.adjustSpawn();
          this.ui.setPlayProgress(1);
          this.ui.hideLoading();
        }
      }

      if (this.pendingNewWorld) {
        const progress = this.world.getLoadProgress(this.player.pos.x, this.player.pos.z);
        this.ui.setLoading(Math.max(0.02, progress), `seed ${this.world.seed} · ${Math.round(progress * 100)}%`);
        if (progress >= 0.985) {
          this.pendingNewWorld = false;
          this.worldReady = true;
          this.adjustSpawn();
          this.ui.hideLoading();
          this.state = 'title';
          this.ui.showTitle();
          this.ui.setPlayProgress(1, 'click to play');
          this.saveDirty = true;
          this.saveGame();
          this.ui.toast(`New world created · seed ${this.world.seed}`, 3000);
        }
      }
    }

    // Camera.
    this.updateCamera(dt, false);

    // Sky, fog and light.
    const underwater = playing && this.player && this.player.isUnderwater();
    this.ui.setUnderwater(!!underwater);
    const fogFar = underwater ? 24 : this.settings.renderDistance * 16 - 8;
    this.sky.update(this.camera, this.timeOfDay, dt, fogFar);
    if (underwater) {
      this.scene.fog.color.setHex(0x134a70);
      this.scene.fog.near = 0.1;
      this.scene.fog.far = 22;
    }
    const light = 0.34 + 0.66 * this.sky.dayFactor;
    const warm = this.sky.dayFactor;
    this.materials.opaque.color.setRGB(light, light * (0.97 + 0.03 * warm), light * 0.98);
    this.materials.water.color.setRGB(light * 0.95, light * 0.98, light);
    this.materials.glass.color.setRGB(light, light, light);
    this.renderer.setClearColor(this.scene.fog.color, 1);

    // Debug overlay.
    this.debugTimer += dt;
    if (this.debugTimer > 0.2) {
      this.debugTimer = 0;
      this.ui.setDebug(this.debugText());
    }

    // Periodic autosave (also persists the player's position).
    if (performance.now() - this.lastSave > 20000) this.saveGame();
  }


  updateCamera(dt, prime = false) {
    if (!this.player) return;
    const sprintFov = this.state === 'playing' && this.player.sprinting ? 82 : 75;
    if (Math.abs(this.camera.fov - sprintFov) > 0.1) {
      this.camera.fov += (sprintFov - this.camera.fov) * Math.min(1, dt * 8);
      this.camera.updateProjectionMatrix();
    }

    let bob = 0;
    if (this.state === 'playing' && this.player.onGround) {
      const speed = Math.hypot(this.player.vel.x, this.player.vel.z);
      this.bobPhase += speed * dt * 2.2;
      bob = Math.sin(this.bobPhase * 3.4) * Math.min(0.045, speed * 0.008);
    }
    const eye = this.player.eyePosition;
    this.camera.position.set(eye.x, eye.y + bob, eye.z);
    const spin = this.state === 'title' ? this.titleSpin : 0;
    this.camera.rotation.set(this.player.pitch, this.player.yaw + spin, 0);
  }

  /** Finds standing height on open ground (not on a tree canopy). */
  clearSpawnHeight(x, z) {
    const top = this.world.getHeight(x, z);
    if (top < 0 || top + 3 >= CHUNK_HEIGHT) return null;
    const ground = this.world.getBlock(x, top, z);
    const def = BLOCKS[ground];
    if (!def || !def.solid || def.liquid || !def.opaque) return null;
    const treeBark = ground === B.OAK_LOG || ground === B.BIRCH_LOG || ground === B.SPRUCE_LOG;
    const leaves = ground === B.OAK_LEAVES || ground === B.BIRCH_LEAVES || ground === B.SPRUCE_LEAVES;
    if (treeBark || leaves) return null;
    if (this.world.getBlock(x, top + 1, z) !== B.AIR) return null;
    if (this.world.getBlock(x, top + 2, z) !== B.AIR) return null;
    return top + 1;
  }

  adjustSpawn() {
    if (this.spawnAdjusted || !this.world || !this.player) return;
    this.spawnAdjusted = true;
    const px = Math.floor(this.player.pos.x);
    const pz = Math.floor(this.player.pos.z);

    if (!this.player.collidesAt()) {
      // Only lift a brand new spawn onto the surface; a loaded save keeps the
      // exact position the player left (caves, flying, mountaintops, ...).
      if (this.freshSpawn) {
        const standing = this.clearSpawnHeight(px, pz);
        if (standing !== null && this.player.pos.y < standing) this.player.pos.y = standing;
      }
      return;
    }

    // Stuck in a tree or a wall: look for open ground nearby.
    for (let radius = 0; radius <= 8; radius++) {
      for (let dz = -radius; dz <= radius; dz++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== radius) continue;
          const x = px + dx;
          const z = pz + dz;
          const standing = this.clearSpawnHeight(x, z);
          if (standing === null) continue;
          this.player.pos.set(x + 0.5, standing, z + 0.5);
          if (!this.player.collidesAt()) {
            this.player.vel.set(0, 0, 0);
            return;
          }
        }
      }
    }

    // Last resort: rise until free.
    let guard = 0;
    while (this.player.collidesAt() && guard++ < 140) this.player.pos.y += 1;
  }

  debugText() {
    const p = this.player;
    if (!p) return '';
    const x = Math.floor(p.pos.x);
    const y = Math.floor(p.pos.y);
    const z = Math.floor(p.pos.z);
    const biome = this.world.generator.biomeAt(x, z);
    const hours = Math.floor(this.timeOfDay * 24);
    const minutes = Math.floor((this.timeOfDay * 24 - hours) * 60);
    const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const chunks = this.world.chunks.size;
    const target = this.target
      ? `looking at ${BLOCKS[this.target.id]?.name || '?'} @ ${this.target.x} ${this.target.y} ${this.target.z}`
      : 'looking at —';
    return [
      'Minecraft: JavaScript Edition',
      `FPS ${this.fps.toFixed(0)}  ·  frame ${this.frameMs.toFixed(1)}ms  ·  chunks ${chunks}`,
      `XYZ ${p.pos.x.toFixed(2)} / ${p.pos.y.toFixed(2)} / ${p.pos.z.toFixed(2)}`,
      `block ${x} ${y} ${z}  ·  chunk ${x >> 4} ${z >> 4}`,
      `biome ${biome}  ·  ${target}`,
      `time ${clock}  ·  ${p.flying ? 'flying' : p.inWater ? 'swimming' : p.onGround ? 'on ground' : 'airborne'}`,
      `edits ${this.world.editCount}  ·  seed ${this.world.seed}`,
      this.ui.isTouch ? 'touch mode' : 'mouse locked: ' + (this.input.locked ? 'yes' : 'no'),
    ].join('\n');
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function boot() {
  try {
    const canvas = document.getElementById('game-canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL is not available in this browser.');
    window.game = new Game();
  } catch (error) {
    console.error(error);
    const fatal = document.getElementById('fatal-screen');
    const message = document.getElementById('fatal-message');
    if (fatal && message) {
      message.textContent = error instanceof Error ? error.message : String(error);
      fatal.classList.remove('hidden');
      document.getElementById('loading-screen')?.classList.add('hidden');
      document.getElementById('title-screen')?.classList.add('hidden');
    }
  }
}

boot();
