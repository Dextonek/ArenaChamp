import type { Trait } from './types';

/** Ricochet Light's base damage: the trait reads the reflections of a hit back from it (`dealt`), so the spell's default uses it too. */
export const RICOCHET_DAMAGE = 64;
/** Each reflection adds this share of a bolt's damage (the projectile system's default `reflectBonus`) and 2 m of range. */
export const BANK_BONUS = 0.25;
export const BANK_RANGE = 2;
/** The most reflections a bolt of hers makes (Ricochet Light). */
export const BANK_MAX = 2;
/** Seconds a hit after reflections takes off Ricochet Light, per reflection. */
export const BANK_REFUND = 1;

/**
 * Opaline (marksman). Passive Prismatic: her bolts reflect off walls, pillars and crystals (`ProjectileOptions.reflect`, set by
 * her spells). Each reflection adds 25% damage and 2 m of range, and a hit after reflections takes 1 s per reflection off
 * Ricochet Light. The aim line draws the first bounce (`HeroSpell.bank`), the telegraph every leg.
 *
 * The refund is decided where the hit is decided, which online is the victim's screen. There `dealt` does not know the
 * bolt: the engine has already folded the bank bonus into the hit (`world.hit` runs before `Projectile.fire`, so
 * `onHit` is too late), so the bonus is the signal. `hit.opts` is the options copy before the trait's other changes
 * (power, the victim's takenMul, the CPU level), so `opts.damage / RICOCHET_DAMAGE` is 1, 1.25 or 1.5: the reflections. Then
 * `noteOwner('bank', n)` tells her own client (`peerNote`), which takes n seconds off slot 0.
 */
export const prismTrait: Trait = {
  passive: { name: 'Prismatic', blurb: 'Her bolts bounce off walls, pillars and crystals. Each bounce adds 25% damage and 2 m of range, and a hit after bouncing takes 1 s per bounce off Ricochet Light. Her aim line shows the first bounce.' },
  speed: 4.2,
  attack: { kind: 'ranged', range: 8.5, damage: 15, interval: 1.4, windup: 0.32, speed: 22, look: 'prism' },
  dealt(t, hit) {
    if (hit.kind !== 'spell' || hit.slot !== 0 || !hit.victimIsHero || hit.opts.damage === undefined) return;
    const n = Math.max(0, Math.min(BANK_MAX, Math.round((hit.opts.damage / RICOCHET_DAMAGE - 1) / BANK_BONUS)));
    if (n > 0) t.noteOwner('bank', n);
  },
  peerNote(t, name, n) {
    if (name !== 'bank' || n <= 0) return;
    t.setCooldown(0, Math.max(0, t.cooldownLeft(0) - n * BANK_REFUND));
    t.say(`BANK -${n * BANK_REFUND}s`, '#ffd24a');
  },
};
