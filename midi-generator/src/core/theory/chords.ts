import type { Chord, ChordExtension, ChordQuality, PitchClass, ScaleId } from '../types'
import { midiOf, pitchClass, pitchClassName } from './notes'
import { SCALES } from './scales'

/** Semitones above the root for every chord quality. */
export const CHORD_INTERVALS: Record<ChordQuality, readonly number[]> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  power: [0, 7],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dom7: [0, 4, 7, 10],
  m7b5: [0, 3, 6, 10],
  dim7: [0, 3, 6, 9],
  minMaj7: [0, 3, 7, 11],
  augMaj7: [0, 4, 8, 11],
  add9: [0, 4, 7, 14],
  minAdd9: [0, 3, 7, 14],
  maj9: [0, 4, 7, 11, 14],
  min9: [0, 3, 7, 10, 14],
  dom9: [0, 4, 7, 10, 14],
  min11: [0, 3, 7, 10, 14, 17],
  maj13: [0, 4, 7, 11, 14, 21],
  dom13: [0, 4, 7, 10, 14, 21],
}

const CHORD_SYMBOLS: Record<ChordQuality, string> = {
  maj: '',
  min: 'm',
  dim: '°',
  aug: '+',
  sus2: 'sus2',
  sus4: 'sus4',
  power: '5',
  maj6: '6',
  min6: 'm6',
  maj7: 'maj7',
  min7: 'm7',
  dom7: '7',
  m7b5: 'm7♭5',
  dim7: '°7',
  minMaj7: 'm(maj7)',
  augMaj7: '+maj7',
  add9: 'add9',
  minAdd9: 'm(add9)',
  maj9: 'maj9',
  min9: 'm9',
  dom9: '9',
  min11: 'm11',
  maj13: 'maj13',
  dom13: '13',
}

export type TriadKind = 'maj' | 'min' | 'dim' | 'aug' | 'sus' | 'power'

/** The basic triad colour of a chord quality (used for Roman numerals and melody rules). */
export function triadKind(quality: ChordQuality): TriadKind {
  const [, third, fifth] = CHORD_INTERVALS[quality]
  if (quality === 'power') return 'power'
  if (third === 2 || third === 5) return 'sus'
  if (third === 3) return fifth === 6 ? 'dim' : 'min'
  return fifth === 8 ? 'aug' : 'maj'
}

export function chordIntervals(chord: Chord): readonly number[] {
  return CHORD_INTERVALS[chord.quality]
}

/** Distinct pitch classes of the chord, root first. */
export function chordPitchClasses(chord: Chord): PitchClass[] {
  const out: PitchClass[] = []
  for (const i of CHORD_INTERVALS[chord.quality]) {
    const pc = pitchClass(chord.root + i)
    if (!out.includes(pc)) out.push(pc)
  }
  return out
}

export function chordContains(chord: Chord, midi: number): boolean {
  return chordPitchClasses(chord).includes(pitchClass(midi))
}

/** "Am7", "F#m7♭5", "Bb" … */
export function chordName(chord: Chord, preferFlats = false): string {
  return pitchClassName(chord.root, preferFlats) + CHORD_SYMBOLS[chord.quality]
}

/** Root-position chord with its root in the given octave (C4 = 60). */
export function rootPosition(chord: Chord, octave: number): number[] {
  const root = midiOf(chord.root, octave)
  return CHORD_INTERVALS[chord.quality].map((i) => root + i)
}

/** Raises the lowest note an octave `n` times (1 = first inversion). */
export function invert(pitches: readonly number[], n: number): number[] {
  const out = [...pitches].sort((a, b) => a - b)
  for (let k = 0; k < n; k++) {
    const low = out.shift()!
    out.push(low + 12)
  }
  return out
}

/* ---------- Diatonic chords ---------- */

const TRIAD_BY_INTERVALS: Record<string, ChordQuality> = {
  '4,7': 'maj',
  '3,7': 'min',
  '3,6': 'dim',
  '4,8': 'aug',
}

/** Semitones from the root at `degree` to the note `steps` scale steps above it. */
function diatonicInterval(scale: ScaleId, degree: number, steps: number): number {
  const iv = SCALES[scale].intervals
  const len = iv.length
  const from = iv[((degree % len) + len) % len]
  const target = degree + steps
  const to = iv[((target % len) + len) % len] + 12 * Math.floor(target / len)
  return to - from - 12 * Math.floor(degree / len)
}

/**
 * Triad built by stacking thirds on a 0-based scale degree. Pentatonic and blues
 * scales use the harmony of their parent seven-note scale.
 */
export function diatonicTriad(tonic: PitchClass, scale: ScaleId, degree: number): Chord {
  const harmony = SCALES[scale].harmony
  const len = SCALES[harmony].intervals.length
  const d = ((degree % len) + len) % len
  const root = pitchClass(tonic + SCALES[harmony].intervals[d])
  const third = diatonicInterval(harmony, d, 2)
  const fifth = diatonicInterval(harmony, d, 4)
  const quality = TRIAD_BY_INTERVALS[`${third},${fifth}`] ?? (third >= 4 ? 'maj' : 'min')
  return { root, quality }
}

const PLAIN_TRIADS: ReadonlySet<ChordQuality> = new Set(['maj', 'min', 'dim', 'aug'])

/**
 * Extends a plain triad (maj/min/dim/aug) using notes of the key where possible,
 * so that e.g. a seventh on V in a major key becomes a dominant 7th and on I a maj7.
 * Chords that already carry extensions are returned unchanged.
 */
export function extendChord(chord: Chord, extension: ChordExtension, tonic: PitchClass, scale: ScaleId): Chord {
  if (!PLAIN_TRIADS.has(chord.quality) || extension === 'triad') return chord
  const harmony = SCALES[scale].harmony
  const inKey = (semitonesAboveRoot: number) =>
    SCALES[harmony].intervals.includes(pitchClass(chord.root + semitonesAboveRoot - tonic))
  const q = chord.quality
  const withQuality = (quality: ChordQuality): Chord => ({ root: chord.root, quality })

  switch (extension) {
    case 'power':
      return withQuality('power')
    case 'sus2':
      return q !== 'dim' && q !== 'aug' && inKey(2) ? withQuality('sus2') : chord
    case 'sus4':
      return q !== 'dim' && q !== 'aug' && inKey(5) ? withQuality('sus4') : chord
    case 'add9':
      if (!inKey(2)) return chord
      return q === 'maj' ? withQuality('add9') : q === 'min' ? withQuality('minAdd9') : chord
    default:
      break
  }

  // Seventh first; ninth/eleventh/thirteenth build on it.
  let seventh: ChordQuality
  if (q === 'maj') {
    // Prefer the 7th the key provides; for borrowed chords use dom7 only on V.
    const isDominantRoot = pitchClass(chord.root - tonic) === 7
    seventh = inKey(11) ? 'maj7' : inKey(10) || isDominantRoot ? 'dom7' : 'maj7'
  } else if (q === 'min') {
    seventh = inKey(11) && !inKey(10) ? 'minMaj7' : 'min7'
  } else if (q === 'dim') {
    seventh = inKey(9) && !inKey(10) ? 'dim7' : 'm7b5'
  } else {
    seventh = inKey(11) ? 'augMaj7' : 'aug'
  }
  if (extension === 'seventh') return withQuality(seventh)

  const ninthInKey = inKey(2)
  const ninth: ChordQuality | null = !ninthInKey
    ? null
    : seventh === 'maj7'
      ? 'maj9'
      : seventh === 'dom7'
        ? 'dom9'
        : seventh === 'min7'
          ? 'min9'
          : null
  if (!ninth) return withQuality(seventh)
  if (extension === 'ninth') return withQuality(ninth)
  if (extension === 'eleventh') return withQuality(ninth === 'min9' && inKey(5) ? 'min11' : ninth)
  // thirteenth
  if (inKey(9) && ninth === 'dom9') return withQuality('dom13')
  if (inKey(9) && ninth === 'maj9') return withQuality('maj13')
  return withQuality(ninth)
}

/** Diatonic chord on a degree with the requested extension. */
export function diatonicChord(
  tonic: PitchClass,
  scale: ScaleId,
  degree: number,
  extension: ChordExtension = 'triad',
): Chord {
  return extendChord(diatonicTriad(tonic, scale, degree), extension, tonic, scale)
}

/* ---------- Voicing & voice leading ---------- */

export interface VoicingOptions {
  /** Lowest allowed MIDI note. */
  low: number
  /** Highest allowed MIDI note. */
  high: number
  /** Preferred average pitch; keeps voicings from drifting. */
  center: number
  /** Also consider drop-2 (open) voicings. */
  allowOpen?: boolean
  /** Maximum voices; extra tones are dropped (fifth first). Default 5. */
  maxVoices?: number
}

/** Chord tones to voice, thinning large chords by dropping the fifth first. */
function voicedPitchClasses(chord: Chord, maxVoices: number): PitchClass[] {
  const pcs = chordPitchClasses(chord)
  if (pcs.length <= maxVoices) return pcs
  const fifth = pitchClass(chord.root + 7)
  const thinned = pcs.filter((pc) => pc !== fifth)
  return thinned.slice(0, maxVoices)
}

/** Close-position stack of pitch classes starting from `bottom`, each above the previous. */
function stackAbove(pcs: readonly PitchClass[], bottom: number): number[] {
  const out = [bottom]
  for (let i = 1; i < pcs.length; i++) {
    let n = out[i - 1] + 1
    while (pitchClass(n) !== pcs[i]) n++
    out.push(n)
  }
  return out
}

/** Every close (and optionally drop-2) voicing of the chord that fits in [low, high]. */
export function voicingCandidates(chord: Chord, opts: VoicingOptions): number[][] {
  const pcs = voicedPitchClasses(chord, opts.maxVoices ?? 5)
  const out: number[][] = []
  for (let inv = 0; inv < pcs.length; inv++) {
    const rotated = [...pcs.slice(inv), ...pcs.slice(0, inv)]
    for (let bottom = opts.low; bottom <= opts.high; bottom++) {
      if (pitchClass(bottom) !== rotated[0]) continue
      const close = stackAbove(rotated, bottom)
      if (close[close.length - 1] > opts.high) break
      out.push(close)
      if (opts.allowOpen && close.length >= 4) {
        const drop2 = [...close]
        drop2[drop2.length - 2] -= 12
        drop2.sort((a, b) => a - b)
        if (drop2[0] >= opts.low) out.push(drop2)
      }
    }
  }
  return out
}

/** Total motion between two voicings: each note travels to its nearest counterpart. */
export function voiceMovement(a: readonly number[], b: readonly number[]): number {
  const nearest = (n: number, set: readonly number[]) => Math.min(...set.map((m) => Math.abs(m - n)))
  let cost = 0
  for (const n of a) cost += nearest(n, b)
  for (const n of b) cost += nearest(n, a)
  return cost / 2
}

const average = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / xs.length

/**
 * Chooses the voicing of `chord` that moves least from `previous` (smooth voice
 * leading), while staying near `center`. Without a previous voicing, picks the one
 * closest to `center`, preferring root position.
 */
export function voiceLead(previous: readonly number[] | null, chord: Chord, opts: VoicingOptions): number[] {
  const candidates = voicingCandidates(chord, opts)
  if (candidates.length === 0) {
    // Range too narrow for the full chord: fall back to the root position nearest the center.
    return rootPosition(chord, Math.floor(opts.center / 12) - 1)
  }
  let best = candidates[0]
  let bestCost = Infinity
  for (const c of candidates) {
    const drift = Math.abs(average(c) - opts.center)
    const rootBonus = pitchClass(c[0]) === chord.root ? 0 : 1
    const cost = previous && previous.length > 0 ? voiceMovement(previous, c) + drift * 0.35 : drift + rootBonus * 2
    if (cost < bestCost) {
      bestCost = cost
      best = c
    }
  }
  return best
}
