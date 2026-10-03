import { describe, expect, it } from 'vitest'
import { CHORD_QUALITIES, type Chord, type ChordExtension } from '../types'
import {
  CHORD_INTERVALS,
  chordContains,
  chordName,
  chordPitchClasses,
  diatonicChord,
  diatonicTriad,
  extendChord,
  invert,
  rootPosition,
  triadKind,
  voiceLead,
  voiceMovement,
  voicingCandidates,
} from './chords'
import { pitchClass } from './notes'
import { isInScale, prefersFlats } from './scales'

const names = (tonic: number, scale: Parameters<typeof diatonicChord>[1], ext: ChordExtension = 'triad') =>
  Array.from({ length: 7 }, (_, d) => chordName(diatonicChord(tonic, scale, d, ext), prefersFlats(tonic, scale)))

describe('chord tables', () => {
  it.each(CHORD_QUALITIES)('%s has intervals starting at the root', (q) => {
    expect(CHORD_INTERVALS[q][0]).toBe(0)
  })

  it('classifies triad kinds', () => {
    expect(triadKind('maj7')).toBe('maj')
    expect(triadKind('min9')).toBe('min')
    expect(triadKind('m7b5')).toBe('dim')
    expect(triadKind('sus4')).toBe('sus')
    expect(triadKind('power')).toBe('power')
    expect(triadKind('augMaj7')).toBe('aug')
  })
})

describe('diatonic chords', () => {
  it('builds the triads of C major', () => {
    expect(names(0, 'major')).toEqual(['C', 'Dm', 'Em', 'F', 'G', 'Am', 'B°'])
  })

  it('builds the sevenths of C major', () => {
    expect(names(0, 'major', 'seventh')).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5'])
  })

  it('builds the triads of A minor and its harmonic form', () => {
    expect(names(9, 'minor')).toEqual(['Am', 'B°', 'C', 'Dm', 'Em', 'F', 'G'])
    expect(names(9, 'harmonicMinor')).toEqual(['Am', 'B°', 'C+', 'Dm', 'E', 'F', 'G#°'])
  })

  it('uses the parent scale for pentatonic and blues harmony', () => {
    expect(names(9, 'minorPentatonic')).toEqual(names(9, 'minor'))
    expect(names(0, 'majorPentatonic')).toEqual(names(0, 'major'))
  })

  it('builds phrygian and phrygian dominant triads', () => {
    expect(names(4, 'phrygian')).toEqual(['Em', 'F', 'G', 'Am', 'B°', 'C', 'Dm'])
    expect(diatonicTriad(4, 'phrygianDominant', 0)).toEqual({ root: 4, quality: 'maj' })
  })

  it('wraps degrees beyond the octave', () => {
    expect(diatonicTriad(0, 'major', 7)).toEqual(diatonicTriad(0, 'major', 0))
    expect(diatonicTriad(0, 'major', -1)).toEqual(diatonicTriad(0, 'major', 6))
  })

  it('keeps every chord tone in the key for triads and sevenths of diatonic modes', () => {
    for (const scale of ['major', 'minor', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'locrian'] as const) {
      for (let d = 0; d < 7; d++) {
        for (const ext of ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth', 'add9', 'sus2', 'sus4'] as const) {
          const chord = diatonicChord(2, scale, d, ext)
          for (const pc of chordPitchClasses(chord)) expect(isInScale(pc, 2, scale)).toBe(true)
        }
      }
    }
  })
})

describe('extendChord', () => {
  it('adds extensions that fit the key', () => {
    expect(extendChord({ root: 7, quality: 'maj' }, 'ninth', 0, 'major')).toEqual({ root: 7, quality: 'dom9' })
    expect(extendChord({ root: 2, quality: 'min' }, 'eleventh', 0, 'major')).toEqual({ root: 2, quality: 'min11' })
    expect(extendChord({ root: 7, quality: 'maj' }, 'thirteenth', 0, 'major')).toEqual({ root: 7, quality: 'dom13' })
    expect(extendChord({ root: 0, quality: 'maj' }, 'add9', 0, 'major')).toEqual({ root: 0, quality: 'add9' })
    expect(extendChord({ root: 9, quality: 'min' }, 'add9', 0, 'major')).toEqual({ root: 9, quality: 'minAdd9' })
  })

  it('avoids clashing extensions', () => {
    // E minor in C major has an F (b9) above it: no 9th.
    expect(extendChord({ root: 4, quality: 'min' }, 'ninth', 0, 'major')).toEqual({ root: 4, quality: 'min7' })
    // F major in C major has a B (#4): no sus4.
    expect(extendChord({ root: 5, quality: 'maj' }, 'sus4', 0, 'major')).toEqual({ root: 5, quality: 'maj' })
  })

  it('makes borrowed and dominant chords sensible', () => {
    expect(extendChord({ root: 7, quality: 'maj' }, 'seventh', 9, 'harmonicMinor').quality).toBe('dom7')
    expect(extendChord({ root: 8, quality: 'maj' }, 'seventh', 0, 'major').quality).toBe('maj7') // bVI
    expect(extendChord({ root: 0, quality: 'maj' }, 'seventh', 0, 'mixolydian').quality).toBe('dom7')
  })

  it('turns any triad into a power chord', () => {
    expect(extendChord({ root: 11, quality: 'dim' }, 'power', 0, 'major')).toEqual({ root: 11, quality: 'power' })
  })

  it('leaves chords that already have extensions alone', () => {
    const chord: Chord = { root: 2, quality: 'min7' }
    expect(extendChord(chord, 'ninth', 0, 'major')).toBe(chord)
  })
})

describe('chord helpers', () => {
  it('names chords', () => {
    expect(chordName({ root: 10, quality: 'maj7' }, true)).toBe('Bbmaj7')
    expect(chordName({ root: 6, quality: 'm7b5' })).toBe('F#m7♭5')
    expect(chordName({ root: 4, quality: 'power' })).toBe('E5')
  })

  it('lists distinct pitch classes', () => {
    expect(chordPitchClasses({ root: 9, quality: 'min7' })).toEqual([9, 0, 4, 7])
    expect(chordContains({ root: 0, quality: 'maj' }, 64)).toBe(true)
    expect(chordContains({ root: 0, quality: 'maj' }, 65)).toBe(false)
  })

  it('builds root position and inversions', () => {
    expect(rootPosition({ root: 0, quality: 'maj' }, 4)).toEqual([60, 64, 67])
    expect(invert([60, 64, 67], 1)).toEqual([64, 67, 72])
    expect(invert([60, 64, 67], 2)).toEqual([67, 72, 76])
  })
})

describe('voicing and voice leading', () => {
  const range = { low: 52, high: 76, center: 62 }

  it('generates candidates inside the range containing every chord tone', () => {
    const chord: Chord = { root: 0, quality: 'maj7' }
    const candidates = voicingCandidates(chord, { ...range, allowOpen: true })
    expect(candidates.length).toBeGreaterThan(4)
    for (const v of candidates) {
      expect(Math.min(...v)).toBeGreaterThanOrEqual(range.low)
      expect(Math.max(...v)).toBeLessThanOrEqual(range.high)
      expect(new Set(v.map(pitchClass))).toEqual(new Set(chordPitchClasses(chord)))
    }
  })

  it('thins big chords to the voice limit, dropping the fifth', () => {
    const v = voiceLead(null, { root: 7, quality: 'dom13' }, { ...range, maxVoices: 5 })
    expect(v).toHaveLength(5)
    expect(v.map(pitchClass)).not.toContain(2) // D, the fifth of G
  })

  it('picks a voicing near the center without a previous chord', () => {
    const v = voiceLead(null, { root: 0, quality: 'maj' }, range)
    const avg = v.reduce((s, x) => s + x, 0) / v.length
    expect(Math.abs(avg - range.center)).toBeLessThanOrEqual(6)
  })

  it('moves smoothly through I–vi–IV–V', () => {
    const progression: Chord[] = [
      { root: 0, quality: 'maj' },
      { root: 9, quality: 'min' },
      { root: 5, quality: 'maj' },
      { root: 7, quality: 'maj' },
    ]
    let prev: number[] | null = null
    for (const chord of progression) {
      const v = voiceLead(prev, chord, range)
      if (prev) expect(voiceMovement(prev, v)).toBeLessThanOrEqual(5)
      prev = v
    }
  })

  it('keeps the common tones between C and Am', () => {
    const c = voiceLead(null, { root: 0, quality: 'maj' }, range)
    const am = voiceLead(c, { root: 9, quality: 'min' }, range)
    const common = c.filter((n) => am.includes(n))
    expect(common).toHaveLength(2)
  })

  it('falls back to root position when the range is too narrow', () => {
    expect(voiceLead(null, { root: 0, quality: 'maj' }, { low: 60, high: 62, center: 60 })).toEqual([60, 64, 67])
  })
})
