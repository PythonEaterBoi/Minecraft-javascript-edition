// All DOM UI: title/pause screens, hotbar, block picker, settings, controls,
// debug overlay, toasts and the mobile touch controls.

import { getBlockIcon } from '../world/atlas.js';
import { BLOCKS, PICKABLE_BLOCKS, B } from '../world/blocks.js';
import { getItemIcon } from '../items/icons.js';
import { itemDef, itemStackSize } from '../items/items.js';
import { MAX_HEALTH, MAX_HUNGER, MAX_AIR } from '../player/survival.js';

const SETTINGS_KEY = 'mje.settings.v1';

const DEFAULTS = {
  renderDistance: 7,
  sensitivity: 1,
  sound: true,
  clouds: true,
  dayCycle: true,
  pbr: true,
  vibrant: true,
  mobs: true,
  guide: false,
};

const HEART_SVG = (fill) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M8 14.2C2.2 10.2 0.4 7.4 0.4 4.7 0.4 2.2 2.2 0.4 4.6 0.4c1.4 0 2.7 0.7 3.4 1.8C8.7 1.1 10 0.4 11.4 0.4c2.4 0 4.2 1.8 4.2 4.3 0 2.7-1.8 5.5-7.6 9.5z" fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1"/></svg>`,
  )}`;
const HUNGER_SVG = (fill) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M10.4 1.6c2 0 3.6 1.7 3.6 3.9 0 2.4-1.7 4.2-4 4.2-1.4 0-2.6-0.7-3.2-1.8L3.2 11.4l1.6 1.6-1.4 1.4-1.6-1.6-0.7 0.7-1.2-1.2 6.6-6.6c-0.4-0.6-0.6-1.3-0.6-2C5.9 3 7.5 1.6 9.3 1.6z" fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1"/></svg>`,
  )}`;
const BUBBLE_SVG = (fill) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" fill="${fill}" stroke="rgba(0,0,0,0.45)" stroke-width="1"/><circle cx="5.6" cy="5.6" r="1.6" fill="rgba(255,255,255,0.75)"/></svg>`,
  )}`;

const SPLASHES = [
  'Now in JavaScript!',
  '100% Java-free!',
  'Infinite worlds!',
  'Punch trees!',
  'WebGL powered!',
  'Also on GitHub Pages!',
  'No install required!',
  'Made of triangles!',
  'Creepers not included!',
  'Runs in your browser!',
];

const CONTROLS = [
  [['W', 'A', 'S', 'D'], 'Move around'],
  [['Arrows'], 'Look around (keyboard)'],
  [['Mouse'], 'Look around (when captured)'],
  [['Left click'], 'Mine / attack (hold)'],
  [['Right click'], 'Place · eat · open chests and furnaces'],
  [['Middle click'], 'Pick the targeted block'],
  [['V'], 'Break block (keyboard) — tap or hold'],
  [['B'], 'Place · use (keyboard)'],
  [['E'], 'Inventory, crafting and containers'],
  [['T'], 'Open chat'],
  [['/'], 'Open the command line'],
  [['Q'], 'Drop the held item'],
  [['Space'], 'Jump · swim up'],
  [['Shift'], 'Sprint · descend while flying'],
  [['F'], 'Toggle flight'],
  [['1', '–', '9'], 'Select hotbar slot'],
  [['Wheel'], 'Cycle hotbar'],
  [['F6'], 'Pause / resume time'],
  [['F3'], 'Debug information'],
  [['Esc'], 'Pause game'],
  [['↑', '↓'], 'Move between menu buttons'],
  [['Enter'], 'Activate the focused button'],
];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

export class UI {
  constructor(canvas) {
    this.canvas = canvas;
    this.callbacks = {};
    this.isTouch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    this.settings = this.loadSettings();
    this.hotbarIds = [];
    this.selectedSlot = 0;
    this.modalOpen = false;
    this.inventoryOpen = false;
    this.debugVisible = false;
    this.titleVisible = true;
    this.touchMove = { x: 0, y: 0 };
    this.touchJump = false;
    this.touchDescend = false;
    this.lookTouchId = null;
    this.lastLookTouch = { x: 0, y: 0 };
    this.labelTimer = 0;
    this.toastTimer = 0;
    this.chatOpen = false;
    this.chatMessages = [];
    this.invView = null;
    this.cursorStack = null;
    this.invMode = 'recipes';
    this.invSearch = '';
    this.lastCursorEvent = { x: 0, y: 0 };
    this.playReady = false;
    this.mpKind = null;
    this.mpView = {
      name: '',
      room: 'coop',
      status: 'Not connected',
      statusKind: 'idle',
      players: [],
      offer: '',
      answer: '',
      invite: '',
      answerOut: '',
      connected: false,
      serversTab: false,
      servers: [],
      discovered: [],
      scanning: false,
      activeRoom: '',
    };

    this.el = {
      hud: document.getElementById('hud'),
      crosshair: document.getElementById('crosshair'),
      debug: document.getElementById('debug'),
      toast: document.getElementById('toast'),
      blockLabel: document.getElementById('block-label'),
      hotbar: document.getElementById('hotbar'),
      title: document.getElementById('title-screen'),
      splash: document.getElementById('splash-text'),
      seedTag: document.getElementById('seed-tag'),
      playBtn: document.getElementById('btn-play'),
      playSub: document.getElementById('play-sub'),
      pause: document.getElementById('pause-screen'),
      pauseMeta: document.getElementById('pause-meta'),
      modal: document.getElementById('modal'),
      modalTitle: document.getElementById('modal-title'),
      modalBody: document.getElementById('modal-body'),
      modalClose: document.getElementById('modal-close'),
      inventory: document.getElementById('inventory-screen'),
      inventoryTitle: document.getElementById('inventory-title'),
      inventoryMain: document.getElementById('inventory-main-grid'),
      inventoryHotbar: document.getElementById('inventory-hotbar-grid'),
      inventoryList: document.getElementById('inventory-list'),
      inventoryListTitle: document.getElementById('list-title'),
      inventorySearch: document.getElementById('list-search'),
      inventoryContainer: document.getElementById('inventory-container'),
      containerGrid: document.getElementById('container-grid'),
      containerLabel: document.getElementById('container-label'),
      furnaceInfo: document.getElementById('furnace-info'),
      furnaceBurn: document.getElementById('furnace-burn'),
      furnaceProgress: document.getElementById('furnace-progress'),
      inventoryCursor: document.getElementById('inventory-cursor'),
      inventoryMode: document.getElementById('inventory-mode'),
      inventoryStats: document.getElementById('inventory-stats'),
      tabRecipes: document.getElementById('tab-recipes'),
      tabBlocks: document.getElementById('tab-blocks'),
      tabCraft: document.getElementById('tab-craft'),
      healthRow: document.getElementById('health-row'),
      hungerRow: document.getElementById('hunger-row'),
      airRow: document.getElementById('air-row'),
      stats: document.getElementById('stats'),
      miningBar: document.getElementById('mining-bar'),
      miningFill: document.getElementById('mining-fill'),
      damageFlash: document.getElementById('damage-flash'),
      bossBar: document.getElementById('boss-bar'),
      bossName: document.getElementById('boss-name'),
      bossFill: document.getElementById('boss-fill'),
      portalOverlay: document.getElementById('portal-overlay'),
      loadingLabel: document.getElementById('loading-label'),
      death: document.getElementById('death-screen'),
      deathCause: document.getElementById('death-cause'),
      chat: document.getElementById('chat'),
      chatLog: document.getElementById('chat-log'),
      chatRow: document.getElementById('chat-input-row'),
      chatInput: document.getElementById('chat-input'),
      chatPrefix: document.getElementById('chat-prefix'),
      vibrance: document.getElementById('vibrance'),
      loading: document.getElementById('loading-screen'),
      loadingLabel: document.getElementById('loading-label'),
      loadingFill: document.getElementById('loading-fill'),
      loadingSub: document.getElementById('loading-sub'),
      fatal: document.getElementById('fatal-screen'),
      fatalMessage: document.getElementById('fatal-message'),
      mobile: document.getElementById('mobile-ui'),
      joystick: document.getElementById('joystick'),
      joystickKnob: document.getElementById('joystick-knob'),
      underwater: document.getElementById('underwater-overlay'),
      heldBlock: document.getElementById('held-block'),
      heldCanvas: document.getElementById('held-canvas'),
      inventoryClose: document.getElementById('inventory-close'),
      mpHud: document.getElementById('mp-hud'),
    };

    this.el.splash.textContent = SPLASHES[Math.floor(Math.random() * SPLASHES.length)];
    document.body.classList.toggle('touch', this.isTouch);
    this.bindEvents();
    this.initTouch();
  }

  setCallbacks(callbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /* ------------------------------------------------------------------ */
  /* Settings                                                            */
  /* ------------------------------------------------------------------ */

  loadSettings() {
    const defaults = { ...DEFAULTS, renderDistance: this.isTouch ? 5 : DEFAULTS.renderDistance };
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    return defaults;
  }

  saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* storage may be unavailable in private mode */
    }
  }

  getSettings() {
    return this.settings;
  }

  notifySettings() {
    this.saveSettings();
    if (this.callbacks.onSettingsChange) this.callbacks.onSettingsChange(this.settings);
  }

  /* ------------------------------------------------------------------ */
  /* Events                                                              */
  /* ------------------------------------------------------------------ */

  bindEvents() {
    const click = (id, fn) => {
      const node = document.getElementById(id);
      if (node) node.addEventListener('click', (event) => {
        event.preventDefault();
        this.callbacks.onUiSound?.();
        fn(event);
      });
    };

    click('btn-play', () => this.callbacks.onPlay?.());
    click('btn-new-world', () => this.openNewWorld());
    click('btn-title-settings', () => this.openSettings());
    click('btn-title-controls', () => this.openControls());
    click('btn-title-multiplayer', () => this.callbacks.onMpOpen?.());
    click('btn-pause-multiplayer', () => this.callbacks.onMpOpen?.());
    click('btn-title-servers', () => this.callbacks.onServersOpen?.());
    click('btn-pause-servers', () => this.callbacks.onServersOpen?.());
    click('tab-recipes', () => this.setInventoryMode('recipes'));
    click('tab-blocks', () => this.setInventoryMode('blocks'));
    click('tab-craft', () => this.setInventoryMode('craft'));
    click('btn-respawn', () => this.callbacks.onRespawn?.());
    click('btn-death-title', () => this.callbacks.onQuit?.());
    click('btn-resume', () => this.callbacks.onResume?.());
    click('btn-pause-settings', () => this.openSettings());
    click('btn-pause-controls', () => this.openControls());
    click('btn-save', () => this.callbacks.onSave?.());
    click('btn-quit', () => this.callbacks.onQuit?.());
    click('inventory-close', () => this.callbacks.onInventoryClose?.());
    click('modal-close', () => this.closeModal());

    this.el.modal.addEventListener('mousedown', (event) => {
      if (event.target === this.el.modal) this.closeModal();
    });

    // Inventory: track the mouse so the picked-up stack follows the cursor.
    document.addEventListener('mousemove', (event) => {
      this.lastCursorEvent = { x: event.clientX, y: event.clientY };
      this.positionCursor();
    });
    this.el.inventory.addEventListener('contextmenu', (event) => event.preventDefault());

    // Search boxes should not leak keystrokes into the game.
    this.el.inventorySearch.addEventListener('input', () => {
      this.invSearch = this.el.inventorySearch.value;
      this.renderInventoryList();
    });

    // Chat / command input.
    this.el.chatInput.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        this.closeChat();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        const text = this.el.chatInput.value;
        const prefix = this.el.chatPrefix.textContent;
        this.closeChat();
        this.callbacks.onChatSubmit?.(prefix + text);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* Screens                                                             */
  /* ------------------------------------------------------------------ */

  showTitle() {
    this.titleVisible = true;
    this.el.title.classList.remove('hidden');
    setTimeout(() => this.focusDefault(), 0);
  }

  hideTitle() {
    this.titleVisible = false;
    this.el.title.classList.add('hidden');
  }

  showPause(meta) {
    if (meta) this.el.pauseMeta.textContent = meta;
    this.el.pause.classList.remove('hidden');
    setTimeout(() => this.focusDefault(), 0);
  }

  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  showHud() {
    this.el.hud.classList.remove('hidden');
    if (this.isTouch) this.el.mobile.classList.remove('hidden');
  }

  hideHud() {
    this.el.hud.classList.add('hidden');
    this.el.mobile.classList.add('hidden');
  }

  setPlayProgress(progress, label) {
    const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
    this.playReady = pct >= 98;
    this.el.playBtn.disabled = !this.playReady;
    this.el.playSub.textContent = this.playReady ? label || 'click to play' : `${pct}% · generating world`;
    // When the world finishes loading, make Play the keyboard default again.
    if (this.playReady && this.titleVisible && !this.modalOpen) {
      const active = document.activeElement;
      if (!active || active === document.body || active.classList.contains('mc-button')) {
        this.el.playBtn.focus({ preventScroll: true });
      }
    }
  }

  setSeed(seed) {
    this.el.seedTag.textContent = `seed ${seed}`;
  }

  showLoading(label = 'Generating terrain…') {
    this.el.loading.classList.remove('hidden');
    this.setLoading(0, label);
  }

  setLoading(progress, sub) {
    this.el.loadingFill.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
    if (sub) this.el.loadingSub.textContent = sub;
  }

  hideLoading() {
    this.el.loading.classList.add('hidden');
  }

  showFatal(message) {
    this.el.fatalMessage.textContent = message;
    this.el.fatal.classList.remove('hidden');
    this.el.loading.classList.add('hidden');
    this.el.title.classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* Modal                                                               */
  /* ------------------------------------------------------------------ */

  openModal(title, contentBuilder) {
    // Hide whatever screen is behind the modal so its text does not ghost
    // through the translucent panel. Rebuilding a modal keeps the remembered
    // return screen instead of losing it.
    if (!this.modalReturn) {
      this.modalReturn = null;
      if (!this.el.pause.classList.contains('hidden')) {
        this.modalReturn = 'pause';
        this.el.pause.classList.add('hidden');
      } else if (!this.el.title.classList.contains('hidden')) {
        this.modalReturn = 'title';
        this.el.title.classList.add('hidden');
      }
    }
    this.el.modalTitle.textContent = title;
    this.el.modalBody.innerHTML = '';
    contentBuilder(this.el.modalBody);
    const firstOpen = !this.modalOpen;
    this.modalOpen = true;
    this.el.modal.classList.remove('hidden');
    this.el.modalBody.scrollTop = 0;
    if (firstOpen) setTimeout(() => this.focusDefault(), 0);
  }

  closeModal() {
    if (!this.modalOpen) return;
    this.modalOpen = false;
    this.mpKind = null;
    this.el.modal.classList.add('hidden');
    if (this.modalReturn === 'pause' && this.callbacks.isPaused?.() !== false) {
      this.el.pause.classList.remove('hidden');
      setTimeout(() => this.focusDefault(), 0);
    } else if (this.modalReturn === 'title') {
      this.el.title.classList.remove('hidden');
      setTimeout(() => this.focusDefault(), 0);
    }
    this.modalReturn = null;
  }

  openSettings() {
    this.mpKind = null;
    this.openModal('Settings', (body) => {
      const rows = [
        {
          key: 'renderDistance',
          title: 'Render distance',
          desc: 'Chunks drawn around you. Lower is faster.',
          type: 'range',
          min: 4,
          max: 10,
          step: 1,
          format: (v) => `${v} chunks`,
        },
        {
          key: 'sensitivity',
          title: 'Mouse sensitivity',
          desc: 'How far the camera turns.',
          type: 'range',
          min: 0.3,
          max: 2,
          step: 0.05,
          format: (v) => `${Number(v).toFixed(2)}×`,
        },
        { key: 'sound', title: 'Sound effects', desc: 'Procedural digging and placing sounds.', type: 'toggle' },
        { key: 'clouds', title: 'Clouds', desc: 'Drifting clouds above the world.', type: 'toggle' },
        { key: 'dayCycle', title: 'Day/night cycle', desc: 'Sunrises, sunsets and starry nights.', type: 'toggle' },
        { key: 'pbr', title: 'PBR materials', desc: 'Normal, roughness and metalness maps with sunlight.', type: 'toggle' },
        { key: 'vibrant', title: 'Vibrant visuals', desc: 'Saturated colour grading, sun glow and bloom.', type: 'toggle' },
        { key: 'guide', title: 'AI companion', desc: 'Scout follows you in solo play. Ask for food or advice in chat.', type: 'toggle' },
        { key: 'mobs', title: 'Mobs', desc: 'Animals and night-time zombies.', type: 'toggle' },
      ];

      for (const row of rows) {
        const wrap = el('div', 'setting-row');
        const label = el('div', 'label');
        label.append(el('b', null, row.title), el('span', null, row.desc));
        wrap.append(label);

        if (row.type === 'range') {
          const controls = el('div', 'seed-input-row');
          controls.style.margin = '0';
          controls.style.flex = '0 0 auto';
          controls.style.alignItems = 'center';
          controls.style.gap = '10px';

          const input = document.createElement('input');
          input.type = 'range';
          input.min = String(row.min);
          input.max = String(row.max);
          input.step = String(row.step);
          input.value = String(this.settings[row.key]);
          const value = el('div', 'value', row.format(this.settings[row.key]));

          input.addEventListener('input', () => {
            const v = Number(input.value);
            this.settings[row.key] = v;
            value.textContent = row.format(v);
            this.notifySettings();
          });
          controls.append(input, value);
          wrap.append(controls);
        } else {
          const toggle = el('button', `toggle${this.settings[row.key] ? ' on' : ''}`);
          toggle.type = 'button';
          toggle.setAttribute('aria-label', row.title);
          toggle.addEventListener('click', () => {
            this.settings[row.key] = !this.settings[row.key];
            toggle.classList.toggle('on', this.settings[row.key]);
            this.callbacks.onUiSound?.();
            this.notifySettings();
          });
          wrap.append(toggle);
        }
        body.append(wrap);
      }

      const note = el(
        'div',
        'controls-note',
        'Saved in your browser. Lower render distance means more FPS.',
      );
      body.append(note);
    });
  }

  openControls() {
    this.mpKind = null;
    this.openModal('Controls', (body) => {
      const grid = el('div', 'controls-grid');
      for (const [keys, action] of CONTROLS) {
        const keyWrap = el('div', 'keys');
        for (const part of keys) {
          if (part === '–' || part === '/') {
            keyWrap.append(el('span', 'key-sep', part));
          } else {
            keyWrap.append(el('kbd', null, part));
          }
        }
        grid.append(keyWrap, el('div', 'action', action));
      }
      body.append(grid);
      const note = el(
        'div',
        'controls-note',
        this.isTouch
          ? 'On touch devices: drag the screen to look, use the joystick to walk and the round buttons to jump, mine, place, fly and open the block picker.'
          : 'Tip: hold left or right click to keep breaking or placing blocks. Your world is saved automatically in this browser.',
      );
      body.append(note);
    });
  }

  openNewWorld() {
    this.mpKind = null;
    this.openModal('Create New World', (body) => {
      body.append(
        el(
          'p',
          null,
          'Type a seed to generate a new world. The same seed always recreates the same terrain. Your current build is saved separately and will be replaced.',
        ),
      );
      const row = el('div', 'seed-input-row');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Seed (e.g. 38, or any words)';
      input.value = String(this.callbacks.getSeed?.() ?? '38');
      input.maxLength = 40;
      const create = el('button', 'mc-button small primary', 'Create');
      create.type = 'button';
      create.style.minWidth = '110px';
      create.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        const raw = input.value.trim() || String(Math.floor(Math.random() * 1e9));
        this.closeModal();
        this.callbacks.onNewWorld?.(raw);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') create.click();
      });
      row.append(input, create);
      body.append(row);
      setTimeout(() => input.focus(), 50);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Keyboard navigation                                                 */
  /* ------------------------------------------------------------------ */

  activePanel() {
    if (this.modalOpen) return this.el.modal;
    if (this.inventoryOpen) return this.el.inventory;
    if (!this.el.pause.classList.contains('hidden')) return this.el.pause;
    if (!this.el.title.classList.contains('hidden')) return this.el.title;
    return null;
  }

  focusables() {
    const panel = this.activePanel();
    if (!panel) return [];
    return [...panel.querySelectorAll('button, input, textarea, [tabindex]')].filter(
      (node) => !node.disabled && node.getClientRects().length > 0,
    );
  }

  focusDefault() {
    if (!this.activePanel()) return;
    const items = this.focusables();
    const preferred = items.find((node) => node.classList.contains('primary')) || items[0];
    if (preferred) preferred.focus({ preventScroll: true });
  }

  moveFocus(delta) {
    const items = this.focusables();
    if (!items.length) return;
    const current = items.indexOf(document.activeElement);
    const index =
      current < 0 ? (delta > 0 ? 0 : items.length - 1) : (current + delta + items.length) % items.length;
    items[index].focus();
    this.callbacks.onUiSound?.();
  }

  /** Arrow-key menu navigation. Returns true when the key was consumed. */
  handleKeyNav(event) {
    if (!this.activePanel()) return false;
    const target = event.target;
    const tag = target && target.tagName;
    const isField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
    const isRange = tag === 'INPUT' && target.type === 'range';
    const isMultiline = tag === 'TEXTAREA';

    switch (event.code) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (isRange || isMultiline) return false;
        event.preventDefault();
        this.moveFocus(event.code === 'ArrowDown' ? 1 : -1);
        return true;
      }
      case 'ArrowRight':
      case 'ArrowLeft': {
        if (isField) return false;
        event.preventDefault();
        this.moveFocus(event.code === 'ArrowRight' ? 1 : -1);
        return true;
      }
      case 'Home':
      case 'End': {
        if (isField) return false;
        const items = this.focusables();
        if (!items.length) return false;
        event.preventDefault();
        (event.code === 'Home' ? items[0] : items[items.length - 1]).focus();
        return true;
      }
      default:
        return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Multiplayer                                                         */
  /* ------------------------------------------------------------------ */

  openMultiplayer(view = {}) {
    Object.assign(this.mpView, view);
    this.mpKind = 'multiplayer';
    this._buildMultiplayer();
  }

  updateMultiplayer(view = {}) {
    Object.assign(this.mpView, view);
    if (this.modalOpen && this.mpKind === 'multiplayer') this._buildMultiplayer();
  }

  setMultiplayerStatus(kind, text) {
    this.mpView.statusKind = kind;
    this.mpView.status = text;
    this.updateMultiplayer({});
  }

  setMultiplayerPlayers(players) {
    this.mpView.players = (players || []).map((peer) => peer.name || 'Player');
    this.updateMultiplayer({});
  }

  setMultiplayerHud(count) {
    if (!this.el.mpHud) return;
    this.el.mpHud.classList.toggle('hidden', count < 2);
    if (count >= 2) this.el.mpHud.textContent = `● ${count} players`;
  }

  _buildMultiplayer() {
    const view = this.mpView;
    this.openModal('Multiplayer', (body) => {
      this.mpKind = 'multiplayer';
      body.append(
        el('p', 'mp-intro', 'Play with someone else — no server, no account, no install.'),
      );

      const status = el('div', `mp-status ${view.statusKind || 'idle'}`, view.status || 'Not connected');
      status.setAttribute('role', 'status');
      body.append(status);

      if (view.players.length) {
        body.append(el('div', 'mp-players', `In this session: you, ${view.players.join(', ')}`));
      }

      // ---- Servers ----
      body.append(el('h3', 'mp-heading', 'Servers'));
      body.append(
        el(
          'p',
          'mp-hint',
          'Rooms open in another tab of this browser show up here. Save the ones you use often.',
        ),
      );
      const serverRow = el('div', 'mp-server-row');
      const scanBtn = el('button', 'mc-button small', view.scanning ? 'Scanning…' : 'Scan for servers');
      scanBtn.type = 'button';
      scanBtn.disabled = !!view.scanning;
      scanBtn.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        this.callbacks.onMpScan?.();
      });
      serverRow.append(scanBtn);
      if (view.connected && view.activeRoom) {
        const saveBtn = el('button', 'mc-button small', 'Save this room');
        saveBtn.type = 'button';
        saveBtn.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          this.callbacks.onMpSaveServer?.(view.activeRoom);
        });
        serverRow.append(saveBtn);
      }
      body.append(serverRow);

      const serverList = el('div', 'mp-server-list');
      for (const server of view.servers || []) {
        const row = el('div', 'mp-server');
        row.append(el('span', 'mp-server-name', server.name || server.room), el('span', 'mp-server-room', server.room));
        const join = el('button', 'mc-button tiny primary', 'Join');
        join.type = 'button';
        join.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          view.room = server.room;
          this.callbacks.onMpJoinRoom?.(server.room, view.name);
        });
        const remove = el('button', 'mc-button tiny danger', '✕');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${server.name || server.room}`);
        remove.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          this.callbacks.onMpRemoveServer?.(server.room);
        });
        row.append(join, remove);
        serverList.append(row);
      }
      for (const found of view.discovered || []) {
        if ((view.servers || []).some((entry) => entry.room === found.room)) continue;
        const row = el('div', 'mp-server discovered');
        row.append(
          el('span', 'mp-server-name', found.room),
          el('span', 'mp-server-room', `${found.players} player${found.players === 1 ? '' : 's'} · ${found.host}`),
        );
        const join = el('button', 'mc-button tiny primary', 'Join');
        join.type = 'button';
        join.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          view.room = found.room;
          this.callbacks.onMpJoinRoom?.(found.room, view.name);
        });
        row.append(join);
        serverList.append(row);
      }
      if (!serverList.childElementCount) {
        serverList.append(el('p', 'mp-hint', 'No saved servers yet. Join a room and press “Save this room”.'));
      }
      body.append(serverList);

      const nameRow = el('div', 'seed-input-row mp-row');
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 16;
      nameInput.placeholder = 'Your name';
      nameInput.value = view.name || '';
      nameInput.setAttribute('aria-label', 'Your player name');
      nameInput.addEventListener('input', () => {
        view.name = nameInput.value;
        this.callbacks.onMpName?.(nameInput.value);
      });
      nameRow.append(el('span', 'mp-label', 'Name'), nameInput);
      body.append(nameRow);

      body.append(el('h3', 'mp-heading', 'Same browser'));
      body.append(
        el(
          'p',
          'mp-hint',
          'Open this page in a second tab or window, join the same room there, and you will appear in each other’s worlds.',
        ),
      );
      const roomRow = el('div', 'seed-input-row mp-row');
      const roomInput = document.createElement('input');
      roomInput.type = 'text';
      roomInput.maxLength = 24;
      roomInput.value = view.room || 'coop';
      roomInput.setAttribute('aria-label', 'Room name');
      roomInput.addEventListener('input', () => {
        view.room = roomInput.value;
      });
      const joinBtn = el('button', 'mc-button small primary', 'Join room');
      joinBtn.type = 'button';
      joinBtn.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        view.room = roomInput.value.trim() || 'coop';
        this.callbacks.onMpJoinRoom?.(view.room, nameInput.value.trim());
      });
      roomRow.append(el('span', 'mp-label', 'Room'), roomInput, joinBtn);
      body.append(roomRow);

      body.append(el('h3', 'mp-heading', 'Invite a friend (peer-to-peer)'));
      body.append(
        el(
          'p',
          'mp-hint',
          'Works across the internet with no server: create an invite, send the code to your friend, then paste their answer back here.',
        ),
      );
      const hostBtn = el('button', 'mc-button small', 'Create invite code');
      hostBtn.type = 'button';
      hostBtn.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        this.callbacks.onMpHost?.(nameInput.value.trim());
      });
      body.append(hostBtn);

      if (view.offer) {
        body.append(el('span', 'mp-label', '1 · Send this invite code'));
        body.append(this._mpCode(view.offer));
        body.append(el('span', 'mp-label', '2 · Paste your friend’s answer code'));
        const answer = this._mpPaste(view.answer, 'Paste the answer code…', (value) => {
          view.answer = value;
        });
        const connect = el('button', 'mc-button small primary', 'Finish connection');
        connect.type = 'button';
        connect.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          this.callbacks.onMpAcceptAnswer?.(answer.value.trim());
        });
        body.append(answer, connect);
      }

      body.append(el('span', 'mp-label', 'Joining a friend? Paste their invite code'));
      const invite = this._mpPaste(view.invite, 'Paste the invite code…', (value) => {
        view.invite = value;
      });
      const answerBtn = el('button', 'mc-button small', 'Create answer code');
      answerBtn.type = 'button';
      answerBtn.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        view.invite = invite.value;
        this.callbacks.onMpJoinInvite?.(invite.value.trim(), nameInput.value.trim());
      });
      body.append(invite, answerBtn);

      if (view.answerOut) {
        body.append(el('span', 'mp-label', 'Send this answer code back to the host'));
        body.append(this._mpCode(view.answerOut));
      }

      if (view.connected || ['connected', 'waiting', 'connecting'].includes(view.statusKind)) {
        const leave = el('button', 'mc-button small danger', 'Leave session');
        leave.type = 'button';
        leave.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          this.callbacks.onMpLeave?.();
        });
        body.append(leave);
      }

      body.append(
        el(
          'div',
          'controls-note',
          'Multiplayer worlds are temporary: your single-player save is left untouched and comes back when you leave.',
        ),
      );
    });
  }

  _mpCode(value) {
    const wrap = el('div', 'mp-code-wrap');
    const area = document.createElement('textarea');
    area.className = 'mp-code';
    area.readOnly = true;
    area.rows = 3;
    area.spellcheck = false;
    area.value = value;
    area.addEventListener('focus', () => area.select());
    const copy = el('button', 'mc-button small', 'Copy');
    copy.type = 'button';
    copy.addEventListener('click', () => {
      area.select();
      const done = () => this.toast('Code copied');
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(value).then(done, () => done());
      else done();
    });
    wrap.append(area, copy);
    return wrap;
  }

  _mpPaste(value, placeholder, onChange) {
    const area = document.createElement('textarea');
    area.className = 'mp-code';
    area.rows = 3;
    area.spellcheck = false;
    area.placeholder = placeholder;
    area.value = value || '';
    area.addEventListener('input', () => onChange(area.value));
    return area;
  }

  /* ------------------------------------------------------------------ */
  /* In-game HUD                                                         */
  /* ------------------------------------------------------------------ */

  setHotbar(stacks) {
    this.hotbarStacks = Array.isArray(stacks) ? stacks.slice() : [];
    this.renderHotbar();
  }

  setSelectedSlot(index) {
    this.selectedSlot = index;
    this.renderHotbar();
    const stack = this.hotbarStacks ? this.hotbarStacks[index] : null;
    if (stack) {
      this.showBlockLabel(itemDef(stack.id)?.name || 'Item');
      this.updateHeldBlock(stack);
    } else {
      this.updateHeldBlock(null);
    }
  }

  updateHeldBlock(stack) {
    const canvas = this.el.heldCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 128, 128);
    this.el.heldBlock.classList.toggle('empty', !stack);
    if (!stack) return;
    const icon = getItemIcon(stack.id, 128);
    if (icon) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(icon, 0, 0, 128, 128);
    }
  }

  swingHand() {
    const node = this.el.heldBlock;
    if (!node) return;
    node.classList.remove('swing');
    void node.offsetWidth;
    node.classList.add('swing');
    setTimeout(() => node.classList.remove('swing'), 240);
  }

  renderHotbar() {
    const bar = this.el.hotbar;
    if (!bar) return;
    bar.innerHTML = '';
    const slots = this.hotbarStacks || [];
    for (let i = 0; i < 9; i++) {
      const stack = slots[i] || null;
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = `hotbar-slot${i === this.selectedSlot ? ' selected' : ''}`;
      slot.dataset.index = String(i);
      const def = stack ? itemDef(stack.id) : null;
      slot.title = def ? def.name : 'Empty';
      slot.setAttribute('aria-label', `Slot ${i + 1}${def ? `: ${def.name}` : ''}`);
      if (stack) {
        const icon = getItemIcon(stack.id, 64);
        if (icon) {
          const canvas = document.createElement('canvas');
          canvas.width = 64;
          canvas.height = 64;
          canvas.getContext('2d').drawImage(icon, 0, 0);
          slot.append(canvas);
        }
        if (stack.count > 1) slot.append(el('span', 'slot-count', String(stack.count)));
        if (def && def.durability) {
          const bar = el('span', 'slot-durability');
          const fill = el('i');
          fill.style.width = `${Math.max(0, Math.min(1, (stack.dur ?? def.durability) / def.durability)) * 100}%`;
          bar.append(fill);
          slot.append(bar);
        }
      }
      slot.append(el('span', 'index', String(i + 1)));
      slot.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSelectSlot?.(i);
      });
      bar.append(slot);
    }
  }

  showBlockLabel(name) {
    this.el.blockLabel.textContent = name;
    this.el.blockLabel.classList.add('visible');
    clearTimeout(this.labelTimer);
    this.labelTimer = setTimeout(() => this.el.blockLabel.classList.remove('visible'), 1500);
  }

  toast(text, duration = 2200) {
    this.el.toast.textContent = text;
    this.el.toast.classList.remove('hidden');
    this.el.toast.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.el.toast.classList.remove('visible');
      setTimeout(() => this.el.toast.classList.add('hidden'), 300);
    }, duration);
  }

  setDebugVisible(visible) {
    this.debugVisible = visible;
    this.el.debug.classList.toggle('hidden', !visible);
  }

  toggleDebug() {
    this.setDebugVisible(!this.debugVisible);
  }

  setDebug(text) {
    if (this.debugVisible) this.el.debug.textContent = text;
  }

  /** Boss health bar at the top of the screen; pass null to hide it. */
  setBossBar(info) {
    const bar = this.el.bossBar;
    if (!bar) return;
    const key = info ? `${info.name}:${Math.ceil(info.hp)}` : '';
    if (key === this.bossKey) return;
    this.bossKey = key;
    bar.classList.toggle('hidden', !info);
    if (!info) return;
    bar.dataset.boss = info.type || '';
    this.el.bossName.textContent = `${info.name} · ${Math.max(0, Math.ceil(info.hp))} / ${info.max}`;
    this.el.bossFill.style.width = `${Math.max(0, Math.min(1, info.hp / info.max)) * 100}%`;
  }

  /** Purple swirl that builds up while standing in a portal (0..1). */
  setPortalCharge(amount, kind = 'nether') {
    const node = this.el.portalOverlay;
    if (!node) return;
    node.style.opacity = String(Math.min(0.85, amount * 0.85));
    node.dataset.kind = kind;
  }

  /** Override the loading-screen heading (null restores the default). */
  setLoadingTitle(text) {
    if (!this.el.loadingLabel) return;
    this.el.loadingLabel.textContent = text || 'Generating terrain…';
  }

  setUnderwater(active) {
    this.el.underwater.classList.toggle('active', active);
  }

  /* ------------------------------------------------------------------ */
  /* Survival HUD                                                        */
  /* ------------------------------------------------------------------ */

  setSurvival({ health, hunger, air, creative }) {
    this.survival = { health, hunger, air, creative };
    const bar = (row, count, svg, value, max, cls) => {
      if (!row) return;
      row.innerHTML = '';
      const icons = Math.ceil(count);
      for (let i = 0; i < icons; i++) {
        const unit = max / count;
        const remain = value - i * unit;
        const fill = remain >= unit * 0.95 ? 1 : remain <= 0 ? 0 : 0.5;
        const icon = el('i', `hud-icon ${cls} ${fill === 1 ? 'full' : fill === 0 ? 'empty' : 'half'}`);
        icon.style.setProperty('--icon', `url("${svg}")`);
        row.append(icon);
      }
      row.classList.toggle('hidden', creative);
    };
    bar(this.el.healthRow, 10, HEART_SVG('__FILL__'), health, MAX_HEALTH, 'heart');
    bar(this.el.hungerRow, 10, HUNGER_SVG('__FILL__'), hunger, MAX_HUNGER, 'hunger');
    const airIcons = Math.ceil(MAX_AIR);
    if (this.el.airRow) {
      this.el.airRow.innerHTML = '';
      if (!creative && air < MAX_AIR) {
        for (let i = 0; i < airIcons; i++) {
          const icon = el('i', `hud-icon bubble ${i < Math.ceil(air) ? 'full' : 'empty'}`);
          icon.style.setProperty('--icon', `url("${BUBBLE_SVG('#6fd8ff')}")`);
          this.el.airRow.append(icon);
        }
      }
    }
    // Colour the icon fills (red hearts, golden hunger).
    for (const node of this.el.healthRow?.children || []) {
      node.style.setProperty('--icon', `url("${HEART_SVG('#e03a3a')}")`);
      if (node.classList.contains('empty')) node.style.setProperty('--icon', `url("${HEART_SVG('rgba(40,10,10,0.55)')}")`);
    }
    for (const node of this.el.hungerRow?.children || []) {
      node.style.setProperty('--icon', `url("${HUNGER_SVG('#d99a2b')}")`);
      if (node.classList.contains('empty')) node.style.setProperty('--icon', `url("${HUNGER_SVG('rgba(40,25,10,0.55)')}")`);
    }
    this.el.stats?.classList.toggle('creative', !!creative);
  }

  setMining(progress) {
    if (!this.el.miningBar) return;
    const active = progress > 0.001 && progress < 1;
    this.el.miningBar.classList.toggle('hidden', !active);
    if (active) this.el.miningFill.style.width = `${Math.min(100, progress * 100)}%`;
  }

  flashDamage() {
    const node = this.el.damageFlash;
    if (!node) return;
    node.classList.remove('active');
    void node.offsetWidth;
    node.classList.add('active');
  }

  showDeath(cause) {
    if (this.el.deathCause) this.el.deathCause.textContent = cause || 'You ran out of health.';
    this.el.death?.classList.remove('hidden');
    document.body.classList.add('dead');
    setTimeout(() => document.getElementById('btn-respawn')?.focus({ preventScroll: true }), 0);
  }

  hideDeath() {
    this.el.death?.classList.add('hidden');
    document.body.classList.remove('dead');
  }

  closeDeath() {
    this.hideDeath();
  }

  /* ------------------------------------------------------------------ */
  /* Chat and commands                                                   */
  /* ------------------------------------------------------------------ */

  addChatMessage(text, kind = 'chat') {
    this.chatMessages.push({ text, kind, at: Date.now() });
    if (this.chatMessages.length > 60) this.chatMessages.shift();
    const line = el('div', `chat-line ${kind}`, text);
    this.el.chatLog.append(line);
    while (this.el.chatLog.childElementCount > 12) this.el.chatLog.firstElementChild.remove();
    this.el.chat.classList.add('active');
    clearTimeout(this.chatFadeTimer);
    this.chatFadeTimer = setTimeout(() => {
      if (!this.chatOpen) this.el.chat.classList.remove('active');
    }, 9000);
    this.el.chatLog.scrollTop = this.el.chatLog.scrollHeight;
  }

  openChat(prefix = '') {
    this.chatOpen = true;
    this.el.chat.classList.add('active');
    this.el.chatRow.classList.remove('hidden');
    this.el.chatPrefix.textContent = prefix;
    this.el.chatInput.value = '';
    setTimeout(() => this.el.chatInput.focus({ preventScroll: true }), 0);
  }

  closeChat() {
    this.chatOpen = false;
    this.el.chatRow.classList.add('hidden');
    this.el.chatInput.blur();
    this.el.chat.classList.remove('active');
  }

  /* ------------------------------------------------------------------ */
  /* Inventory and containers                                            */
  /* ------------------------------------------------------------------ */

  openInventoryScreen(view) {
    this.invView = view;
    this.inventoryOpen = true;
    this.invMode = view.listMode || 'recipes';
    this.invSearch = '';
    if (this.el.inventorySearch) this.el.inventorySearch.value = '';
    this.el.inventory.classList.remove('hidden');
    this.el.inventoryTitle.textContent = view.title || 'Inventory';
    this.el.tabBlocks.classList.toggle('hidden', !view.creative);
    this.refreshInventoryScreen(view);
    setTimeout(() => {
      const first = this.el.inventoryMain.querySelector('.slot');
      if (first) first.focus({ preventScroll: true });
    }, 0);
  }

  refreshInventoryScreen(view) {
    if (view) this.invView = view;
    const v = this.invView;
    if (!v || !this.inventoryOpen) return;
    this.cursorStack = v.cursor || null;

    // Container part.
    const hasContainer = !!v.entity;
    this.el.inventoryContainer.classList.toggle('hidden', !hasContainer);
    if (hasContainer) {
      const isFurnace = v.entity.type === 'furnace';
      this.el.containerLabel.textContent = isFurnace ? 'Furnace' : 'Chest';
      const count = isFurnace ? 3 : 27;
      this.renderSlots(this.el.containerGrid, count, (i) => this.containerStack(i), 'container', {
        rows: isFurnace ? 1 : 3,
      });
      this.el.furnaceInfo.classList.toggle('hidden', !isFurnace);
      if (isFurnace) {
        const burn = v.entity.burnMax ? Math.min(1, v.entity.burn / v.entity.burnMax) : 0;
        this.el.furnaceBurn.style.height = `${burn * 100}%`;
        this.el.furnaceProgress.style.width = `${Math.min(1, (v.entity.progress || 0) / 9) * 100}%`;
      }
    }

    // Player inventory.
    this.renderSlots(this.el.inventoryMain, 27, (i) => this.invStack(i + 9), 'inv', { rows: 3 });
    this.renderSlots(this.el.inventoryHotbar, 9, (i) => this.invStack(i), 'inv', { rows: 1, hotbar: true });

    this.el.inventoryMode.textContent = v.creative ? '· creative' : '';
    if (this.el.inventoryStats) {
      const s = v.survival;
      this.el.inventoryStats.textContent = s
        ? `Health ${Math.ceil(s.health)}/20 · Hunger ${Math.ceil(s.hunger)}/20${s.creative ? ' · creative mode' : ''}`
        : '';
    }

    this.el.tabRecipes.classList.toggle('active', this.invMode === 'recipes');
    this.el.tabBlocks.classList.toggle('active', this.invMode === 'blocks');
    this.el.inventorySearch.classList.toggle('hidden', this.invMode !== 'blocks');
    this.renderInventoryList();
    this.renderCursor();
  }

  containerStack(index) {
    const entity = this.invView?.entity;
    if (!entity) return null;
    if (entity.type === 'chest') return entity.slots[index] || null;
    if (index === 0) return entity.input || null;
    if (index === 1) return entity.fuel || null;
    if (index === 2) return entity.output || null;
    return null;
  }

  invStack(index) {
    const inv = this.invView?.inventory;
    return inv ? inv.slots[index] || null : null;
  }

  renderSlots(grid, count, getStack, kind, opts = {}) {
    if (!grid) return;
    grid.innerHTML = '';
    grid.style.setProperty('--cols', String(opts.hotbar ? 9 : 9));
    for (let i = 0; i < count; i++) {
      const stack = getStack(i);
      const button = this.makeSlot(stack, kind, i);
      grid.append(button);
    }
  }

  makeSlot(stack, kind, index) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'slot';
    const def = stack ? itemDef(stack.id) : null;
    button.title = def ? `${def.name}${stack.count > 1 ? ` ×${stack.count}` : ''}` : 'Empty';
    button.dataset.kind = kind;
    button.dataset.index = String(index);
    if (stack) {
      const icon = getItemIcon(stack.id, 48);
      if (icon) {
        const canvas = document.createElement('canvas');
        canvas.width = 48;
        canvas.height = 48;
        canvas.getContext('2d').drawImage(icon, 0, 0);
        button.append(canvas);
      }
      if (stack.count > 1) button.append(el('span', 'slot-count', String(stack.count)));
      if (def && def.durability) {
        const bar = el('span', 'slot-durability');
        const fill = el('i');
        fill.style.width = `${Math.max(0, Math.min(1, (stack.dur ?? def.durability) / def.durability)) * 100}%`;
        bar.append(fill);
        button.append(bar);
      }
    }
    button.addEventListener('click', (event) => {
      event.preventDefault();
      this.callbacks.onUiSound?.();
      this.callbacks.onInvSlot?.({ kind, index, right: false, shift: event.shiftKey });
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      this.callbacks.onInvSlot?.({ kind, index, right: true, shift: event.shiftKey });
    });
    return button;
  }

  renderInventoryList() {
    const list = this.el.inventoryList;
    if (!list || !this.invView) return;
    list.innerHTML = '';
    if (this.invMode === 'blocks') {
      this.el.inventoryListTitle.textContent = 'Blocks';
      const query = this.invSearch.trim().toLowerCase();
      for (const block of PICKABLE_BLOCKS) {
        if (query && !block.name.toLowerCase().includes(query)) continue;
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'list-row';
        const icon = getBlockIcon(block.id, 40);
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        canvas.getContext('2d').drawImage(icon, 0, 0);
        row.append(canvas, el('span', 'list-name', block.name));
        row.addEventListener('click', () => {
          this.callbacks.onUiSound?.();
          this.callbacks.onCreativePick?.(block.id);
        });
        list.append(row);
      }
      if (!list.childElementCount) list.append(el('p', 'list-empty', 'No blocks match that search.'));
      return;
    }

    this.el.inventoryListTitle.textContent = 'Crafting';
    const recipes = this.invView.recipes || [];
    let shown = 0;
    for (const entry of recipes) {
      const { recipe, available, blocked } = entry;
      const def = itemDef(recipe.out);
      if (!def) continue;
      const row = document.createElement('button');
      row.type = 'button';
      row.className = `list-row recipe${available ? '' : ' disabled'}${blocked ? ' blocked' : ''}`;
      row.disabled = !available;
      const icon = getItemIcon(recipe.out, 40);
      const canvas = document.createElement('canvas');
      canvas.width = 40;
      canvas.height = 40;
      if (icon) canvas.getContext('2d').drawImage(icon, 0, 0);
      row.append(canvas);
      const text = el('span', 'recipe-text');
      text.append(el('span', 'list-name', `${def.name}${recipe.count > 1 ? ` ×${recipe.count}` : ''}`));
      const ingredients = el('span', 'recipe-ingredients');
      for (const [id, count] of recipe.in) {
        const ing = itemDef(id);
        const have = this.invView.inventory.count(id);
        ingredients.append(el('span', `ingredient${have >= count ? '' : ' missing'}`, `${ing ? ing.name : '?'} ${have}/${count}`));
      }
      if (blocked) ingredients.append(el('span', 'ingredient missing', 'needs a crafting table'));
      text.append(ingredients);
      row.append(text);
      row.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        this.callbacks.onCraft?.(recipe);
      });
      list.append(row);
      shown++;
    }
    if (!shown) list.append(el('p', 'list-empty', 'Nothing craftable yet — punch a tree!'));
  }

  setInventoryMode(mode) {
    this.invMode = mode;
    this.refreshInventoryScreen();
  }

  renderCursor() {
    const node = this.el.inventoryCursor;
    if (!node) return;
    const stack = this.cursorStack;
    if (!stack) {
      node.classList.add('hidden');
      node.innerHTML = '';
      return;
    }
    const icon = getItemIcon(stack.id, 48);
    node.innerHTML = '';
    if (icon) {
      const canvas = document.createElement('canvas');
      canvas.width = 48;
      canvas.height = 48;
      canvas.getContext('2d').drawImage(icon, 0, 0);
      node.append(canvas);
    }
    if (stack.count > 1) node.append(el('span', 'slot-count', String(stack.count)));
    node.classList.remove('hidden');
    this.positionCursor();
  }

  positionCursor() {
    const node = this.el.inventoryCursor;
    if (!node || node.classList.contains('hidden')) return;
    node.style.transform = `translate(${this.lastCursorEvent.x - 24}px, ${this.lastCursorEvent.y - 24}px)`;
  }

  closeInventoryScreen() {
    this.inventoryOpen = false;
    this.invView = null;
    this.cursorStack = null;
    this.el.inventory.classList.add('hidden');
    this.el.inventoryCursor?.classList.add('hidden');
    this.setMining(0);
  }

  /* ------------------------------------------------------------------ */
  /* Touch controls                                                      */
  /* ------------------------------------------------------------------ */

  initTouch() {
    if (!this.isTouch) return;
    const joystick = this.el.joystick;
    const knob = this.el.joystickKnob;
    let joystickId = null;

    const updateJoystick = (touch) => {
      const rect = joystick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = touch.clientX - cx;
      let dy = touch.clientY - cy;
      const radius = rect.width / 2 - 14;
      const len = Math.hypot(dx, dy);
      if (len > radius) {
        dx = (dx / len) * radius;
        dy = (dy / len) * radius;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.touchMove.x = dx / radius;
      this.touchMove.y = dy / radius;
    };

    const resetJoystick = () => {
      knob.style.transform = 'translate(-50%, -50%)';
      this.touchMove.x = 0;
      this.touchMove.y = 0;
      joystickId = null;
    };

    joystick.addEventListener(
      'touchstart',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        const touch = event.changedTouches[0];
        joystickId = touch.identifier;
        updateJoystick(touch);
      },
      { passive: false },
    );

    joystick.addEventListener(
      'touchmove',
      (event) => {
        event.preventDefault();
        event.stopPropagation();
        for (const touch of event.changedTouches) {
          if (touch.identifier === joystickId) updateJoystick(touch);
        }
      },
      { passive: false },
    );

    const endJoystick = (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier === joystickId) resetJoystick();
      }
    };
    joystick.addEventListener('touchend', endJoystick);
    joystick.addEventListener('touchcancel', endJoystick);

    for (const button of document.querySelectorAll('[data-touch]')) {
      const action = button.dataset.touch;
      button.addEventListener('touchstart', (event) => {
        event.preventDefault();
        event.stopPropagation();
        button.classList.add('pressed');
        if (action === 'jump') this.touchJump = true;
        else if (action === 'down') this.touchDescend = true;
        else if (action === 'fly') this.callbacks.onToggleFly?.();
        else if (action === 'break') this.callbacks.onTouchBreak?.();
        else if (action === 'place') this.callbacks.onTouchPlace?.();
        else if (action === 'inventory') this.callbacks.onInventoryOpen?.();
        else if (action === 'pause') this.callbacks.onTouchPause?.();
      });
      const end = (event) => {
        event.preventDefault();
        button.classList.remove('pressed');
        if (action === 'jump') this.touchJump = false;
        if (action === 'down') this.touchDescend = false;
      };
      button.addEventListener('touchend', end);
      button.addEventListener('touchcancel', end);
    }

    this.canvas.addEventListener(
      'touchstart',
      (event) => {
        if (!this.isTouch) return;
        if (this.lookTouchId !== null) return;
        const touch = event.changedTouches[0];
        this.lookTouchId = touch.identifier;
        this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
      },
      { passive: true },
    );

    this.canvas.addEventListener(
      'touchmove',
      (event) => {
        for (const touch of event.changedTouches) {
          if (touch.identifier !== this.lookTouchId) continue;
          const dx = touch.clientX - this.lastLookTouch.x;
          const dy = touch.clientY - this.lastLookTouch.y;
          this.lastLookTouch = { x: touch.clientX, y: touch.clientY };
          this.callbacks.onTouchLook?.(dx, dy);
        }
      },
      { passive: true },
    );

    const endLook = (event) => {
      for (const touch of event.changedTouches) {
        if (touch.identifier === this.lookTouchId) this.lookTouchId = null;
      }
    };
    this.canvas.addEventListener('touchend', endLook);
    this.canvas.addEventListener('touchcancel', endLook);
  }

  getTouchState() {
    return {
      x: this.touchMove.x,
      y: this.touchMove.y,
      jump: this.touchJump,
      descend: this.touchDescend,
      active: Math.abs(this.touchMove.x) > 0.08 || Math.abs(this.touchMove.y) > 0.08,
    };
  }
}
