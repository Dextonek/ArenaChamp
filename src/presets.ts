import { defaultSettings, type EmitterSettings } from './emitter';

/** Bloom settings that suit a preset; applied together with the emitter settings. */
export interface BloomSettings {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
}

export interface Preset {
  emitter: Partial<EmitterSettings>;
  bloom: BloomSettings;
}

export const defaultBloom = (): BloomSettings => ({ enabled: true, strength: 1.1, radius: 0.5, threshold: 0.2 });

export const presets: Record<string, Preset> = {
  fire: {
    emitter: {
      maxParticles: 4000, rate: 450, lifetime: 1.1, lifetimeJitter: 0.35,
      shape: 'cone', shapeSize: 0.35, originY: 0,
      speed: 2.2, speedJitter: 0.4, spread: 14, gravity: -1.6, drag: 0.8,
      sizeStart: 0.45, sizeEnd: 0.06,
      colorStart: '#ffb347', colorEnd: '#d81c00', opacityStart: 0.3, opacityEnd: 0,
      additive: true,
    },
    bloom: { enabled: true, strength: 0.8, radius: 0.5, threshold: 0.35 },
  },
  smoke: {
    emitter: {
      maxParticles: 1500, rate: 60, lifetime: 5, lifetimeJitter: 0.3,
      shape: 'cone', shapeSize: 0.3, originY: 0,
      speed: 0.5, speedJitter: 0.4, spread: 12, gravity: -0.25, drag: 0.4,
      sizeStart: 0.6, sizeEnd: 3,
      colorStart: '#6d6a66', colorEnd: '#2b2c30', opacityStart: 0.35, opacityEnd: 0,
      additive: false,
    },
    // High threshold so the grey smoke doesn't glow.
    bloom: { enabled: true, strength: 0.4, radius: 0.4, threshold: 0.85 },
  },
  sparks: {
    emitter: {
      maxParticles: 3000, rate: 260, lifetime: 1.4, lifetimeJitter: 0.5,
      shape: 'point', shapeSize: 0, originY: 1,
      speed: 6, speedJitter: 0.5, spread: 70, gravity: 9, drag: 0.3,
      sizeStart: 0.08, sizeEnd: 0.02,
      colorStart: '#fff6d8', colorEnd: '#ff7a1a', opacityStart: 1, opacityEnd: 0.2,
      additive: true,
    },
    bloom: { enabled: true, strength: 1.6, radius: 0.4, threshold: 0.1 },
  },
  magic: {
    emitter: {
      maxParticles: 5000, rate: 500, lifetime: 2.4, lifetimeJitter: 0.5,
      shape: 'sphere', shapeSize: 0.9, originY: 1.2,
      speed: 0.6, speedJitter: 0.8, spread: 180, gravity: -0.5, drag: 0.9,
      sizeStart: 0.18, sizeEnd: 0,
      colorStart: '#7ff6ff', colorEnd: '#b03cff', opacityStart: 0.45, opacityEnd: 0,
      additive: true,
    },
    bloom: { enabled: true, strength: 1.1, radius: 0.6, threshold: 0.25 },
  },
  snow: {
    emitter: {
      maxParticles: 8000, rate: 500, lifetime: 12, lifetimeJitter: 0.2,
      shape: 'box', shapeSize: 4, originY: 6,
      speed: 0.3, speedJitter: 0.8, spread: 180, gravity: 1, drag: 1.5,
      sizeStart: 0.07, sizeEnd: 0.07,
      colorStart: '#ffffff', colorEnd: '#cfe3ff', opacityStart: 0.9, opacityEnd: 0.6,
      additive: false,
    },
    bloom: { enabled: true, strength: 0.5, radius: 0.3, threshold: 0.6 },
  },
};

export const presetNames = Object.keys(presets);

/** Full emitter settings for a preset: defaults first, so no field leaks from the previous effect. */
export function presetSettings(name: string): EmitterSettings {
  return { ...defaultSettings(), ...presets[name].emitter };
}
