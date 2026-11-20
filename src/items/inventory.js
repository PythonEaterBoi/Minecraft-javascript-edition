// Slot-based inventory: 9 hotbar slots followed by 27 storage slots.
// Stacks are plain objects: { id, count, dur? } where `dur` is the remaining
// durability of a tool.

import { itemDef, itemStackSize } from './items.js';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 36;

export function makeStack(id, count = 1, dur) {
  if (!id || count <= 0) return null;
  const stack = { id, count };
  const def = itemDef(id);
  if (dur !== undefined) stack.dur = dur;
  else if (def && def.durability) stack.dur = def.durability;
  return stack;
}

export function stacksEqual(a, b) {
  if (!a || !b) return false;
  if (a.id !== b.id) return false;
  const def = itemDef(a.id);
  if (def && def.durability) return false; // tools never merge
  return true;
}

export class Inventory {
  constructor(size = INVENTORY_SIZE) {
    this.size = size;
    this.slots = new Array(size).fill(null);
  }

  get(index) {
    return this.slots[index] || null;
  }

  isEmpty(index) {
    return !this.slots[index];
  }

  set(index, stack) {
    this.slots[index] = stack && stack.count > 0 ? stack : null;
  }

  /** Add items, filling partial stacks first. Returns the number that fit. */
  add(id, count = 1) {
    if (!id || count <= 0) return 0;
    const max = itemStackSize(id);
    let left = count;
    if (max > 1) {
      for (let i = 0; i < this.size && left > 0; i++) {
        const slot = this.slots[i];
        if (slot && slot.id === id && slot.count < max) {
          const take = Math.min(max - slot.count, left);
          slot.count += take;
          left -= take;
        }
      }
    }
    for (let i = 0; i < this.size && left > 0; i++) {
      if (!this.slots[i]) {
        const take = Math.min(max, left);
        this.slots[i] = makeStack(id, take);
        left -= take;
      }
    }
    return count - left;
  }

  /** Remove `count` of an item from anywhere. Returns how many were removed. */
  remove(id, count = 1) {
    let left = count;
    for (let i = this.size - 1; i >= 0 && left > 0; i--) {
      const slot = this.slots[i];
      if (slot && slot.id === id) {
        const take = Math.min(slot.count, left);
        slot.count -= take;
        left -= take;
        if (slot.count <= 0) this.slots[i] = null;
      }
    }
    return count - left;
  }

  count(id) {
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.id === id) total += slot.count;
    }
    return total;
  }

  has(...items) {
    // items: [id, count] pairs
    return items.every(([id, count]) => this.count(id) >= count);
  }

  find(id) {
    for (let i = 0; i < this.size; i++) {
      if (this.slots[i] && this.slots[i].id === id) return i;
    }
    return -1;
  }

  firstEmpty() {
    for (let i = 0; i < this.size; i++) if (!this.slots[i]) return i;
    return -1;
  }

  clear() {
    this.slots.fill(null);
  }

  serialize() {
    return this.slots.map((slot) => (slot ? [slot.id, slot.count, slot.dur ?? null] : null));
  }

  load(data) {
    if (!Array.isArray(data)) return;
    this.slots = new Array(this.size).fill(null);
    data.slice(0, this.size).forEach((entry, i) => {
      if (!Array.isArray(entry)) return;
      const [id, count, dur] = entry;
      if (!itemDef(id) || !count) return;
      this.slots[i] = { id, count, ...(dur ? { dur } : {}) };
    });
  }

  /** Damage the tool in a slot; returns true when it broke. */
  damageTool(index, amount = 1) {
    const slot = this.slots[index];
    if (!slot) return false;
    const def = itemDef(slot.id);
    if (!def || !def.durability) return false;
    slot.dur = (slot.dur ?? def.durability) - amount;
    if (slot.dur <= 0) {
      this.slots[index] = null;
      return true;
    }
    return false;
  }

  /** Swap/merge the cursor stack with a slot (the standard container click). */
  click(index, cursor) {
    const slot = this.slots[index] || null;
    if (!cursor) {
      if (slot) {
        this.slots[index] = null;
        return slot;
      }
      return null;
    }
    if (!slot) {
      this.slots[index] = cursor;
      return null;
    }
    if (stacksEqual(slot, cursor)) {
      const max = itemStackSize(slot.id);
      const take = Math.min(max - slot.count, cursor.count);
      slot.count += take;
      cursor.count -= take;
      if (cursor.count <= 0) return null;
      return cursor;
    }
    this.slots[index] = cursor;
    return slot;
  }

  rightClick(index, cursor) {
    const slot = this.slots[index] || null;
    if (!cursor) {
      if (!slot) return null;
      const half = Math.ceil(slot.count / 2);
      const taken = { ...slot, count: half };
      slot.count -= half;
      if (slot.count <= 0) this.slots[index] = null;
      return taken;
    }
    if (!slot) {
      this.slots[index] = { ...cursor, count: 1 };
      cursor.count -= 1;
      return cursor.count > 0 ? cursor : null;
    }
    if (slot.id === cursor.id && slot.count < itemStackSize(slot.id)) {
      slot.count += 1;
      cursor.count -= 1;
      return cursor.count > 0 ? cursor : null;
    }
    return cursor;
  }
}
