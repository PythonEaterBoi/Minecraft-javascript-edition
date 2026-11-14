// All DOM UI: title/pause screens, hotbar, block picker, settings, controls,
// debug overlay, toasts and the mobile touch controls.

import { getBlockIcon } from '../world/atlas.js';
import { BLOCKS, PICKABLE_BLOCKS } from '../world/blocks.js';

const SETTINGS_KEY = 'mje.settings.v1';

const DEFAULTS = {
  renderDistance: 7,
  sensitivity: 1,
  sound: true,
  clouds: true,
  dayCycle: true,
};

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
  [['Left click'], 'Break block'],
  [['Right click'], 'Place block'],
  [['Middle click'], 'Pick block'],
  [['V'], 'Break block (keyboard)'],
  [['B'], 'Place block (keyboard)'],
  [['Space'], 'Jump · swim up'],
  [['Shift'], 'Sprint · descend while flying'],
  [['F'], 'Toggle flight'],
  [['1', '–', '9'], 'Select hotbar slot'],
  [['Wheel'], 'Cycle hotbar'],
  [['E'], 'Block picker'],
  [['T'], 'Pause / resume time'],
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
      inventoryGrid: document.getElementById('inventory-grid'),
      inventorySlot: document.getElementById('inventory-slot'),
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

  setHotbar(ids) {
    this.hotbarIds = ids.slice();
    this.renderHotbar();
  }

  setSelectedSlot(index) {
    this.selectedSlot = index;
    this.renderHotbar();
    const id = this.hotbarIds[index];
    if (id !== undefined) {
      this.showBlockLabel(BLOCKS[id]?.name || 'Block');
      this.updateHeldBlock(id);
    }
    this.el.inventorySlot.textContent = String(index + 1);
  }

  updateHeldBlock(id) {
    if (!this.el.heldCanvas || !id) return;
    const ctx = this.el.heldCanvas.getContext('2d');
    if (!ctx) return;
    const icon = getBlockIcon(id, 128);
    ctx.clearRect(0, 0, 128, 128);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(icon, 0, 0, 128, 128);
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
    bar.innerHTML = '';
    this.hotbarIds.forEach((id, i) => {
      const slot = el('button', `hotbar-slot${i === this.selectedSlot ? ' selected' : ''}`);
      slot.type = 'button';
      slot.title = BLOCKS[id]?.name || 'Block';
      slot.dataset.index = String(i);
      if (id) {
        const icon = getBlockIcon(id, 64);
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        canvas.getContext('2d').drawImage(icon, 0, 0);
        slot.append(canvas);
      }
      slot.append(el('span', 'index', String(i + 1)));
      slot.addEventListener('click', (event) => {
        event.stopPropagation();
        this.callbacks.onSelectSlot?.(i);
      });
      bar.append(slot);
    });
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

  setUnderwater(active) {
    this.el.underwater.classList.toggle('active', active);
  }

  /* ------------------------------------------------------------------ */
  /* Inventory                                                           */
  /* ------------------------------------------------------------------ */

  renderInventory() {
    const grid = this.el.inventoryGrid;
    grid.innerHTML = '';
    for (const block of PICKABLE_BLOCKS) {
      const cell = el('button', 'block-cell');
      cell.type = 'button';
      cell.title = block.name;
      const icon = getBlockIcon(block.id, 64);
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      canvas.getContext('2d').drawImage(icon, 0, 0);
      cell.append(canvas, el('span', null, block.name));
      cell.addEventListener('click', () => {
        this.callbacks.onUiSound?.();
        this.callbacks.onPickBlock?.(block.id);
      });
      grid.append(cell);
    }
  }

  openInventory(ids, selected) {
    this.hotbarIds = ids.slice();
    this.selectedSlot = selected;
    this.el.inventorySlot.textContent = String(selected + 1);
    if (!this.el.inventoryGrid.childElementCount) this.renderInventory();
    this.inventoryOpen = true;
    this.el.inventory.classList.remove('hidden');
    this.setSelectedSlot(selected);
    setTimeout(() => {
      const first = this.el.inventoryGrid.querySelector('.block-cell');
      if (first) first.focus({ preventScroll: true });
    }, 0);
  }

  closeInventory() {
    this.inventoryOpen = false;
    this.el.inventory.classList.add('hidden');
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
