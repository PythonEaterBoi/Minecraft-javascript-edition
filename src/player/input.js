// Keyboard/mouse plumbing and pointer lock handling.

const MOVEMENT_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  // Arrow keys are the keyboard look controls, so they must not scroll.
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export class Input {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDown = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.locked = false;
    this.enabled = false;
    this.touchMode = false;
    this.onAction = options.onAction || (() => {});
    this.onLockChange = options.onLockChange || (() => {});
    this.onMouseButton = options.onMouseButton || (() => {});
    this.onWheel = options.onWheel || (() => {});
    this.onTouchLook = options.onTouchLook || null;
    this.lastWheel = 0;

    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', (event) => {
      const target = event.target;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.repeat) {
        if (MOVEMENT_KEYS.has(event.code) && this.enabled) event.preventDefault();
        return;
      }
      if (event.code === 'F11') return;
      if (this.enabled && MOVEMENT_KEYS.has(event.code)) event.preventDefault();
      this.keys.add(event.code);
      this.onAction('keydown', event);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
      this.onAction('keyup', event);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown.clear();
    });

    this.canvas.addEventListener('mousedown', (event) => {
      if (!this.enabled) return;
      if (this.touchMode) {
        this.onMouseButton(event.button, true);
        return;
      }
      if (!this.locked) {
        this.requestLock();
        return;
      }
      event.preventDefault();
      this.mouseDown.add(event.button);
      this.onMouseButton(event.button, true);
    });

    window.addEventListener('mouseup', (event) => {
      this.mouseDown.delete(event.button);
      this.onMouseButton(event.button, false);
    });

    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    window.addEventListener('mousemove', (event) => {
      if (!this.locked || !this.enabled) return;
      // Some browsers deliver a huge delta when pointer lock is acquired.
      const dx = Math.max(-120, Math.min(120, event.movementX || 0));
      const dy = Math.max(-120, Math.min(120, event.movementY || 0));
      this.lookX += dx;
      this.lookY += dy;
    });

    window.addEventListener(
      'wheel',
      (event) => {
        if (!this.enabled) return;
        event.preventDefault();
        const now = performance.now();
        if (now - this.lastWheel < 40) return;
        this.lastWheel = now;
        this.onWheel(event.deltaY > 0 ? 1 : -1);
      },
      { passive: false },
    );

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.keys.clear();
      this.mouseDown.clear();
      this.lookX = 0;
      this.lookY = 0;
      this.onLockChange(this.locked);
    });

    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.onLockChange(false);
    });
  }

  requestLock() {
    if (this.locked) return;
    try {
      const result = this.canvas.requestPointerLock();
      if (result && typeof result.catch === 'function') result.catch(() => {});
    } catch {
      /* browsers throttle re-locking; the pause menu offers a retry */
    }
  }

  exitLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  consumeLook() {
    const x = this.lookX;
    const y = this.lookY;
    this.lookX = 0;
    this.lookY = 0;
    return { x, y };
  }

  /** Player intent for this frame (WASD; the arrows are look keys). */
  getMoveState() {
    return {
      forward: this.keys.has('KeyW'),
      back: this.keys.has('KeyS'),
      left: this.keys.has('KeyA'),
      right: this.keys.has('KeyD'),
      jump: this.keys.has('Space'),
      descend: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyC'),
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  /** Arrow-key look direction as -1..1 values, consumed each frame. */
  getLookKeys() {
    let yaw = 0;
    let pitch = 0;
    if (this.keys.has('ArrowLeft')) yaw += 1;
    if (this.keys.has('ArrowRight')) yaw -= 1;
    if (this.keys.has('ArrowUp')) pitch += 1;
    if (this.keys.has('ArrowDown')) pitch -= 1;
    return { yaw, pitch };
  }
}
