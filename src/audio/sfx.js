// Tiny procedural sound engine (Web Audio) so the game needs no audio assets.

import { B } from '../world/blocks.js';

const MATERIALS = new Map();
const set = (ids, kind) => ids.forEach((id) => MATERIALS.set(id, kind));
set([B.GRASS, B.DIRT, B.SNOW_GRASS, B.SNOW, B.GRAVEL, B.SAND, B.CACTUS], 'soft');
set([B.STONE, B.COBBLE, B.BEDROCK, B.SANDSTONE, B.COAL_ORE, B.IRON_ORE, B.GOLD_ORE, B.DIAMOND_ORE, B.OBSIDIAN, B.STONE_BRICKS, B.BRICKS, B.GLOWSTONE], 'hard');
set([B.OAK_LOG, B.BIRCH_LOG, B.SPRUCE_LOG, B.PLANKS, B.OAK_LEAVES, B.BIRCH_LEAVES, B.SPRUCE_LEAVES], 'wood');
set([B.GLASS, B.ICE], 'glass');
set([B.WATER], 'water');

export class Sfx {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.master = null;
    this.noiseBuffer = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.42;
    this.master.connect(this.ctx.destination);
    this.noiseBuffer = this._makeNoise(1);
  }

  _makeNoise(seconds) {
    const length = Math.floor(this.ctx.sampleRate * seconds);
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  get ready() {
    return this.enabled && this.ctx && this.ctx.state === 'running';
  }

  _noise(duration, filterType, frequency, gain, pitch = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const source = this.ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = pitch;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.9;
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(amp).connect(this.master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  _tone(frequency, duration, type, gain, slide = 0) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    const amp = this.ctx.createGain();
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.exponentialRampToValueAtTime(gain, now + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp).connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  breakBlock(id) {
    if (!this.ready) return;
    const kind = MATERIALS.get(id) || 'hard';
    if (kind === 'soft') this._noise(0.16, 'lowpass', 900 + Math.random() * 300, 0.5);
    else if (kind === 'hard') {
      this._noise(0.12, 'bandpass', 1300 + Math.random() * 600, 0.55);
      this._tone(160 + Math.random() * 40, 0.08, 'triangle', 0.12, -60);
    } else if (kind === 'wood') {
      this._noise(0.13, 'bandpass', 700 + Math.random() * 200, 0.5);
      this._tone(220, 0.09, 'triangle', 0.15, -80);
    } else if (kind === 'glass') {
      this._noise(0.18, 'highpass', 2400, 0.35);
      this._tone(1800 + Math.random() * 500, 0.12, 'sine', 0.07, 500);
    }
  }

  placeBlock(id) {
    if (!this.ready) return;
    const kind = MATERIALS.get(id) || 'hard';
    if (kind === 'soft') this._noise(0.1, 'lowpass', 700, 0.4);
    else if (kind === 'wood') this._tone(300, 0.08, 'triangle', 0.14, -100);
    else this._noise(0.09, 'bandpass', 1100, 0.4);
  }

  step(id) {
    if (!this.ready) return;
    const kind = MATERIALS.get(id) || 'soft';
    if (kind === 'wood') this._noise(0.06, 'bandpass', 500, 0.18);
    else if (kind === 'hard') this._noise(0.05, 'bandpass', 1500, 0.14);
    else this._noise(0.07, 'lowpass', 620, 0.16);
  }

  splash() {
    if (!this.ready) return;
    this._noise(0.35, 'lowpass', 1200, 0.45, 0.7);
    this._tone(220, 0.3, 'sine', 0.06, -120);
  }

  click() {
    if (!this.ready) return;
    this._tone(660, 0.05, 'square', 0.05, 80);
  }

  toggle(on) {
    this.enabled = on;
  }
}
