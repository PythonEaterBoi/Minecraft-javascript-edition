// Block entities: the small amount of state that lives in a block position —
// chest contents and furnace progress. They are created when a block is placed
// or first opened and are saved with the world.

import { smeltResult, fuelValue } from '../items/recipes.js';
import { itemStackSize, itemDef } from '../items/items.js';

const SMELT_TIME = 9; // seconds per item
const OFF = 32768;

export function keyOf(x, y, z) {
  return `${x + OFF},${y},${z + OFF}`;
}

export class BlockEntities {
  constructor() {
    this.map = new Map();
  }

  get(x, y, z) {
    return this.map.get(keyOf(x, y, z)) || null;
  }

  create(x, y, z, type) {
    let entity = this.get(x, y, z);
    if (entity) return entity;
    if (type === 'chest') entity = { type: 'chest', slots: new Array(27).fill(null) };
    else if (type === 'furnace') entity = { type: 'furnace', input: null, fuel: null, output: null, burn: 0, burnMax: 0, progress: 0 };
    else return null;
    entity.x = x;
    entity.y = y;
    entity.z = z;
    this.map.set(keyOf(x, y, z), entity);
    return entity;
  }

  remove(x, y, z) {
    const key = keyOf(x, y, z);
    const entity = this.map.get(key) || null;
    this.map.delete(key);
    return entity;
  }

  /** Every stack stored in a block entity (used when the block is broken). */
  contents(entity) {
    if (!entity) return [];
    if (entity.type === 'chest') return entity.slots.filter(Boolean);
    return [entity.input, entity.fuel, entity.output].filter(Boolean);
  }

  slot(entity, index) {
    if (!entity) return null;
    if (entity.type === 'chest') return entity.slots[index] || null;
    if (index === 0) return entity.input;
    if (index === 1) return entity.fuel;
    if (index === 2) return entity.output;
    return null;
  }

  setSlot(entity, index, stack) {
    if (!entity) return;
    if (entity.type === 'chest') {
      entity.slots[index] = stack && stack.count > 0 ? stack : null;
      return;
    }
    if (index === 0) entity.input = stack && stack.count > 0 ? stack : null;
    else if (index === 1) entity.fuel = stack && stack.count > 0 ? stack : null;
    else if (index === 2) entity.output = stack && stack.count > 0 ? stack : null;
  }

  /** Container click semantics (cursor stack in, cursor stack out). */
  click(entity, index, cursor, right = false) {
    const slot = this.slot(entity, index);
    if (!cursor) {
      if (!slot) return null;
      if (right && slot.count > 1) {
        const half = Math.ceil(slot.count / 2);
        const taken = { ...slot, count: half };
        this.setSlot(entity, index, { ...slot, count: slot.count - half });
        return taken;
      }
      this.setSlot(entity, index, null);
      return slot;
    }
    if (!slot) {
      if (right) {
        this.setSlot(entity, index, { ...cursor, count: 1 });
        cursor.count -= 1;
        return cursor.count > 0 ? cursor : null;
      }
      this.setSlot(entity, index, cursor);
      return null;
    }
    const def = itemDef(slot.id);
    const mergeable = slot.id === cursor.id && !(def && def.durability);
    if (mergeable) {
      const max = itemStackSize(slot.id);
      const take = Math.min(max - slot.count, cursor.count);
      slot.count += take;
      cursor.count -= take;
      return cursor.count > 0 ? cursor : null;
    }
    this.setSlot(entity, index, cursor);
    return slot;
  }

  /** Advance every furnace. */
  tick(dt, onChange) {
    for (const entity of this.map.values()) {
      if (entity.type !== 'furnace') continue;
      const recipe = entity.input ? smeltResult(entity.input.id) : null;
      const outputRoom =
        !entity.output ||
        (entity.output.id === recipe && entity.output.count < itemStackSize(recipe));

      if (entity.burn <= 0 && recipe && outputRoom && entity.fuel) {
        const value = fuelValue(entity.fuel.id);
        if (value > 0) {
          entity.fuel.count -= 1;
          if (entity.fuel.count <= 0) entity.fuel = null;
          entity.burn = value;
          entity.burnMax = value;
          onChange?.(entity);
        }
      }

      if (entity.burn > 0) {
        entity.burn = Math.max(0, entity.burn - dt);
        if (recipe && outputRoom) {
          entity.progress += dt;
          if (entity.progress >= SMELT_TIME) {
            entity.progress = 0;
            entity.input.count -= 1;
            if (entity.input.count <= 0) entity.input = null;
            if (entity.output) entity.output.count += 1;
            else entity.output = { id: recipe, count: 1 };
            onChange?.(entity);
          }
        } else {
          entity.progress = 0;
        }
      } else if (entity.progress > 0) {
        entity.progress = Math.max(0, entity.progress - dt * 2);
      }
    }
  }

  serialize() {
    const out = [];
    for (const [key, entity] of this.map) {
      if (entity.type === 'chest') {
        const slots = entity.slots.map((slot) => (slot ? [slot.id, slot.count, slot.dur ?? null] : null));
        if (slots.every((slot) => !slot)) continue;
        out.push({ key, type: 'chest', slots });
      } else if (entity.type === 'furnace') {
        const pack = (slot) => (slot ? [slot.id, slot.count, slot.dur ?? null] : null);
        if (!entity.input && !entity.fuel && !entity.output) continue;
        out.push({
          key,
          type: 'furnace',
          input: pack(entity.input),
          fuel: pack(entity.fuel),
          output: pack(entity.output),
          burn: entity.burn,
          burnMax: entity.burnMax,
          progress: entity.progress,
        });
      }
    }
    return out;
  }

  load(data) {
    this.map.clear();
    if (!Array.isArray(data)) return;
    for (const entry of data) {
      if (!entry || typeof entry.key !== 'string') continue;
      const unpack = (slot) =>
        Array.isArray(slot) && itemDef(slot[0]) ? { id: slot[0], count: slot[1], ...(slot[2] ? { dur: slot[2] } : {}) } : null;
      if (entry.type === 'chest') {
        const slots = Array.isArray(entry.slots) ? entry.slots.map(unpack) : [];
        while (slots.length < 27) slots.push(null);
        this.map.set(entry.key, { type: 'chest', slots });
      } else if (entry.type === 'furnace') {
        this.map.set(entry.key, {
          type: 'furnace',
          input: unpack(entry.input),
          fuel: unpack(entry.fuel),
          output: unpack(entry.output),
          burn: Number(entry.burn) || 0,
          burnMax: Number(entry.burnMax) || 0,
          progress: Number(entry.progress) || 0,
        });
      }
    }
  }
}
