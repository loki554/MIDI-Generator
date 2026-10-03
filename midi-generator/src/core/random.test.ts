import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed, hashString, mulberry32 } from './random'

const take = (n: number, f: () => number) => Array.from({ length: n }, f)

describe('mulberry32', () => {
  it('is deterministic for the same seed', () => {
    expect(take(20, mulberry32(42))).toEqual(take(20, mulberry32(42)))
  })

  it('differs between seeds', () => {
    expect(take(5, mulberry32(1))).not.toEqual(take(5, mulberry32(2)))
  })

  it('returns floats in [0, 1)', () => {
    for (const x of take(10_000, mulberry32(7))) {
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x).toBeLessThan(1)
    }
  })

  it('treats seeds as uint32', () => {
    expect(take(5, mulberry32(-1))).toEqual(take(5, mulberry32(0xffffffff)))
  })
})

describe('hashString / deriveSeed', () => {
  it('is stable', () => {
    expect(hashString('bass')).toBe(hashString('bass'))
    expect(deriveSeed(123, 'bass', 0)).toBe(deriveSeed(123, 'bass', 0))
  })

  it('gives different seeds per label and variant', () => {
    const seeds = new Set([
      deriveSeed(123, 'bass', 0),
      deriveSeed(123, 'bass', 1),
      deriveSeed(123, 'drums', 0),
      deriveSeed(124, 'bass', 0),
    ])
    expect(seeds.size).toBe(4)
  })

  it('returns uint32', () => {
    const s = deriveSeed(99, 'melody')
    expect(Number.isInteger(s)).toBe(true)
    expect(s).toBeGreaterThanOrEqual(0)
    expect(s).toBeLessThanOrEqual(0xffffffff)
  })
})

describe('Rng', () => {
  it('replays the same sequence of mixed calls', () => {
    const run = () => {
      const r = createRng(2024)
      return [r.int(1, 6), r.float(0, 10), r.chance(0.5), r.pick(['a', 'b', 'c']), r.gaussian(), r.shuffle([1, 2, 3, 4])]
    }
    expect(run()).toEqual(run())
  })

  it('int() covers the inclusive range uniformly', () => {
    const r = createRng(1)
    const counts = new Map<number, number>()
    for (let i = 0; i < 6000; i++) {
      const v = r.int(1, 6)
      counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    expect([...counts.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6])
    for (const c of counts.values()) expect(c).toBeGreaterThan(850)
  })

  it('int() accepts reversed bounds', () => {
    const r = createRng(3)
    for (let i = 0; i < 100; i++) {
      const v = r.int(5, 2)
      expect(v).toBeGreaterThanOrEqual(2)
      expect(v).toBeLessThanOrEqual(5)
    }
  })

  it('chance() respects the extremes', () => {
    const r = createRng(5)
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false)
      expect(r.chance(1)).toBe(true)
    }
  })

  it('weightedPick() follows the weights and skips zero weights', () => {
    const r = createRng(11)
    const counts = { a: 0, b: 0, c: 0 }
    for (let i = 0; i < 10_000; i++) counts[r.weightedPick([['a', 3], ['b', 1], ['c', 0]] as const)]++
    expect(counts.c).toBe(0)
    expect(counts.a / counts.b).toBeGreaterThan(2.5)
    expect(counts.a / counts.b).toBeLessThan(3.5)
  })

  it('weightedPick() throws without positive weights', () => {
    expect(() => createRng(1).weightedPick([['a', 0]])).toThrow()
  })

  it('weightedKey() picks keys of a weight map', () => {
    const r = createRng(8)
    for (let i = 0; i < 50; i++) expect(['up', 'down']).toContain(r.weightedKey({ up: 2, down: 1, flat: 0 }))
  })

  it('shuffle() returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = createRng(4).shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort()).toEqual(input)
  })

  it('gaussian() has roughly the requested mean and deviation', () => {
    const r = createRng(9)
    const xs = take(20_000, () => r.gaussian(10, 2))
    const mean = xs.reduce((s, x) => s + x, 0) / xs.length
    const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length)
    expect(mean).toBeCloseTo(10, 1)
    expect(sd).toBeCloseTo(2, 1)
  })

  it('fork() creates independent, reproducible streams', () => {
    const a = createRng(77).fork('drums')
    const b = createRng(77).fork('drums')
    const c = createRng(77).fork('bass')
    const seqA = take(5, () => a.next())
    expect(seqA).toEqual(take(5, () => b.next()))
    expect(seqA).not.toEqual(take(5, () => c.next()))
  })

  it('fork() does not depend on how much the parent was consumed', () => {
    const p1 = createRng(5)
    const p2 = createRng(5)
    p2.next()
    p2.next()
    expect(p1.fork('x').next()).toBe(p2.fork('x').next())
  })
})
