import { describe, expect, it } from 'vitest'
import { SCALE_IDS } from '../types'
import {
  SCALES,
  degreeToMidi,
  isInScale,
  keyName,
  prefersFlats,
  scaleDegreeOf,
  scaleNotesInRange,
  scalePitchClasses,
  snapToScale,
  stepInScale,
} from './scales'

describe('scale definitions', () => {
  it.each(SCALE_IDS)('%s has ascending intervals within an octave, starting at 0', (id) => {
    const { intervals, harmony } = SCALES[id]
    expect(intervals[0]).toBe(0)
    for (let i = 1; i < intervals.length; i++) expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
    expect(intervals[intervals.length - 1]).toBeLessThan(12)
    expect(SCALES[harmony].intervals).toHaveLength(7)
  })

  it.each(['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] as const)(
    '%s is a mode of the major scale with the right majorOffset',
    (id) => {
      // E.g. D dorian (offset 2) has the same notes as C major.
      const byNumber = (a: number, b: number) => a - b
      expect(scalePitchClasses(SCALES[id].majorOffset, id).sort(byNumber)).toEqual(
        scalePitchClasses(0, 'major').sort(byNumber),
      )
    },
  )

  it('has the expected pitch classes', () => {
    expect(scalePitchClasses(0, 'major')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(scalePitchClasses(9, 'minor')).toEqual([9, 11, 0, 2, 4, 5, 7])
    expect(scalePitchClasses(4, 'phrygianDominant')).toEqual([4, 5, 8, 9, 11, 0, 2])
    expect(scalePitchClasses(9, 'blues')).toEqual([9, 0, 2, 3, 4, 7])
  })
})

describe('scale helpers', () => {
  it('checks membership', () => {
    expect(isInScale(60, 0, 'major')).toBe(true)
    expect(isInScale(61, 0, 'major')).toBe(false)
    expect(isInScale(70, 0, 'mixolydian')).toBe(true)
  })

  it('finds degrees', () => {
    expect(scaleDegreeOf(67, 0, 'major')).toBe(4)
    expect(scaleDegreeOf(66, 0, 'major')).toBeNull()
  })

  it('wraps degrees into neighbouring octaves', () => {
    expect(degreeToMidi(0, 60, 'major')).toBe(60)
    expect(degreeToMidi(7, 60, 'major')).toBe(72)
    expect(degreeToMidi(-1, 60, 'major')).toBe(59)
    expect(degreeToMidi(9, 57, 'minor')).toBe(72) // A minor: degree 9 = C5
    expect(degreeToMidi(5, 57, 'minorPentatonic')).toBe(69)
  })

  it('snaps to the scale', () => {
    expect(snapToScale(61, 0, 'major')).toBe(60)
    expect(snapToScale(61, 0, 'major', 'up')).toBe(62)
    expect(snapToScale(66, 0, 'major', 'down')).toBe(65)
    expect(snapToScale(64, 0, 'major')).toBe(64)
  })

  it('steps through the scale', () => {
    expect(stepInScale(60, 2, 0, 'major')).toBe(64)
    expect(stepInScale(60, -1, 0, 'major')).toBe(59)
    expect(stepInScale(72, 7, 0, 'major')).toBe(84)
    expect(stepInScale(69, 1, 9, 'minorPentatonic')).toBe(72)
  })

  it('lists scale notes in a range', () => {
    expect(scaleNotesInRange(0, 'major', 60, 72)).toEqual([60, 62, 64, 65, 67, 69, 71, 72])
  })

  it('spells keys with sharps or flats', () => {
    expect(prefersFlats(5, 'major')).toBe(true) // F major
    expect(prefersFlats(2, 'minor')).toBe(true) // D minor
    expect(prefersFlats(6, 'minor')).toBe(false) // F# minor
    expect(keyName(3, 'minor')).toBe('Eb')
    expect(keyName(8, 'minor')).toBe('G#')
    expect(keyName(7, 'dorian')).toBe('G') // G dorian → F major
    expect(prefersFlats(7, 'dorian')).toBe(true)
  })
})
