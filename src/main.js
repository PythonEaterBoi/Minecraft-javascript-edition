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
import { MultiplayerSession } from './net/session.js';
import { RemotePlayers } from './net/remotes.js';
import { B, BLOCKS, DEFAULT_HOTBAR, isBlockItem } from './world/blocks.js';
import { CHUNK_HEIGHT, MAX_RENDER_DISTANCE } from './world/constants.js';
import { Inventory, makeStack, stacksEqual } from './items/inventory.js';
import { itemDef, itemName, itemStackSize } from './items/items.js';
import { I } from './items/ids.js';
import { RECIPES, canCraft, craft, recipeStates, smeltResult, fuelValue } from './items/recipes.js';
import { ITEM_LIST } from './items/items.js';
import { PICKABLE_BLOCKS } from './world/blocks.js';
import { discoverServers } from './net/session.js';
import { BlockEntities } from './world/blockentities.js';
import { MobManager, MOB_TYPES } from './entities/mobs.js';
import { Survival, MAX_HEALTH, MAX_HUNGER, MAX_AIR } from './player/survival.js';
import { getPBRMaps, getEnvironment } from './world/pbr.js';

const SAVE_KEY = 'mje.save.v1';
const SERVERS_KEY = 'mje.servers.v1';
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
    this.inventory = new Inventory(36);
    this.survival = new Survival();
    this.gamemode = 'survival';
    this.blockEntities = new BlockEntities();
    this.selected = 0;
    this.cursorStack = null;
    this.openContainer = null;
    this.mining = { x: 0, y: 0, z: 0, progress: 0, active: false };
    this.fallStart = null;
    this.hurtSoundTimer = 0;
    this.servers = this.loadServers();
    this.serverScan = [];
    this.scanning = false;
    this.mobAttackCooldown = 0;
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
    this.pendingJoin = false;
    this.noSave = false;
    this.net = null;
    this.mpRole = null;
    this.mpName = this.loadProfileName();
    this.mpSendTimer = 0;
    this.mpTimeTimer = 0;
    this.mpPeers = [];

    this.setupRenderer();
    this.setupScene();
    this.guide = new RemotePlayers(this.scene);
    this.mobs = new MobManager(this.scene);
    this.survival.onDamage = (amount, cause) => this.onPlayerDamage(amount, cause);
    this.survival.onDeath = (cause) => this.die(cause);
    this.setupInput();
    this.setupUI();
    this.setupMultiplayer();
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
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x9ec8e8, 1);
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 1000);
    this.camera.rotation.order = 'YXZ';

    this.atlas = getAtlas();
    this.materialSet = 'basic';
    this.materials = this.createMaterials(false);

    // Sun + sky light for the PBR materials. With the basic (fast) material set
    // these lights simply have no effect, so both paths share the same scene.
    this.sunLight = new THREE.DirectionalLight(0xfff4d6, 2.0);
    this.sunLight.position.set(60, 120, 40);
    this.scene.add(this.sunLight);
    this.hemiLight = new THREE.HemisphereLight(0xa9c7ea, 0x4a5a3a, 0.5);
    this.scene.add(this.hemiLight);
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(this.ambientLight);

    try {
      this.environment = getEnvironment(this.renderer);
      this.scene.environment = this.environment;
    } catch (error) {
      console.warn('Could not build the environment map', error);
      this.environment = null;
    }

    this.sky = new Sky(this.scene);
    this.remotePlayers = new RemotePlayers(this.scene);
  }

  /** Terrain materials. `pbr` switches to lit standard materials with maps. */
  createMaterials(pbr) {
    const map = this.atlas.texture;
    if (pbr) {
      const pbrMaps = getPBRMaps();
      const standard = (opts) =>
        new THREE.MeshStandardMaterial({
          map,
          normalMap: pbrMaps.normalMap,
          roughnessMap: pbrMaps.roughnessMap,
          metalnessMap: pbrMaps.metalnessMap,
          vertexColors: true,
          roughness: 1,
          metalness: 0.06,
          envMapIntensity: 0.32,
          normalScale: new THREE.Vector2(0.85, 0.85),
          ...opts,
        });
      return {
        opaque: standard({}),
        water: standard({
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          side: THREE.DoubleSide,
          roughness: 0.08,
          metalness: 0.25,
        }),
        glass: standard({ transparent: true, alphaTest: 0.02, roughness: 0.12, metalness: 0.1 }),
        plants: standard({ alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.95, metalness: 0 }),
      };
    }
    return {
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
        alphaTest: 0.02,
        fog: true,
      }),
      plants: new THREE.MeshBasicMaterial({
        map,
        vertexColors: true,
        transparent: true,
        alphaTest: 0.45,
        side: THREE.DoubleSide,
        fog: true,
        depthWrite: true,
      }),
    };
  }

  /** Swap the terrain material set (PBR <-> fast) on every loaded chunk. */
  setMaterialQuality(pbr) {
    const wanted = pbr ? 'pbr' : 'basic';
    if (this.materialSet === wanted && this.materials) return;
    this.materialSet = wanted;
    const old = this.materials;
    this.materials = this.createMaterials(pbr);
    if (this.world) {
      this.world.materials = this.materials;
      for (const chunk of this.world.chunks.values()) {
        for (const [slot, key] of [['mesh', 'opaque'], ['meshWater', 'water'], ['meshGlass', 'glass'], ['meshPlants', 'plants']]) {
          if (chunk[slot]) chunk[slot].material = this.materials[key];
        }
      }
    }
    for (const value of Object.values(old || {})) value?.dispose?.();
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
      onInvSlot: (payload) => this.handleInvSlot(payload),
      onCraft: (recipe) => this.craftRecipe(recipe),
      onCreativePick: (id) => this.creativePick(id),
      onRespawn: () => this.respawn(),
      onChatSubmit: (text) => this.submitChat(text),
      onServersOpen: () => this.openMultiplayerPanel({ serversTab: true }),
      onMpScan: () => this.scanServers(),
      onMpSaveServer: (name) => this.addServer(this.net?.room, name),
      onMpRemoveServer: (room) => this.removeServer(room),
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
    this.refreshHotbar();
    this.ui.setSurvival(this.survivalView());
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

    this.dimension = save?.dimension || 'overworld';
    this.realms = save?.realms || {};
    this.guide?.clear();
    this.world = new World({
      seed,
      scene: this.scene,
      materials: this.materials,
      renderDistance: this.settings.renderDistance,
    });

    this.world.generator.dimension = this.dimension;
    if (save && Array.isArray(save.edits)) this.world.loadEdits(save.edits);
    this.blockEntities = new BlockEntities();
    if (save) this.blockEntities.load(save.blockEntities);

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

    // Inventory, survival stats and game mode.
    this.inventory = new Inventory(36);
    this.survival.reset();
    this.survival.creative = false;
    this.gamemode = 'survival';
    if (save) {
      if (Array.isArray(save.inventory)) this.inventory.load(save.inventory);
      else if (Array.isArray(save.hotbar)) {
        // Save format 1: migrate the old creative hotbar into real stacks.
        save.hotbar.forEach((id, i) => {
          if (BLOCKS[id] && BLOCKS[id].pickable) this.inventory.set(i, makeStack(id, 64));
        });
      }
      this.survival.load(save.survival);
      if (save.gamemode === 'creative' || save.survival?.creative) this.gamemode = 'creative';
    } else if (!this.noSave) {
      // A brand-new survival world starts empty, like the real thing: punch a
      // tree, craft a table, then work towards a pickaxe. The opening hint in
      // `play()` tells the player that much.
      this.gamemode = 'survival';
    }
    this.survival.creative = this.gamemode === 'creative';
    if (this.gamemode === 'creative' && this.inventory.slots.every((slot) => !slot)) {
      DEFAULT_HOTBAR.forEach((id, i) => this.inventory.set(i, makeStack(id, 64)));
    }
    this.selected = save && Number.isInteger(save.selected) ? Math.max(0, Math.min(8, save.selected)) : 0;
    this.cursorStack = null;
    this.openContainer = null;
    this.mining = { x: 0, y: 0, z: 0, progress: 0, active: false };
    this.fallStart = null;
    this.mobs.setWorld(this.world);
    if (save && Array.isArray(save.mobs)) {
      for (const mob of save.mobs.slice(0, 24)) {
        if (MOB_TYPES[mob.type] && Number.isFinite(mob.x)) this.mobs.add(mob.type, mob.x, mob.y, mob.z);
      }
    }

    this.worldReady = false;
    this.spawnAdjusted = false;
    this.saveDirty = false;
    this.lastSave = performance.now();

    this.refreshHotbar();
    this.ui.setSeed(seed);
    this.ui.setSurvival(this.survivalView());
    this.ui.setMining(0);

    // Prime the camera so the very first frame is not at the origin.
    this.updateCamera(0, true);
  }

  get hotbar() {
    return this.inventory ? this.inventory.slots.slice(0, 9) : [];
  }

  heldStack() {
    return this.inventory ? this.inventory.get(this.selected) : null;
  }

  heldDef() {
    const stack = this.heldStack();
    return stack ? itemDef(stack.id) : null;
  }

  survivalView() {
    return {
      health: this.survival.health,
      hunger: this.survival.hunger,
      air: this.survival.air,
      creative: this.gamemode === 'creative',
    };
  }

  refreshHotbar() {
    if (!this.ui) return;
    this.ui.setHotbar(this.hotbar);
    this.ui.setSelectedSlot(this.selected);
    this.ui.setSurvival(this.survivalView());
  }

  startNewWorld(seedText) {
    const seed = seedFromString(seedText);
    if (this.net) this.disconnectSession();
    else this.saveGame();
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
    if (this.net) {
      this.leaveMultiplayer();
      return;
    }
    this.saveGame();
    this.state = 'title';
    this.ui.hidePause();
    this.ui.hideHud();
    this.ui.closeInventoryScreen();
    this.ui.closeDeath();
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
    this.refreshHotbar();
    this.ui.setSurvival(this.survivalView());
    if (!this.ui.isTouch) this.requestLockWithHint();
    else this.ui.toast('Drag to look · joystick to move', 3200);
    this.ui.setDebugVisible(this.ui.debugVisible);
    if (!this.startHintShown && this.gamemode === 'survival' && this.inventory.slots.every((slot) => !slot)) {
      this.startHintShown = true;
      this.ui.toast('Mine a tree for wood · E to craft · T for chat and commands', 5200);
    }
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

  openInventory(container = null) {
    if (this.state !== 'playing' || !this.player) return;
    this.state = 'inventory';
    this.input.enabled = false;
    this.input.exitLock();
    this.openContainer = container;
    this.cursorStack = null;
    this.ui.openInventoryScreen(this.inventoryView(container));
  }

  closeInventory() {
    if (this.state !== 'inventory') return;
    // Put anything still on the cursor back into the inventory.
    if (this.cursorStack) {
      const left = this.inventory.add(this.cursorStack.id, this.cursorStack.count);
      if (left > 0) {
        this.cursorStack.count = left;
        this.ui.toast('No room for that — find some space first', 2200);
        return;
      }
      this.cursorStack = null;
    }
    this.openContainer = null;
    this.ui.closeInventoryScreen();
    this.state = 'playing';
    this.input.enabled = true;
    this.ui.setSurvival(this.survivalView());
    this.refreshHotbar();
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
    this.setMaterialQuality(settings.pbr !== false);
    document.body.classList.toggle('vibrant', settings.vibrant !== false);
    document.body.classList.toggle('no-vibrance', settings.vibrant === false);
    if (settings.mobs === false) this.mobs?.clear();
    if (this.scene) {
      this.scene.environment = settings.pbr === false ? null : this.environment || null;
    }
  }


  /* ------------------------------------------------------------------ */
  /* Multiplayer                                                         */
  /* ------------------------------------------------------------------ */

  loadProfileName() {
    try {
      const stored = localStorage.getItem('mje.name.v1');
      if (stored && stored.trim()) return stored.trim().slice(0, 16);
    } catch {
      /* storage can be unavailable in private modes */
    }
    return `Player${Math.floor(10 + Math.random() * 90)}`;
  }

  setPlayerName(name) {
    const clean = String(name || '').trim().slice(0, 16);
    if (!clean) return;
    this.mpName = clean;
    try {
      localStorage.setItem('mje.name.v1', clean);
    } catch {
      /* ignore */
    }
    if (this.net) this.net.setName(clean);
  }

  setupMultiplayer() {
    this.ui.setCallbacks({
      onMpJoinRoom: (room, name) => this.joinLocalSession(room, name),
      onMpHost: (name) => this.createInvite(name),
      onMpAcceptAnswer: (code) => this.finishInvite(code),
      onMpJoinInvite: (code, name) => this.joinWithInvite(code, name),
      onMpLeave: () => this.leaveMultiplayer(),
      onMpName: (name) => this.setPlayerName(name),
      onMpOpen: () => this.openMultiplayerPanel(),
    });
  }

  openMultiplayerPanel(options = {}) {
    this.ui.openMultiplayer({
      name: this.mpName,
      room: this.net?.room || this.ui.mpView.room || 'coop',
      status: this.net ? this.net.statusText : 'Not connected',
      statusKind: this.net ? this.net.statusState : 'idle',
      players: this.mpPeers.map((peer) => peer.name),
      connected: !!this.net,
      serversTab: !!options.serversTab,
      servers: this.servers,
      discovered: this.serverScan,
      scanning: this.scanning,
      activeRoom: this.net?.room || '',
    });
  }

  createSession() {
    this.disconnectSession();
    const session = new MultiplayerSession({
      getWorldSnapshot: () => this.worldSnapshot(),
      onStatus: ({ state, text }) => this.ui.setMultiplayerStatus(state, text),
      onChat: (name, text) => this.ui.addChatMessage(`${name}: ${text}`, 'chat'),
      onBlockEntity: (message) => this.applyRemoteBlockEntity(message),
      onPeers: (peers) => {
        this.mpPeers = peers;
        this.ui.setMultiplayerPlayers(peers);
        this.ui.setMultiplayerHud(peers.length + 1);
      },
      onPeerJoin: (peer) => {
        this.remotePlayers.add(peer.id, peer.name);
        this.ui.toast(`${peer.name} joined`, 2600);
      },
      onPeerName: (peer) => this.remotePlayers.rename(peer.id, peer.name),
      onPeerLeave: (peer) => {
        this.remotePlayers.remove(peer.id);
        this.ui.toast(`${peer.name} left`, 2600);
      },
      onWorld: (snapshot) => this.adoptMultiplayerWorld(snapshot),
      onState: (id, state) => this.remotePlayers.setState(id, state),
      onEdit: (edit) => this.applyRemoteEdit(edit),
      onTime: (t) => {
        if (Number.isFinite(t)) this.timeOfDay = t;
      },
      onDisconnect: () => this.ui.toast('Your friend disconnected.', 4000),
    });
    this.net = session;
    return session;
  }

  disconnectSession() {
    if (!this.net) return;
    this.net.leave();
    this.net = null;
    this.mpRole = null;
    this.noSave = false;
    this.remotePlayers.clear();
    this.ui.setMultiplayerHud(0);
    this.ui.setMultiplayerPlayers([]);
  }

  joinLocalSession(room, name) {
    this.setPlayerName(name);
    const session = this.createSession();
    this.mpRole = 'local';
    this.noSave = true; // two tabs must not fight over the same save slot
    session.joinRoom(room || 'coop', this.mpName);
    this.ui.openMultiplayer({
      name: this.mpName,
      room: room || 'coop',
      status: session.statusText,
      statusKind: 'waiting',
      players: [],
      connected: true,
    });
  }

  async createInvite(name) {
    this.setPlayerName(name);
    const session = this.createSession();
    this.mpRole = 'host';
    this.noSave = true;
    try {
      const offer = await session.hostOffer(this.mpName);
      this.ui.updateMultiplayer({ offer, status: session.statusText, statusKind: 'waiting' });
      return offer;
    } catch {
      this.ui.setMultiplayerStatus('error', 'Could not create an invite in this browser.');
      return '';
    }
  }

  async finishInvite(code) {
    if (!this.net) return;
    try {
      await this.net.acceptAnswer(code);
      this.ui.setMultiplayerStatus('connecting', 'Connecting…');
    } catch {
      this.ui.setMultiplayerStatus('error', 'That answer code could not be read. Check you pasted all of it.');
    }
  }

  async joinWithInvite(code, name) {
    this.setPlayerName(name);
    const session = this.createSession();
    this.mpRole = 'guest';
    this.noSave = true;
    try {
      const answer = await session.acceptOffer(code, this.mpName);
      this.ui.updateMultiplayer({ answerOut: answer, status: session.statusText, statusKind: 'waiting' });
      return answer;
    } catch {
      this.ui.setMultiplayerStatus('error', 'That invite code could not be read. Check you pasted all of it.');
      return '';
    }
  }

  worldSnapshot() {
    if (!this.world || !this.player) return null;
    return {
      v: 1,
      dimension: this.dimension,
      seed: this.world.seed,
      time: this.timeOfDay,
      edits: this.world.serializeEdits(),
      player: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        z: this.player.pos.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
      },
      name: this.mpName,
      entities: this.blockEntities.serialize(),
      gamemode: this.gamemode,
    };
  }

  adoptMultiplayerWorld(snapshot) {
    if (!snapshot || !Number.isFinite(snapshot.seed)) return;
    this.mpRole = 'guest';
    this.noSave = true;
    this.ui.closeModal();
    this.ui.hideTitle();
    this.ui.hidePause();
    this.ui.hideHud();
    this.input.enabled = false;
    this.input.exitLock();
    this.remotePlayers.clear();

    this.timeOfDay = Number.isFinite(snapshot.time) ? snapshot.time : 0.38;
    this.state = 'loading';
    this.pendingJoin = true;
    this.createWorld(snapshot.seed, { dimension: snapshot.dimension });
    if (Array.isArray(snapshot.edits)) this.world.loadEdits(snapshot.edits);
    if (Array.isArray(snapshot.entities)) this.blockEntities.load(snapshot.entities);
    if (snapshot.gamemode === 'creative') this.setGamemode('creative');

    const spot = snapshot.player || {};
    this.player.teleportTo(
      Number.isFinite(spot.x) ? spot.x : 0.5,
      Number.isFinite(spot.y) ? spot.y + 0.05 : 70,
      Number.isFinite(spot.z) ? spot.z : 0.5,
    );
    this.player.yaw = Number.isFinite(spot.yaw) ? spot.yaw : 0;
    this.player.pitch = Number.isFinite(spot.pitch) ? spot.pitch : 0;
    this.freshSpawn = false;

    this.ui.showLoading('Joining world…');
    this.ui.setLoading(0.02, `seed ${snapshot.seed} · syncing blocks`);
    this.ui.setSeed(snapshot.seed);
    this.ui.toast(`Joining ${snapshot.name || 'your friend'}'s world…`, 3000);
  }

  applyRemoteBlockEntity(message) {
    if (!this.world || !message || !message.data) return;
    const { x, y, z, data } = message;
    if (![x, y, z].every(Number.isInteger)) return;
    const entity = this.blockEntities.create(x, y, z, data.type || 'chest');
    if (!entity) return;
    const unpack = (slot) =>
      Array.isArray(slot) && itemDef(slot[0]) ? { id: slot[0], count: slot[1] } : null;
    if (entity.type === 'chest') {
      const slots = Array.isArray(data.slots) ? data.slots.map(unpack) : [];
      for (let i = 0; i < 27; i++) entity.slots[i] = slots[i] || null;
    } else if (entity.type === 'furnace') {
      entity.input = unpack(data.input);
      entity.fuel = unpack(data.fuel);
      entity.output = unpack(data.output);
    }
    if (this.state === 'inventory' && this.openContainer) {
      this.ui.refreshInventoryScreen(this.inventoryView(this.openContainer));
    }
  }

  applyRemoteEdit(edit) {
    if (!this.world || !edit) return;
    const x = Math.round(edit.x);
    const y = Math.round(edit.y);
    const z = Math.round(edit.z);
    const id = edit.id;
    if (![x, y, z, id].every(Number.isInteger)) return;
    if (y < 0 || y >= CHUNK_HEIGHT || !BLOCKS[id]) return;
    if (this.world.getBlock(x, y, z) === id) return;
    if (this.world.setBlock(x, y, z, id)) {
      this.saveDirty = true;
      this.updateTarget();
    }
  }

  broadcastEdit(x, y, z, id) {
    this.net?.sendEdit({ x, y, z, id });
  }

  leaveMultiplayer() {
    if (!this.net) return;
    this.pendingJoin = false;
    this.ui.hideLoading();
    this.disconnectSession();
    this.ui.closeModal();
    this.ui.hideHud();
    this.ui.hidePause();
    this.input.enabled = false;
    this.input.exitLock();
    this.state = 'title';
    this.loadOrCreateWorld();
    this.ui.showTitle();
    this.ui.toast('Left the multiplayer session — your own world is back');
  }

  /* ------------------------------------------------------------------ */
  /* Chat, commands and servers                                           */
  /* ------------------------------------------------------------------ */

  loadServers() {
    try {
      const raw = localStorage.getItem(SERVERS_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter((s) => s && s.room) : [];
    } catch {
      return [];
    }
  }

  saveServers() {
    try {
      localStorage.setItem(SERVERS_KEY, JSON.stringify(this.servers.slice(0, 12)));
    } catch {
      /* ignore */
    }
  }

  addServer(room, name) {
    if (!room) return;
    const clean = String(name || room).slice(0, 20);
    if (this.servers.some((entry) => entry.room === room)) {
      this.ui.toast('That server is already saved', 1600);
      return;
    }
    this.servers.unshift({ room, name: clean });
    this.saveServers();
    this.ui.toast(`Saved server “${clean}”`, 1800);
    this.openMultiplayerPanel();
  }

  removeServer(room) {
    this.servers = this.servers.filter((entry) => entry.room !== room);
    this.saveServers();
    this.openMultiplayerPanel();
  }

  async scanServers() {
    if (this.scanning) return;
    this.scanning = true;
    this.openMultiplayerPanel();
    const found = await discoverServers(900);
    this.serverScan = found;
    this.scanning = false;
    this.openMultiplayerPanel();
    this.ui.addChatMessage(
      found.length ? `Found ${found.length} open server${found.length === 1 ? '' : 's'}.` : 'No open servers found in this browser.',
      'system',
    );
  }

  submitChat(text) {
    const line = String(text || '').trim();
    if (!line) return;
    if (line.startsWith('/')) {
      this.runCommand(line.slice(1));
      return;
    }
    this.ui.addChatMessage(`${this.mpName}: ${line}`, 'chat');
    if (this.net) this.net.sendChat(line);
    else if (this.settings.guide) {
      let reply = 'Ask me about food, crafting, or dimension travel.';
      if (/food|bread|hungry/i.test(line)) {
        if (performance.now() < (this.nextRation || 0)) reply = 'I need a minute to pack another ration.';
        else { this.collect(I.BREAD, 1); this.nextRation = performance.now() + 60000; reply = 'Here, take some bread.'; }
      } else if (/craft|wood/i.test(line)) reply = 'Punch a tree, then open E to turn logs into planks.';
      else if (/dimension|travel|boss/i.test(line)) reply = 'Try /dimension nether for the Ember Titan or /dimension end for the Void Warden.';
      this.ui.addChatMessage(`Scout: ${reply}`, 'chat');
    }
  }

  runCommand(input) {
    const parts = String(input || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return;
    const cmd = parts.shift().toLowerCase();
    const say = (text, kind = 'command') => this.ui.addChatMessage(text, kind);
    const fail = (text) => say(text, 'error');
    const num = (token, fallback = 0) => {
      if (token === undefined) return fallback;
      if (token.startsWith('~')) {
        const rel = Number(token.slice(1) || 0);
        return (this.player ? this.player.pos.y : 0) + rel;
      }
      const value = Number(token);
      return Number.isFinite(value) ? value : fallback;
    };
    const playerPos = this.player ? this.player.pos : { x: 0, y: 0, z: 0 };

    switch (cmd) {
      case 'dimension':
        say(this.travel(parts[0]));
        break;
      case 'help':
        say('/dimension overworld|nether|end · /summon titan|warden');
        say('/help · /gamemode <survival|creative> · /time set <day|night|noon|midnight|0-1>', 'system');
        say('/tp <x y z> · /give <item> [n] · /clear · /kill · /heal · /feed · /spawn', 'system');
        say('/seed · /summon <mob> · /setblock <x y z> <block> · /say <text> · /list', 'system');
        say('/mobs on|off · /pbr on|off · /vibrant on|off · /fly · /me <action>', 'system');
        break;
      case 'gamemode':
      case 'gm': {
        const mode = (parts[0] || '').toLowerCase();
        if (mode !== 'creative' && mode !== 'survival' && mode !== 'c' && mode !== 's') {
          fail('Usage: /gamemode <survival|creative>');
          break;
        }
        this.setGamemode(mode === 'creative' || mode === 'c' ? 'creative' : 'survival');
        break;
      }
      case 'time': {
        const action = (parts[0] || 'set').toLowerCase();
        const value = (parts[1] || '').toLowerCase();
        const presets = { day: 0.42, noon: 0.5, sunset: 0.75, night: 0.9, midnight: 0.0, sunrise: 0.25 };
        if (action === 'add' && Number.isFinite(Number(value))) {
          this.timeOfDay = (this.timeOfDay + Number(value)) % 1;
          say(`Time advanced by ${value}`);
        } else if (presets[value] !== undefined) {
          this.timeOfDay = presets[value];
          say(`Time set to ${value}`);
        } else if (Number.isFinite(Number(value))) {
          this.timeOfDay = ((Number(value) % 1) + 1) % 1;
          say(`Time set to ${this.timeOfDay.toFixed(2)}`);
        } else {
          fail('Usage: /time set <day|night|noon|midnight|0-1>');
          break;
        }
        this.saveDirty = true;
        break;
      }
      case 'tp':
      case 'teleport': {
        if (parts.length < 3) {
          fail('Usage: /tp <x> <y> <z>');
          break;
        }
        const x = num(parts[0], playerPos.x);
        const y = num(parts[1], playerPos.y);
        const z = num(parts[2], playerPos.z);
        this.player.teleportTo(x, y, z);
        say(`Teleported to ${x.toFixed(1)} ${y.toFixed(1)} ${z.toFixed(1)}`);
        break;
      }
      case 'give': {
        if (!parts.length) {
          fail('Usage: /give <item> [count]');
          break;
        }
        const id = this.findItemId(parts[0]);
        if (!id) {
          fail(`Unknown item “${parts[0]}”`);
          break;
        }
        const count = Math.max(1, Math.min(999, Number(parts[1]) || 1));
        const left = this.inventory.add(id, count);
        this.refreshHotbar();
        this.saveDirty = true;
        say(`Gave ${count - left} ${itemName(id)}${left ? ` (${left} did not fit)` : ''}`);
        break;
      }
      case 'clear':
        this.inventory.clear();
        this.refreshHotbar();
        say('Inventory cleared');
        break;
      case 'kill':
        this.survival.damage(999, 'damage');
        break;
      case 'heal':
        this.survival.health = MAX_HEALTH;
        this.survival.dead = false;
        this.ui.hideDeath();
        if (this.state === 'dead') this.respawn();
        this.ui.setSurvival(this.survivalView());
        say('Healed to full health');
        break;
      case 'feed':
        this.survival.hunger = MAX_HUNGER;
        this.survival.saturation = 10;
        this.ui.setSurvival(this.survivalView());
        say('Hunger restored');
        break;
      case 'spawn': {
        const spawn = this.world.findSpawn();
        this.player.teleportTo(spawn.x + 0.5, spawn.y, spawn.z + 0.5);
        say(`Teleported to spawn (${spawn.x} ${spawn.y} ${spawn.z})`);
        break;
      }
      case 'seed':
        say(`Seed: ${this.world.seed}`);
        break;
      case 'list': {
        const names = [this.mpName, ...this.mpPeers.map((peer) => peer.name)];
        say(`Players (${names.length}): ${names.join(', ')}`);
        break;
      }
      case 'summon': {
        const type = (parts[0] || 'pig').toLowerCase();
        if (!Object.hasOwn(MOB_TYPES, type)) {
          fail(`Unknown mob “${type}” (pig, cow, chicken, sheep, zombie, titan, warden)`);
          break;
        }
        const dir = this.player.getForward();
        const x = this.player.pos.x + dir.x * 3;
        const z = this.player.pos.z + dir.z * 3;
        const y = this.world.getHeight(Math.floor(x), Math.floor(z)) + 1;
        this.mobs.add(type, x, y, z);
        say(`Summoned a ${type}`);
        break;
      }
      case 'setblock': {
        if (parts.length < 4) {
          fail('Usage: /setblock <x> <y> <z> <block>');
          break;
        }
        const x = Math.floor(num(parts[0], playerPos.x));
        const y = Math.floor(num(parts[1], playerPos.y));
        const z = Math.floor(num(parts[2], playerPos.z));
        const id = this.findItemId(parts[3]);
        if (!this.world.setBlock(x, y, z, id)) {
          fail('Could not set that block (not loaded, or the same block)');
          break;
        }
        this.broadcastEdit(x, y, z, id);
        say(`Set ${itemName(id)} at ${x} ${y} ${z}`);
        break;
      }
      case 'say': {
        const text = parts.join(' ');
        if (!text) {
          fail('Usage: /say <text>');
          break;
        }
        this.ui.addChatMessage(`${this.mpName}: ${text}`, 'chat');
        this.net?.sendChat(text);
        break;
      }
      case 'me': {
        const text = parts.join(' ');
        if (!text) break;
        this.ui.addChatMessage(`* ${this.mpName} ${text}`, 'system');
        this.net?.sendChat(`* ${text}`);
        break;
      }
      case 'mobs':
        this.settings.mobs = (parts[0] || 'on').toLowerCase() !== 'off';
        this.ui.settings.mobs = this.settings.mobs;
        this.ui.saveSettings();
        if (!this.settings.mobs) this.mobs.clear();
        say(`Mobs ${this.settings.mobs ? 'enabled' : 'disabled'}`);
        break;
      case 'pbr':
        this.settings.pbr = (parts[0] || 'on').toLowerCase() !== 'off';
        this.ui.settings.pbr = this.settings.pbr;
        this.ui.saveSettings();
        this.setMaterialQuality(this.settings.pbr);
        say(`PBR materials ${this.settings.pbr ? 'on' : 'off'}`);
        break;
      case 'vibrant':
        this.settings.vibrant = (parts[0] || 'on').toLowerCase() !== 'off';
        this.ui.settings.vibrant = this.settings.vibrant;
        this.ui.saveSettings();
        this.applySettings(this.settings);
        say(`Vibrant visuals ${this.settings.vibrant ? 'on' : 'off'}`);
        break;
      case 'fly':
        this.player.flying = !this.player.flying;
        say(this.player.flying ? 'Flying' : 'Flight off');
        break;
      default:
        fail(`Unknown command “/${cmd}”. Try /help`);
    }
  }

  findItemId(query) {
    const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const alias = (value) => value.replace(/^wooden/, 'wood');
    const needle = norm(query);
    if (!needle) return 0;
    if (/^\d+$/.test(String(query).trim())) {
      const numeric = Number(query);
      return isBlockItem(numeric) || itemDef(numeric) ? numeric : 0;
    }
    const key = alias(needle);
    const entries = [
      ...PICKABLE_BLOCKS.map((block) => ({ id: block.id, name: block.name })),
      ...ITEM_LIST.map((item) => ({ id: item.id, name: item.name })),
    ];
    const keys = entries.map((entry) => {
      const full = norm(entry.name);
      return { entry, full, short: alias(full) };
    });
    const exact = keys.find((c) => c.full === needle || c.short === key);
    if (exact) return exact.entry.id;
    const loose = keys.find((c) => c.full.includes(needle) || c.short.includes(key));
    if (loose) return loose.entry.id;
    return 0;
  }

  setGamemode(mode) {
    this.gamemode = mode === 'creative' ? 'creative' : 'survival';
    if (this.gamemode === 'creative' && this.inventory.slots.every((slot) => !slot)) {
      DEFAULT_HOTBAR.forEach((id, i) => this.inventory.set(i, makeStack(id, 64)));
    }
    this.survival.creative = this.gamemode === 'creative';
    if (this.gamemode === 'creative') {
      this.player.flying = true;
    } else {
      this.player.flying = false;
    }
    this.refreshHotbar();
    this.ui.setSurvival(this.survivalView());
    this.ui.addChatMessage(`Game mode set to ${this.gamemode}`, 'system');
    this.saveDirty = true;
  }

  /* ------------------------------------------------------------------ */
  /* Inventory, crafting and containers                                  */
  /* ------------------------------------------------------------------ */

  nearCraftingTable() {
    if (!this.world || !this.player) return false;
    const px = Math.floor(this.player.pos.x);
    const py = Math.floor(this.player.pos.y);
    const pz = Math.floor(this.player.pos.z);
    for (let dy = -2; dy <= 2; dy++) {
      for (let dz = -4; dz <= 4; dz++) {
        for (let dx = -4; dx <= 4; dx++) {
          if (this.world.getBlock(px + dx, py + dy, pz + dz) === B.CRAFTING_TABLE) return true;
        }
      }
    }
    return false;
  }

  inventoryView(container) {
    const entity = container ? container.entity : null;
    const hasTable = this.gamemode === 'creative' || this.nearCraftingTable() || !!(container && container.crafting);
    const listMode = this.ui.invMode === 'blocks' && this.gamemode === 'creative' ? 'blocks' : 'recipes';
    return {
      title: entity ? (entity.type === 'furnace' ? 'Furnace' : 'Chest') : 'Inventory',
      inventory: this.inventory,
      entity,
      creative: this.gamemode === 'creative',
      hasTable,
      survival: this.survivalView(),
      cursor: this.cursorStack,
      listMode,
      recipes: recipeStates(this.inventory, hasTable),
    };
  }

  afterInventoryChange() {
    this.saveDirty = true;
    this.refreshHotbar();
    if (this.state === 'inventory') this.ui.refreshInventoryScreen(this.inventoryView(this.openContainer));
  }

  handleInvSlot({ kind, index, right, shift }) {
    const container = this.openContainer;
    const entity = container ? container.entity : null;
    if (kind === 'container' && entity) {
      const current = this.blockEntities.slot(entity, index);
      // Furnace output can only be taken out.
      if (entity.type === 'furnace' && index === 2 && this.cursorStack) return;
      if (shift && current) {
        const copy = { ...current };
        this.blockEntities.setSlot(entity, index, null);
        const left = this.inventory.add(copy.id, copy.count);
        if (left > 0) this.blockEntities.setSlot(entity, index, { ...copy, count: left });
      } else {
        this.cursorStack = this.blockEntities.click(entity, index, this.cursorStack, right);
      }
    } else if (kind === 'inv') {
      if (shift && entity && this.quickMove(index, entity)) {
        // moved into the container
      } else {
        this.cursorStack = this.inventory.click(index, this.cursorStack);
      }
    }
    if (entity) this.broadcastBlockEntity(container);
    this.afterInventoryChange();
  }

  /** Shift-click: push a whole inventory stack into the open container. */
  quickMove(invIndex, entity) {
    const stack = this.inventory.get(invIndex);
    if (!stack) return false;
    const isTool = !!itemDef(stack.id)?.durability;
    const merge = (target, setTarget) => {
      if (!target) {
        setTarget({ ...stack });
        this.inventory.set(invIndex, null);
        return true;
      }
      if (!isTool && target.id === stack.id) {
        const max = itemStackSize(stack.id);
        const take = Math.min(max - target.count, stack.count);
        if (take > 0) {
          target.count += take;
          stack.count -= take;
          if (stack.count <= 0) this.inventory.set(invIndex, null);
          return true;
        }
      }
      return false;
    };

    if (entity.type === 'chest') {
      for (let i = 0; i < 27; i++) {
        if (entity.slots[i] && merge(entity.slots[i], (next) => { entity.slots[i] = next; })) return true;
      }
      for (let i = 0; i < 27; i++) {
        if (!entity.slots[i]) {
          entity.slots[i] = { ...stack };
          this.inventory.set(invIndex, null);
          return true;
        }
      }
      return false;
    }

    // Furnace: smeltables to the input, fuels to the fuel slot.
    const smeltable = !!smeltResult(stack.id) || !!itemDef(stack.id)?.food;
    const targetIndex = smeltable ? 0 : 1;
    if (targetIndex === 1 && fuelValue(stack.id) <= 0) return false;
    const slot = this.blockEntities.slot(entity, targetIndex);
    if (!slot) {
      this.blockEntities.setSlot(entity, targetIndex, { ...stack, count: 1 });
      stack.count -= 1;
      if (stack.count <= 0) this.inventory.set(invIndex, null);
      return true;
    }
    if (slot.id === stack.id && slot.count < itemStackSize(slot.id)) {
      slot.count += 1;
      stack.count -= 1;
      if (stack.count <= 0) this.inventory.set(invIndex, null);
      return true;
    }
    return false;
  }

  craftRecipe(recipe) {
    const result = craft(this.inventory, recipe);
    if (!result || result.count <= 0) {
      this.ui.toast('Not enough materials', 1600);
      return;
    }
    const name = itemName(recipe.out);
    this.ui.toast(`Crafted ${name}${result.count > 1 ? ` ×${result.count}` : ''}`, 1600);
    this.sfx.placeBlock(recipe.out);
    this.afterInventoryChange();
  }

  creativePick(id) {
    const stack = makeStack(id, itemStackSize(id));
    if (!stack) return;
    if (this.cursorStack && stacksEqual(this.cursorStack, stack)) {
      this.afterInventoryChange();
      return;
    }
    if (!this.cursorStack) this.cursorStack = stack;
    else {
      const left = this.inventory.add(stack.id, stack.count);
      if (left === 0) this.ui.toast('Inventory full', 1400);
    }
    this.afterInventoryChange();
  }

  openBlockContainer(x, y, z) {
    const id = this.world.getBlock(x, y, z);
    const def = BLOCKS[id];
    if (!def || !def.container) return false;
    if (def.container === 'crafting') {
      this.openInventory(null);
      this.ui.toast('Crafting table: 3×3 recipes unlocked', 1800);
      return true;
    }
    const entity = this.blockEntities.create(x, y, z, def.container);
    this.openInventory({ entity, x, y, z });
    return true;
  }

  broadcastBlockEntity(container) {
    if (!this.net || !container || !container.entity) return;
    const entity = container.entity;
    const pack = (slot) => (slot ? [slot.id, slot.count] : null);
    this.net.sendBlockEntity?.({
      x: container.x,
      y: container.y,
      z: container.z,
      data:
        entity.type === 'chest'
          ? { type: 'chest', slots: entity.slots.map(pack) }
          : { type: 'furnace', input: pack(entity.input), fuel: pack(entity.fuel), output: pack(entity.output) },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Input handling                                                      */
  /* ------------------------------------------------------------------ */

  handleAction(type, event) {
    if (type === 'keyup') return;
    const code = event.code;
    if (this.ui.chatOpen) return;

    if (this.state === 'dead') {
      if (code === 'Enter' || code === 'Space') this.respawn();
      return;
    }

    // Keyboard-only menus: arrow keys move focus, Enter/Space activate.
    if (this.state !== 'playing' && this.ui.handleKeyNav(event)) return;

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
      } else if (code === 'KeyQ' && this.cursorStack) {
        this.cursorStack = null;
        this.afterInventoryChange();
      }
      return;
    }

    if (this.state === 'paused') {
      if (code === 'Escape') {
        event.preventDefault();
        this.resume();
      } else if ((code === 'Enter' || code === 'Space') && (!document.activeElement || document.activeElement === document.body)) {
        event.preventDefault();
        this.resume();
      }
      return;
    }

    if (this.state === 'title') {
      const focused = document.activeElement;
      if ((code === 'Enter' || code === 'Space') && this.worldReady && (!focused || focused === document.body)) {
        this.play();
      }
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
      case 'KeyV':
        event.preventDefault();
        this.attack();
        this.lastBreak = performance.now();
        break;
      case 'KeyB':
        event.preventDefault();
        this.useAction();
        this.lastPlace = performance.now();
        break;
      case 'KeyQ':
        event.preventDefault();
        this.dropHeld();
        break;
      case 'KeyT':
        event.preventDefault();
        this.ui.openChat('');
        break;
      case 'Slash':
        event.preventDefault();
        this.ui.openChat('/');
        break;
      case 'Enter':
        event.preventDefault();
        this.ui.openChat('');
        break;
      case 'F3':
        event.preventDefault();
        this.ui.toggleDebug();
        break;
      case 'F6':
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
    if (this.state !== 'playing') return;
    if (!this.input.locked && !this.ui.isTouch) return;
    if (button === 0) {
      if (pressed) {
        this.attack();
        this.lastBreak = performance.now();
      }
    } else if (button === 2) {
      if (pressed) {
        this.useAction();
        this.lastPlace = performance.now();
      }
    } else if (button === 1) {
      if (pressed) this.pickBlock();
    }
  }

  /** Q: throw one item out of the hotbar (it is simply gone for now). */
  dropHeld() {
    const stack = this.heldStack();
    if (!stack) return;
    const name = itemName(stack.id);
    stack.count -= 1;
    if (stack.count <= 0) this.inventory.set(this.selected, null);
    this.refreshHotbar();
    this.ui.toast(`Dropped ${name}`, 1200);
    this.saveDirty = true;
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
    if (!id) return;
    this.inventory.set(this.selected, makeStack(id, this.gamemode === 'creative' ? itemStackSize(id) : 1));
    this.refreshHotbar();
    this.saveDirty = true;
  }

  pickBlock() {
    if (!this.target) return;
    const id = this.target.id;
    const def = BLOCKS[id];
    if (!def || !def.pickable) return;
    if (this.gamemode === 'creative') {
      this.pickFromInventory(id);
      const existing = this.inventory.slots.findIndex((slot, i) => i < 9 && slot && slot.id === id);
      if (existing >= 0) this.selectSlot(existing);
      return;
    }
    const existing = this.inventory.slots.findIndex((slot, i) => i < 9 && slot && slot.id === id);
    if (existing >= 0) this.selectSlot(existing);
    else this.ui.toast(`${def.name} is not in your hotbar`, 1600);
  }

  toggleFly() {
    if (!this.player || this.state !== 'playing') return;
    if (this.gamemode !== 'creative' && !this.player.flying) {
      this.ui.toast('Flight is a creative-mode ability (/gamemode creative)', 2400);
      return;
    }
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
    const isTargetable = (id) => {
      if (id === B.AIR) return false;
      const def = BLOCKS[id];
      return !!def && !def.liquid;
    };
    this.target = raycast(this.world, origin, dir, REACH, isTargetable);
    if (this.target && this.target.distance > REACH - 0.9) this.target = null;
    if (this.state === 'playing' && this.target) {
      this.highlight.visible = true;
      this.highlight.position.set(this.target.x + 0.5, this.target.y + 0.5, this.target.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
  }

  /** How fast the held item mines this block. */
  miningSpeed(def) {
    if (this.gamemode === 'creative') return 30;
    const held = this.heldDef();
    if (def.tool === 'none') return 1;
    if (!held || held.kind !== 'tool') return 0.32;
    if (held.tool === def.tool) return held.speed;
    if (held.tool === 'sword') return 0.5;
    return 0.32;
  }

  canHarvest(def) {
    if (this.gamemode === 'creative') return true;
    if (!def.tier) return true;
    const held = this.heldDef();
    return !!held && held.kind === 'tool' && held.tool === def.tool && held.tier >= def.tier;
  }

  resetMining() {
    this.mining.active = false;
    this.mining.progress = 0;
    this.ui?.setMining(0);
  }

  updateMining(dt, active) {
    if (this.state !== 'playing' || !active || !this.target) {
      if (this.mining.active) this.resetMining();
      return;
    }
    const t = this.target;
    const def = BLOCKS[t.id];
    if (!def || def.hardness === Infinity) {
      this.resetMining();
      return;
    }
    if (!this.mining.active || this.mining.x !== t.x || this.mining.y !== t.y || this.mining.z !== t.z) {
      this.mining = { x: t.x, y: t.y, z: t.z, active: true, progress: 0 };
    }
    const speed = this.miningSpeed(def);
    this.mining.progress += (dt * speed) / Math.max(0.05, def.hardness);
    if (def.hardness === 0) this.mining.progress = 1;
    this.ui.setMining(this.gamemode === 'creative' ? 0 : this.mining.progress);
    if (this.mining.progress >= 1) {
      this.breakBlockNow(t);
      this.resetMining();
    }
  }

  attack() {
    if (this.state !== 'playing' || !this.player) return;
    const origin = this.player.eyePosition;
    const dir = this.player.getForward();
    const mobHit = this.mobs.raycast(origin, dir, REACH);
    const blockTarget = this.target;
    if (mobHit && (!blockTarget || mobHit.distance < blockTarget.distance + 0.3)) {
      if (this.mobAttackCooldown > 0) return;
      this.mobAttackCooldown = 0.42;
      const held = this.heldDef();
      let damage = held && held.kind === 'tool' ? held.damage : 1;
      if (this.gamemode === 'creative') damage = 40;
      this.ui.swingHand();
      this.sfx.placeBlock(0);
      const dead = this.mobs.damageMob(mobHit.mob, damage, this.player.pos, (id, count) => this.collect(id, count));
      if (dead) this.ui.addChatMessage(`Killed a ${mobHit.mob.def.name.toLowerCase()}`, 'system');
      if (!dead && mobHit.mob.def.boss) this.ui.toast(`${mobHit.mob.def.name} · ${mobHit.mob.hp}/${mobHit.mob.def.hp} HP`, 1000);
      if (held && held.durability) {
        if (this.inventory.damageTool(this.selected, 1)) this.ui.toast(`${held.name} broke!`, 1800);
        this.refreshHotbar();
      }
      return;
    }
    // Mining gets an immediate tick so a single click always shows progress.
    if (blockTarget) {
      const def = BLOCKS[blockTarget.id];
      if (def && def.hardness < 0.25) this.breakBlockNow(blockTarget);
    }
  }

  blockDrops(def) {
    const drops = [];
    if (def.drops) {
      for (const drop of def.drops) {
        if (Math.random() <= (drop.chance ?? 1)) drops.push({ id: drop.id, count: drop.count || 1 });
      }
      return drops;
    }
    if (def.drop) drops.push({ id: def.drop, count: 1 });
    return drops;
  }

  breakBlockNow(target) {
    const def = BLOCKS[target.id];
    if (!def) return;
    if (def.hardness === Infinity) {
      this.ui.toast('Bedrock is unbreakable');
      return;
    }
    const drops = this.canHarvest(def) ? this.blockDrops(def) : [];
    const entity = this.blockEntities.remove(target.x, target.y, target.z);
    if (entity) {
      for (const stack of this.blockEntities.contents(entity)) this.collect(stack.id, stack.count);
    }
    if (this.world.setBlock(target.x, target.y, target.z, B.AIR)) {
      this.sfx.breakBlock(target.id);
      this.ui.swingHand();
      this.broadcastEdit(target.x, target.y, target.z, B.AIR);
      for (const drop of drops) this.collect(drop.id, drop.count);
      const held = this.heldDef();
      if (held && held.durability && this.gamemode !== 'creative') {
        if (this.inventory.damageTool(this.selected, 1)) this.ui.toast(`${held.name} broke!`, 1800);
        this.refreshHotbar();
      }
      this.saveDirty = true;
      this.updateTarget();
    }
  }

  collect(id, count = 1) {
    if (!id || count <= 0) return;
    const added = this.inventory.add(id, count);
    if (added > 0) {
      const name = itemName(id);
      this.ui.toast(`+${added} ${name}`, 1400);
      this.refreshHotbar();
      this.saveDirty = true;
    }
  }

  /** Right click / B: use the held item, open a container or place a block. */
  useAction() {
    if (this.state !== 'playing' || !this.player) return;
    if (this.target) {
      const def = BLOCKS[this.target.id];
      if (def && def.container) {
        this.openBlockContainer(this.target.x, this.target.y, this.target.z);
        return;
      }
    }
    const stack = this.heldStack();
    const def = stack ? itemDef(stack.id) : null;
    if (def && def.kind === 'food') {
      this.eatHeld();
      return;
    }
    this.placeBlockFromHeld();
  }

  eatHeld() {
    const stack = this.heldStack();
    const def = stack ? itemDef(stack.id) : null;
    if (!def || def.kind !== 'food') return;
    if (this.survival.hunger >= MAX_HUNGER && !def.food.heal) {
      this.ui.toast('You are not hungry', 1400);
      return;
    }
    this.survival.feed(def.food.hunger, def.food.saturation);
    if (def.food.heal) this.survival.heal(def.food.heal);
    this.sfx.eat();
    this.ui.toast(`Ate ${def.name}`, 1200);
    if (this.gamemode !== 'creative') {
      this.inventory.remove(stack.id, 1);
      this.refreshHotbar();
    }
    this.ui.setSurvival(this.survivalView());
    this.saveDirty = true;
  }

  placeBlockFromHeld() {
    if (this.state !== 'playing' || !this.target) return;
    const stack = this.heldStack();
    if (!stack || !isBlockItem(stack.id)) {
      if (stack) this.ui.toast(`${itemName(stack.id)} cannot be placed`, 1400);
      return;
    }
    const id = stack.id;
    const { x, y, z, normal } = this.target;
    const px = x + normal.x;
    const py = y + normal.y;
    const pz = z + normal.z;
    if (py < 0 || py >= CHUNK_HEIGHT) return;
    const existing = this.world.getBlock(px, py, pz);
    if (existing !== B.AIR && !(BLOCKS[existing] && BLOCKS[existing].liquid)) return;
    if (BLOCKS[id].solid && this.player.intersectsBlock(px, py, pz)) return;
    if (this.world.setBlock(px, py, pz, id)) {
      this.sfx.placeBlock(id);
      this.ui.swingHand();
      this.saveDirty = true;
      this.broadcastEdit(px, py, pz, id);
      if (BLOCKS[id].container && BLOCKS[id].container !== 'crafting') {
        this.blockEntities.create(px, py, pz, BLOCKS[id].container);
      }
      if (this.gamemode !== 'creative') {
        stack.count -= 1;
        if (stack.count <= 0) this.inventory.set(this.selected, null);
        this.refreshHotbar();
      }
      this.updateTarget();
    }
  }

  placeBlock() {
    this.useAction();
  }

  breakBlock() {
    this.attack();
  }

  /* ------------------------------------------------------------------ */
  /* Survival: damage, death and respawn                                 */
  /* ------------------------------------------------------------------ */

  onPlayerDamage(amount, cause) {
    if (this.gamemode === 'creative') return;
    this.ui.flashDamage();
    this.ui.setSurvival(this.survivalView());
    this.sfx.hurt();
    if (this.hurtSoundTimer <= 0) this.hurtSoundTimer = 0.4;
  }

  die(cause) {
    if (this.state === 'dead') return;
    const causes = {
      fall: 'You hit the ground too hard.',
      drown: 'You ran out of air.',
      starve: 'You starved to death.',
      zombie: 'A zombie got you.',
      mob: 'A mob got you.',
      damage: 'You died.',
    };
    this.state = 'dead';
    this.input.enabled = false;
    this.input.exitLock();
    this.ui.showDeath(causes[cause] || causes.damage);
    this.ui.addChatMessage(`You died (${cause})`, 'error');
  }

  respawn() {
    if (!this.world || !this.player) return;
    const spawn = this.world.findSpawn();
    this.player.teleportTo(spawn.x + 0.5, spawn.y, spawn.z + 0.5);
    this.survival.reset();
    this.survival.creative = this.gamemode === 'creative';
    this.fallStart = null;
    this.ui.hideDeath();
    this.state = 'playing';
    this.input.enabled = true;
    this.ui.showHud();
    this.ui.setSurvival(this.survivalView());
    this.refreshHotbar();
    if (!this.ui.isTouch) this.requestLockWithHint();
    this.ui.toast('Respawned at the world spawn', 2200);
  }

  /* ------------------------------------------------------------------ */
  /* Save / load                                                         */
  /* ------------------------------------------------------------------ */

  captureWorld() {
    return {
      version: 3,
      dimension: this.dimension,
      realms: this.realms,
      savedAt: Date.now(),
      seed: this.world.seed,
      time: this.timeOfDay,
      gamemode: this.gamemode,
      player: {
        x: this.player.pos.x,
        y: this.player.pos.y,
        z: this.player.pos.z,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        flying: this.player.flying,
      },
      survival: this.survival.serialize(),
      inventory: this.inventory.serialize(),
      selected: this.selected,
      edits: this.world.serializeEdits(),
      blockEntities: this.blockEntities.serialize(),
      mobs: this.mobs.mobs.slice(0, 24).map((mob) => ({
        type: mob.type,
        x: mob.pos.x,
        y: mob.pos.y,
        z: mob.pos.z,
      })),
    };
  }

  travel(target) {
    if (this.net) return 'Dimension travel is single-player only.';
    if (!['overworld', 'nether', 'end'].includes(target)) return 'Usage: /dimension <overworld|nether|end>';
    if (target === this.dimension) return `Already in the ${target}.`;
    const data = this.captureWorld();
    const { player, edits, blockEntities, mobs } = data;
    data.realms[this.dimension] = { player, edits, blockEntities, mobs };
    Object.assign(data, { player: null, edits: [], blockEntities: [], mobs: [] }, data.realms[target]);
    delete data.realms[target];
    data.dimension = target;
    this.createWorld(data.seed, data);
    this.saveGame();
    return `Entered the ${target}.`;
  }

  saveGame(notify = false) {
    if (!this.world || !this.player) return;
    // Multiplayer worlds are temporary: never overwrite the single-player save.
    if (this.noSave) return;
    try {
      const data = this.captureWorld();
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

    // Look: mouse deltas when captured, plus the arrow keys at all times, so
    // the game is fully playable from the keyboard alone.
    if (playing && this.player) {
      const look = this.input.consumeLook();
      if (look.x || look.y) this.player.look(look.x, look.y);
      const keys = this.input.getLookKeys();
      if (keys.yaw || keys.pitch) {
        this.player.turn(keys.yaw * 2.3 * dt, keys.pitch * 1.6 * dt);
      }
    }

    // Movement.
    if (playing && this.player && this.worldReady) {
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

      // Mining, attacking and using.
      const now = performance.now();
      const mining = this.input.mouseDown.has(0) || this.input.isDown('KeyV');
      const using = this.input.mouseDown.has(2) || this.input.isDown('KeyB');
      if (mining && now - this.lastBreak > 190) {
        this.attack();
        this.lastBreak = now;
      }
      if (using && now - this.lastPlace > 190) {
        this.useAction();
        this.lastPlace = now;
      }

      this.updateTarget();
      this.updateMining(dt, mining);

      // Survival stats, falls, mobs and furnaces.
      this.survival.update(dt, {
        sprinting: this.player.sprinting,
        moving: Math.hypot(this.player.vel.x, this.player.vel.z) > 0.7,
        jumping: this.input.isDown('Space'),
        headInWater: this.player.headInWater,
      });

      if (this.gamemode !== 'creative' && !this.player.flying && !this.player.inWater) {
        if (!this.player.onGround) {
          this.fallStart = this.fallStart === null ? this.player.pos.y : Math.max(this.fallStart, this.player.pos.y);
        } else if (this.fallStart !== null) {
          this.survival.landed(this.fallStart - this.player.pos.y);
          this.fallStart = null;
        }
      } else {
        this.fallStart = null;
      }

      if (this.settings.guide && !this.net) {
        const { x, z } = this.player.pos;
        const y = this.world.getHeight(Math.floor(x + 3), Math.floor(z + 2));
        if (y >= 0) this.guide.setState('scout', { name: 'Scout', p: [x + 3, y + 1, z + 2], yaw: this.player.yaw });
        this.guide.update(dt, 0.9);
      } else if (this.guide.count) this.guide.clear();
      this.mobAttackCooldown = Math.max(0, this.mobAttackCooldown - dt);
      this.hurtSoundTimer = Math.max(0, this.hurtSoundTimer - dt);
      if (this.settings.mobs) {
        this.mobs.update(dt, this.world, this.player, {
          isNight: this.sky.dayFactor < 0.32,
          allowSpawn: true,
          onDamage: (amount, mob) => this.survival.damage(amount, mob.def.name.toLowerCase()),
          onDrop: (id, count) => this.collect(id, count),
        });
      } else if (this.mobs.mobs.length) {
        this.mobs.clear();
      }

      this.blockEntities.tick(dt, () => {
        if (this.state === 'inventory' && this.openContainer) {
          this.ui.refreshInventoryScreen(this.inventoryView(this.openContainer));
        }
      });

      this.hudTimer = (this.hudTimer || 0) + dt;
      if (this.hudTimer > 0.12) {
        this.hudTimer = 0;
        this.ui.setSurvival(this.survivalView());
      }

      if (this.net) {
        this.mpSendTimer += dt;
        if (this.mpSendTimer >= 0.09) {
          this.mpSendTimer = 0;
          this.net.sendState({
            p: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
            yaw: this.player.yaw,
            pitch: this.player.pitch,
            flying: this.player.flying,
          });
        }
        if (this.net.isAuthority()) {
          this.mpTimeTimer += dt;
          if (this.mpTimeTimer >= 5) {
            this.mpTimeTimer = 0;
            this.net.sendTime(this.timeOfDay);
          }
        }
      }
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

      if (this.pendingJoin) {
        const progress = this.world.getLoadProgress(this.player.pos.x, this.player.pos.z);
        this.ui.setLoading(Math.max(0.02, progress), `seed ${this.world.seed} · ${Math.round(progress * 100)}%`);
        if (progress >= 0.985) {
          this.pendingJoin = false;
          this.worldReady = true;
          this.freshSpawn = false;
          this.adjustSpawn();
          this.ui.hideLoading();
          this.state = 'playing';
          this.ui.showHud();
          this.input.enabled = true;
          this.ui.setPlayProgress(1);
          this.ui.toast('You are in the shared world — build together!', 3200);
          this.net?.sendState({
            p: [this.player.pos.x, this.player.pos.y, this.player.pos.z],
            yaw: this.player.yaw,
            pitch: this.player.pitch,
            flying: this.player.flying,
          });
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
    this.sky.mesh.visible = this.dimension === 'overworld';
    if (!this.sky.mesh.visible) {
      this.sky.clouds.visible = false;
      this.scene.fog.color.setHex(this.dimension === 'nether' ? 0x703426 : 0x24162e);
      this.scene.fog.near = 8;
    }
    if (underwater) {
      this.scene.fog.color.setHex(0x134a70);
      this.scene.fog.near = 0.1;
      this.scene.fog.far = 22;
    }
    const light = 0.34 + 0.66 * this.sky.dayFactor;
    const warm = this.sky.dayFactor;
    if (this.materialSet === 'basic') {
      this.materials.opaque.color.setRGB(light, light * (0.97 + 0.03 * warm), light * 0.98);
      this.materials.water.color.setRGB(light * 0.95, light * 0.98, light);
      this.materials.glass.color.setRGB(light, light, light);
      this.materials.plants.color.setRGB(light, light, light);
    } else {
      const day = this.sky.dayFactor;
      const sunDir = this.sky.sunDir;
      this.sunLight.position.set(sunDir.x * 120, Math.max(6, sunDir.y * 140), sunDir.z * 120);
      this.sunLight.intensity = 0.15 + day * 2.9;
      this.sunLight.color.setRGB(1, 0.94 + 0.05 * day, 0.84 + 0.14 * day);
      this.hemiLight.intensity = 0.22 + day * 1.05;
      this.hemiLight.color.setRGB(0.72 + 0.12 * day, 0.8 + 0.1 * day, 1);
      this.ambientLight.intensity = 0.12 + day * 0.3;
      this.renderer.toneMappingExposure = this.settings.vibrant ? 1.14 : 1.0;
    }
    this.remotePlayers.update(dt, light);
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
      `health ${this.survival.health.toFixed(0)}  ·  hunger ${this.survival.hunger.toFixed(0)}  ·  air ${this.survival.air.toFixed(0)}  ·  ${this.gamemode}`,
      `mobs ${this.mobs.mobs.length}  ·  containers ${this.blockEntities.map.size}  ·  ${this.materialSet} materials`,
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
