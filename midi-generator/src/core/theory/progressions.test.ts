import { describe, expect, it } from 'vitest'
import { createRng } from '../random'
import { chordName } from './chords'
import {
  MARKOV_MAJOR,
  MARKOV_MINOR,
  PROGRESSION_PRESETS,
  degreesToChords,
  getProgressionPreset,
  markovProgression,
  parseRoman,
  resolveProgression,
  romanNumeral,
  scaleFit,
} from './progressions'

describe('parseRoman', () => {
  it('parses basic numerals in C', () => {
    expect(parseRoman('I', 0)).toEqual({ root: 0, quality: 'maj' })
    expect(parseRoman('vi', 0)).toEqual({ root: 9, quality: 'min' })
    expect(parseRoman('vii°', 0)).toEqual({ root: 11, quality: 'dim' })
    expect(parseRoman('III+', 0)).toEqual({ root: 4, quality: 'aug' })
  })

  it('parses accidentals relative to the major scale', () => {
    expect(parseRoman('bVII', 0)).toEqual({ root: 10, quality: 'maj' })
    expect(parseRoman('bIII', 9)).toEqual({ root: 0, quality: 'maj' }) // C in A minor
    expect(parseRoman('#iv°', 0)).toEqual({ root: 6, quality: 'dim' })
    expect(parseRoman('♭II', 4)).toEqual({ root: 5, quality: 'maj' })
  })

  it('parses suffixes', () => {
    expect(parseRoman('V7', 0)?.quality).toBe('dom7')
    expect(parseRoman('ii7', 0)?.quality).toBe('min7')
    expect(parseRoman('Imaj7', 0)?.quality).toBe('maj7')
    expect(parseRoman('iiø7', 0)?.quality).toBe('m7b5')
    expect(parseRoman('vii°7', 0)?.quality).toBe('dim7')
    expect(parseRoman('Isus4', 0)?.quality).toBe('sus4')
    expect(parseRoman('i5', 0)?.quality).toBe('power')
    expect(parseRoman('V9', 0)?.quality).toBe('dom9')
  })

  it('rejects invalid numerals', () => {
    expect(parseRoman('VIII', 0)).toBeNull()
    expect(parseRoman('Vi', 0)).toBeNull()
    expect(parseRoman('iiø', 0)).toBeNull()
    expect(parseRoman('V11', 0)).toBeNull()
    expect(parseRoman('X', 0)).toBeNull()
  })

  it('round-trips through romanNumeral', () => {
    for (const n of ['I', 'ii7', 'V7', 'bVII', 'iiø7', 'vii°', 'Imaj7', 'bVImaj7', 'I5', 'IVsus2']) {
      expect(romanNumeral(parseRoman(n, 5)!, 5)).toBe(n)
    }
  })
})

describe('presets', () => {
  it('have unique ids', () => {
    expect(new Set(PROGRESSION_PRESETS.map((p) => p.id)).size).toBe(PROGRESSION_PRESETS.length)
  })

  it.each(PROGRESSION_PRESETS.map((p) => [p.id, p] as const))('%s parses in every key', (_, preset) => {
    for (let tonic = 0; tonic < 12; tonic++) {
      for (const n of preset.numerals) expect(parseRoman(n, tonic)).not.toBeNull()
    }
  })

  it('looks presets up by id', () => {
    expect(getProgressionPreset('axis')?.numerals).toEqual(['I', 'V', 'vi', 'IV'])
    expect(getProgressionPreset('nope')).toBeUndefined()
  })

  it('resolves numerals and applies the extension to plain triads only', () => {
    const chords = resolveProgression(['I', 'V', 'vi', 'IV'], 7, 'major', 'seventh')
    expect(chords.map((c) => chordName(c))).toEqual(['Gmaj7', 'D7', 'Em7', 'Cmaj7'])
    const jazz = resolveProgression(['ii7', 'V7', 'Imaj7'], 0, 'major', 'ninth')
    expect(jazz.map((c) => c.quality)).toEqual(['min7', 'dom7', 'maj7'])
  })

  it('throws on invalid numerals', () => {
    expect(() => resolveProgression(['I', 'Q'], 0, 'major')).toThrow()
  })

  it('measures how well chords fit a scale', () => {
    expect(scaleFit(resolveProgression(['I', 'V', 'vi', 'IV'], 0, 'major'), 0, 'major')).toBe(1)
    expect(scaleFit(resolveProgression(['i', 'bII'], 0, 'major'), 0, 'major')).toBeLessThan(0.7)
  })
})

describe('markovProgression', () => {
  it('is deterministic for a seed', () => {
    const run = () => markovProgression(createRng(31), 8, { family: 'major' })
    expect(run()).toEqual(run())
  })

  it('has the requested length and starts on the tonic', () => {
    for (const length of [1, 2, 4, 8, 16]) {
      const degrees = markovProgression(createRng(length), length, { family: 'minor' })
      expect(degrees).toHaveLength(length)
      expect(degrees[0]).toBe(0)
    }
    expect(markovProgression(createRng(1), 0, { family: 'major' })).toEqual([])
  })

  it('never repeats a chord back to back, including the loop point', () => {
    for (let seed = 0; seed < 200; seed++) {
      const degrees = markovProgression(createRng(seed), 4, { family: seed % 2 ? 'major' : 'minor' })
      for (let i = 1; i < degrees.length; i++) expect(degrees[i]).not.toBe(degrees[i - 1])
      expect(degrees[degrees.length - 1]).not.toBe(degrees[0])
    }
  })

  it('only uses transitions with positive weight', () => {
    for (let seed = 0; seed < 200; seed++) {
      const family = seed % 2 ? 'major' : 'minor'
      const matrix = family === 'major' ? MARKOV_MAJOR : MARKOV_MINOR
      const degrees = markovProgression(createRng(seed), 8, { family, cadence: 'none' })
      for (let i = 1; i < degrees.length; i++) expect(matrix[degrees[i - 1]][degrees[i]]).toBeGreaterThan(0)
    }
  })

  it('ends V → I with an authentic cadence', () => {
    for (let seed = 0; seed < 50; seed++) {
      const degrees = markovProgression(createRng(seed), 6, { family: 'major', cadence: 'authentic' })
      expect(degrees.slice(-2)).toEqual([4, 0])
      expect(degrees[3]).not.toBe(4)
    }
  })

  it('applies weight modifiers', () => {
    // Forbid everything except IV: the chain must alternate I and IV.
    const degrees = markovProgression(createRng(3), 6, {
      family: 'major',
      cadence: 'none',
      modifyWeight: (from, to, w) => (to === 3 || (from === 3 && to === 0) ? w : 0),
    })
    expect(degrees).toEqual([0, 3, 0, 3, 0, 3])
  })

  it('still produces a progression when a modifier zeroes every option', () => {
    const degrees = markovProgression(createRng(3), 4, { family: 'major', modifyWeight: () => 0 })
    expect(degrees).toHaveLength(4)
  })
})

describe('degreesToChords', () => {
  it('turns degrees into diatonic chords', () => {
    expect(degreesToChords([0, 5, 3, 4], 0, 'major').map((c) => chordName(c))).toEqual(['C', 'Am', 'F', 'G'])
  })

  it('can raise the minor dominant', () => {
    const plain = degreesToChords([0, 4], 9, 'minor')
    const raised = degreesToChords([0, 4], 9, 'minor', 'seventh', true)
    expect(plain.map((c) => chordName(c))).toEqual(['Am', 'Em'])
    expect(raised.map((c) => chordName(c))).toEqual(['Am7', 'E7'])
  })
})
