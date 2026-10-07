/**
 * Deterministic RNG System for AI City
 * Uses seedrandom for reproducible random number generation across systems
 */

import { RNGStreamState, RNGRegistry } from './types';

// Re-export seedrandom for convenience
import SeedRandom from 'seedrandom';

/**
 * Creates a new seeded RNG instance
 */
export function createRNG(seed: string | number): SeedRandom.prng {
  return SeedRandom(seed.toString());
}

/**
 * Creates an RNG stream with a unique identifier
 */
export function createRNGStream(
  registry: RNGRegistry,
  streamId: string,
  seed?: number
): SeedRandom.prng {
  const fullSeed = seed !== undefined ? seed : registry.globalSeed;
  const streamSeed = `${fullSeed}:${streamId}`;
  const rng = createRNG(streamSeed);

  const streamState: RNGStreamState = {
    streamId,
    state: rng.state(), // Capture initial state
  };

  registry.streams.set(streamId, streamState);
  return rng;
}

/**
 * Gets or creates an RNG stream
 */
export function getOrCreateRNGStream(
  registry: RNGRegistry,
  streamId: string,
  seed?: number
): SeedRandom.prng {
  if (registry.streams.has(streamId)) {
    const stream = registry.streams.get(streamId)!;
    const rng = createRNG('');
    rng.state(stream.state);
    return rng;
  }
  return createRNGStream(registry, streamId, seed);
}

/**
 * Serializes all RNG stream states for deterministic saves
 */
export function serializeRNGRegistry(registry: RNGRegistry): RNGStreamState[] {
  const states: RNGStreamState[] = [];
  for (const [streamId, state] of registry.streams) {
    states.push({
      streamId,
      state: new Uint32Array(state.state), // Copy the state
    });
  }
  return states;
}

/**
 * Deserializes RNG stream states from save data
 */
export function deserializeRNGRegistry(
  states: RNGStreamState[],
  globalSeed: number
): RNGRegistry {
  const registry: RNGRegistry = {
    streams: new Map(),
    globalSeed,
  };

  for (const state of states) {
    registry.streams.set(state.streamId, {
      streamId: state.streamId,
      state: new Uint32Array(state.state),
    });
  }

  return registry;
}

/**
 * Creates a default RNG registry with common streams
 */
export function createDefaultRNGRegistry(globalSeed: number): RNGRegistry {
  const registry: RNGRegistry = {
    streams: new Map(),
    globalSeed,
  };

  // Pre-create common streams
  const commonStreams = [
    'world-gen',
    'agent-spawn',
    'need-decay',
    'social-interaction',
    'work-assignment',
    'movement',
    'combat',
    'narrative',
    'loot',
    'weather',
  ];

  for (const streamId of commonStreams) {
    createRNGStream(registry, streamId);
  }

  return registry;
}

/**
 * RNG utility functions for common distributions
 */
export class RNGUtils {
  constructor(private rng: SeedRandom.prng) {}

  /** Random float in [0, 1) */
  nextFloat(): number {
    return this.rng();
  }

  /** Random float in [min, max) */
  nextFloatRange(min: number, max: number): number {
    return min + this.rng() * (max - min);
  }

  /** Random integer in [min, max] */
  nextInt(min: number, max: number): number {
    return Math.floor(this.rng() * (max - min + 1)) + min;
  }

  /** Random boolean with probability p */
  nextBool(p = 0.5): boolean {
    return this.rng() < p;
  }

  /** Random element from array */
  nextChoice<T>(array: readonly T[]): T {
    return array[this.nextInt(0, array.length - 1)];
  }

  /** Weighted random choice */
  nextWeightedChoice<T>(options: readonly { item: T; weight: number }[]): T {
    const totalWeight = options.reduce((sum, o) => sum + o.weight, 0);
    let random = this.rng() * totalWeight;

    for (const option of options) {
      random -= option.weight;
      if (random <= 0) return option.item;
    }

    return options[options.length - 1].item;
  }

  /** Gaussian/normal distribution (Box-Muller) */
  nextGaussian(mean = 0, stdDev = 1): number {
    const u1 = this.rng();
    const u2 = this.rng();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /** Shuffle array in place (Fisher-Yates) */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /** Sample n unique elements */
  sample<T>(array: readonly T[], n: number): T[] {
    const shuffled = this.shuffle([...array]);
    return shuffled.slice(0, Math.min(n, array.length));
  }
}

/**
 * Creates RNGUtils wrapper for a stream
 */
export function createRNGUtils(rng: SeedRandom.prng): RNGUtils {
  return new RNGUtils(rng);
}