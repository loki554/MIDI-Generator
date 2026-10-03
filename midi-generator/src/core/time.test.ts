import { describe, expect, it } from 'vitest'
import { formatPosition, isCompound, steps16PerBar, ticksPerBar, ticksPerBeat, ticksToSeconds } from './time'
import { PPQ } from './types'

const FOUR = { numerator: 4, denominator: 4 }
const THREE = { numerator: 3, denominator: 4 }
const SIX_EIGHT = { numerator: 6, denominator: 8 }

describe('time', () => {
  it('computes beats and bars', () => {
    expect(ticksPerBeat(FOUR)).toBe(PPQ)
    expect(ticksPerBar(FOUR)).toBe(PPQ * 4)
    expect(ticksPerBar(THREE)).toBe(PPQ * 3)
    expect(ticksPerBeat(SIX_EIGHT)).toBe(PPQ / 2)
    expect(ticksPerBar(SIX_EIGHT)).toBe(PPQ * 3)
  })

  it('counts sixteenth steps per bar', () => {
    expect(steps16PerBar(FOUR)).toBe(16)
    expect(steps16PerBar(THREE)).toBe(12)
    expect(steps16PerBar(SIX_EIGHT)).toBe(12)
  })

  it('detects compound meters', () => {
    expect(isCompound(SIX_EIGHT)).toBe(true)
    expect(isCompound(FOUR)).toBe(false)
  })

  it('converts ticks to seconds', () => {
    expect(ticksToSeconds(PPQ, 120)).toBeCloseTo(0.5)
  })

  it('formats 1-based positions', () => {
    expect(formatPosition(0, FOUR)).toBe('1.1.1')
    expect(formatPosition(PPQ * 4 + PPQ + PPQ / 4, FOUR)).toBe('2.2.2')
  })
})
