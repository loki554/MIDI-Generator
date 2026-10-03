/**
 * Deterministic random numbers. Every generator takes an Rng built from a seed,
 * so the same settings + seed always produce the same pattern.
 */

/** mulberry32: small, fast 32-bit PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a 32-bit hash with a murmur3 finalizer for better bit mixing. */
export function hashString(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/**
 * Derives an independent sub-seed, e.g. `deriveSeed(seed, 'bass', 2)` for the
 * third regeneration of the bass part. Stable across runs and platforms.
 */
export function deriveSeed(seed: number, ...labels: Array<string | number>): number {
  return hashString(`${seed >>> 0}:${labels.join(':')}`)
}

/** Non-deterministic seed for "roll a new seed" in the UI. */
export function randomSeed(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0]
}

export interface Rng {
  /** Seed this generator was created with. */
  readonly seed: number
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** Float in [min, max). */
  float(min: number, max: number): number
  /** True with probability p (clamped to 0–1). */
  chance(p: number): boolean
  pick<T>(items: readonly T[]): T
  /** Picks from [item, weight] pairs; non-positive weights are never picked. */
  weightedPick<T>(entries: ReadonlyArray<readonly [T, number]>): T
  /** Picks a key of a weight map, e.g. `{ up: 2, down: 1 }`. */
  weightedKey<K extends string>(weights: Partial<Record<K, number>>): K
  /** Returns a shuffled copy. */
  shuffle<T>(items: readonly T[]): T[]
  /** Normally distributed value (Box–Muller). */
  gaussian(mean?: number, sd?: number): number
  /** Independent child generator for a labelled sub-task. */
  fork(...labels: Array<string | number>): Rng
}

export function createRng(seed: number): Rng {
  const next = mulberry32(seed)

  const rng: Rng = {
    seed: seed >>> 0,
    next,
    int: (min, max) => {
      const lo = Math.ceil(Math.min(min, max))
      const hi = Math.floor(Math.max(min, max))
      return lo + Math.floor(next() * (hi - lo + 1))
    },
    float: (min, max) => min + next() * (max - min),
    chance: (p) => next() < p,
    pick: (items) => {
      if (items.length === 0) throw new Error('pick() from an empty list')
      return items[Math.floor(next() * items.length)]
    },
    weightedPick: (entries) => {
      let total = 0
      for (const [, w] of entries) if (w > 0) total += w
      if (total <= 0) throw new Error('weightedPick() needs at least one positive weight')
      let r = next() * total
      for (const [item, w] of entries) {
        if (w <= 0) continue
        r -= w
        if (r < 0) return item
      }
      // Floating-point edge case: return the last positive entry.
      for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] > 0) return entries[i][0]
      throw new Error('unreachable')
    },
    weightedKey: <K extends string>(weights: Partial<Record<K, number>>) =>
      rng.weightedPick(Object.entries(weights) as Array<[K, number]>),
    shuffle: (items) => {
      const out = items.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    gaussian: (mean = 0, sd = 1) => {
      const u = 1 - next() // (0, 1] to avoid log(0)
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    fork: (...labels) => createRng(deriveSeed(seed, ...labels)),
  }
  return rng
}
