import { describe, expect, it } from 'vitest'
import type { Note } from '../core/types'
import { gridInWindow, notesInWindow, segmentsBetween, wrapTick } from './timeline'

const loop = { start: 0, end: 1000 }
const note = (start: number, duration = 100): Note => ({ id: String(start), pitch: 60, start, duration, velocity: 100 })

describe('timeline', () => {
  it('wraps ticks into the loop', () => {
    expect(wrapTick(250, loop)).toBe(250)
    expect(wrapTick(1250, loop)).toBe(250)
    expect(wrapTick(3000, loop)).toBe(0)
    expect(wrapTick(1250, null)).toBe(1250)
    expect(wrapTick(1500, { start: 1000, end: 2000 })).toBe(1500)
    expect(wrapTick(2500, { start: 1000, end: 2000 })).toBe(1500)
  })

  it('splits windows at the loop end', () => {
    expect(segmentsBetween(900, 1100, loop)).toEqual([
      { start: 900, end: 1000, offset: 0 },
      { start: 0, end: 100, offset: 1000 },
    ])
    expect(segmentsBetween(0, 2500, loop)).toHaveLength(3)
    expect(segmentsBetween(100, 100, loop)).toEqual([])
    expect(segmentsBetween(900, 1100, null)).toEqual([{ start: 900, end: 1100, offset: 0 }])
  })

  it('finds notes across the loop point without duplicates or gaps', () => {
    const notes = [note(0), note(500), note(950, 200)]
    // Scan 3 loops in uneven windows: every note must appear exactly once per loop.
    const seen: number[] = []
    for (let from = 0; from < 3000; from += 137) {
      for (const s of notesInWindow(notes, from, Math.min(3000, from + 137), loop)) seen.push(s.at)
    }
    expect(seen.sort((a, b) => a - b)).toEqual([0, 500, 950, 1000, 1500, 1950, 2000, 2500, 2950])
  })

  it('cuts notes at the loop end', () => {
    const [scheduled] = notesInWindow([note(950, 200)], 900, 1000, loop)
    expect(scheduled.duration).toBe(50)
  })

  it('lists grid lines such as metronome beats', () => {
    expect(gridInWindow(480, 0, 1500, { start: 0, end: 960 }).map((g) => [g.at, g.tick])).toEqual([
      [0, 0],
      [480, 480],
      [960, 0],
      [1440, 480],
    ])
  })
})
