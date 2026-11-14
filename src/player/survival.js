// Survival stats: health, hunger, saturation, air and the damage sources that
// feed them (falls, drowning, starvation, mobs).

export const MAX_HEALTH = 20;
export const MAX_HUNGER = 20;
export const MAX_AIR = 10;

export class Survival {
  constructor() {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.air = MAX_AIR;
    this.exhaustion = 0;
    this.creative = false;
    this.dead = false;
    this.invuln = 0;
    this.regenTimer = 0;
    this.starveTimer = 0;
    this.drownTimer = 0;
    this.hurtFlash = 0;
    this.lastDamage = '';
    this.onDamage = null;
    this.onDeath = null;
    this.onEat = null;
  }

  get maxHealth() {
    return MAX_HEALTH;
  }

  get maxHunger() {
    return MAX_HUNGER;
  }

  get maxAir() {
    return MAX_AIR;
  }

  reset() {
    this.health = MAX_HEALTH;
    this.hunger = MAX_HUNGER;
    this.saturation = 5;
    this.air = MAX_AIR;
    this.exhaustion = 0;
    this.dead = false;
    this.invuln = 0;
    this.hurtFlash = 0;
    this.lastDamage = '';
  }

  damage(amount, cause = 'damage') {
    if (this.dead || this.creative || amount <= 0) return false;
    if (this.invuln > 0 && cause !== 'drown' && cause !== 'starve') return false;
    this.health = Math.max(0, this.health - amount);
    this.invuln = cause === 'drown' || cause === 'starve' ? 0.2 : 0.55;
    this.hurtFlash = 0.45;
    this.lastDamage = cause;
    this.exhaustion += 0.4;
    this.onDamage?.(amount, cause);
    if (this.health <= 0) {
      this.dead = true;
      this.onDeath?.(cause);
    }
    return true;
  }

  heal(amount) {
    this.health = Math.min(MAX_HEALTH, this.health + amount);
  }

  feed(hunger, saturation) {
    this.hunger = Math.min(MAX_HUNGER, this.hunger + hunger);
    this.saturation = Math.min(this.hunger, this.saturation + saturation);
  }

  /** Called when the player hits the ground after a fall. */
  landed(fallDistance) {
    if (fallDistance > 3.2) {
      const blocks = Math.floor(fallDistance - 3);
      if (blocks > 0) this.damage(blocks, 'fall');
    }
  }

  update(dt, state) {
    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt);

    if (this.creative) {
      this.health = MAX_HEALTH;
      this.hunger = MAX_HUNGER;
      this.air = MAX_AIR;
      this.dead = false;
      return;
    }

    // Hunger drains with activity.
    let drain = 0;
    if (state.sprinting) drain += 0.055;
    else if (state.moving) drain += 0.012;
    if (state.jumping) drain += 0.02;
    this.exhaustion += drain * dt;
    while (this.exhaustion >= 4) {
      this.exhaustion -= 4;
      if (this.saturation > 0) this.saturation = Math.max(0, this.saturation - 1);
      else this.hunger = Math.max(0, this.hunger - 1);
    }

    // Regeneration.
    if (this.hunger >= 18 && this.health < MAX_HEALTH) {
      this.regenTimer += dt;
      if (this.regenTimer >= 3.5) {
        this.regenTimer = 0;
        this.heal(1);
        this.exhaustion += 2.5;
      }
    } else {
      this.regenTimer = 0;
    }

    // Starvation.
    if (this.hunger <= 0) {
      this.starveTimer += dt;
      if (this.starveTimer >= 4) {
        this.starveTimer = 0;
        this.damage(1, 'starve');
      }
    } else {
      this.starveTimer = 0;
    }

    // Air.
    if (state.headInWater) {
      this.air = Math.max(0, this.air - dt * 1.4);
      if (this.air <= 0) {
        this.drownTimer += dt;
        if (this.drownTimer >= 1) {
          this.drownTimer = 0;
          this.damage(1, 'drown');
        }
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + dt * 6);
      this.drownTimer = 0;
    }
  }

  serialize() {
    return {
      health: this.health,
      hunger: this.hunger,
      saturation: this.saturation,
      air: this.air,
      creative: this.creative,
    };
  }

  load(data) {
    if (!data || typeof data !== 'object') return;
    if (Number.isFinite(data.health)) this.health = Math.max(1, Math.min(MAX_HEALTH, data.health));
    if (Number.isFinite(data.hunger)) this.hunger = Math.max(0, Math.min(MAX_HUNGER, data.hunger));
    if (Number.isFinite(data.saturation)) this.saturation = Math.max(0, data.saturation);
    if (Number.isFinite(data.air)) this.air = Math.max(0, Math.min(MAX_AIR, data.air));
    this.creative = !!data.creative;
  }
}
