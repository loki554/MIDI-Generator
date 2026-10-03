import type { Rng } from '../random'
import type { Chord, ChordExtension, ChordQuality, PitchClass, ScaleId } from '../types'
import { diatonicTriad, extendChord, triadKind } from './chords'
import { pitchClass } from './notes'
import { SCALES } from './scales'

/* ---------- Roman numerals ---------- */

/**
 * Roman numerals are relative to the major scale of the tonic, with accidentals
 * for borrowed degrees: in a minor key the relative-major chord is "bIII".
 */
const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11]
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'] as const

type Triad = 'maj' | 'min' | 'dim' | 'aug' | 'half'

/** Quality for a numeral's triad type and suffix, or undefined if the combination is invalid. */
function qualityFor(triad: Triad, suffix: string): ChordQuality | undefined {
  const table: Record<string, Partial<Record<Triad, ChordQuality>>> = {
    '': { maj: 'maj', min: 'min', dim: 'dim', aug: 'aug' },
    '7': { maj: 'dom7', min: 'min7', dim: 'dim7', half: 'm7b5', aug: 'aug' },
    maj7: { maj: 'maj7', min: 'minMaj7', aug: 'augMaj7' },
    M7: { maj: 'maj7', min: 'minMaj7', aug: 'augMaj7' },
    '6': { maj: 'maj6', min: 'min6' },
    add9: { maj: 'add9', min: 'minAdd9' },
    '9': { maj: 'dom9', min: 'min9' },
    maj9: { maj: 'maj9' },
    '11': { min: 'min11' },
    '13': { maj: 'dom13' },
    maj13: { maj: 'maj13' },
    sus2: { maj: 'sus2', min: 'sus2' },
    sus4: { maj: 'sus4', min: 'sus4' },
    '5': { maj: 'power', min: 'power' },
  }
  return table[suffix]?.[triad]
}

/**
 * Parses a Roman numeral such as "vi", "bVII", "V7", "iiø7", "IVmaj7", "#iv°",
 * "Isus4" or "i5" into a chord in the given key. Returns null if invalid.
 */
export function parseRoman(numeral: string, tonic: PitchClass): Chord | null {
  const m = /^([b#♭♯]?)(vii|vi|iv|v|iii|ii|i)(°|ø|\+)?(.*)$/i.exec(numeral.trim())
  if (!m) return null
  const [, accidental, roman, symbol = '', suffix] = m
  const upper = roman === roman.toUpperCase()
  if (!upper && roman !== roman.toLowerCase()) return null
  const index = NUMERALS.indexOf(roman.toUpperCase() as (typeof NUMERALS)[number])
  const shift = accidental === 'b' || accidental === '♭' ? -1 : accidental ? 1 : 0

  let triad: Triad = upper ? 'maj' : 'min'
  if (symbol === '°') triad = 'dim'
  else if (symbol === 'ø') triad = 'half'
  else if (symbol === '+') triad = 'aug'
  if (triad === 'half' && suffix !== '7') return null

  const quality = qualityFor(triad, suffix)
  if (!quality) return null
  return { root: pitchClass(tonic + MAJOR_STEPS[index] + shift), quality }
}

const ROMAN_BY_OFFSET = ['I', 'bII', 'II', 'bIII', 'III', 'IV', 'bV', 'V', 'bVI', 'VI', 'bVII', 'VII']

const ROMAN_SUFFIX: Partial<Record<ChordQuality, string>> = {
  dim: '°',
  aug: '+',
  sus2: 'sus2',
  sus4: 'sus4',
  power: '5',
  maj6: '6',
  min6: '6',
  maj7: 'maj7',
  min7: '7',
  dom7: '7',
  m7b5: 'ø7',
  dim7: '°7',
  minMaj7: 'maj7',
  augMaj7: '+maj7',
  add9: 'add9',
  minAdd9: 'add9',
  maj9: 'maj9',
  min9: '9',
  dom9: '9',
  min11: '11',
  maj13: 'maj13',
  dom13: '13',
}

/** Roman numeral of a chord relative to `tonic`, e.g. "bVII", "ii7", "viiø7". */
export function romanNumeral(chord: Chord, tonic: PitchClass): string {
  const base = ROMAN_BY_OFFSET[pitchClass(chord.root - tonic)]
  const kind = triadKind(chord.quality)
  const lower = kind === 'min' || kind === 'dim'
  const numeral = lower ? base.toLowerCase() : base
  return numeral + (ROMAN_SUFFIX[chord.quality] ?? '')
}

/* ---------- Presets ---------- */

export interface ProgressionPreset {
  id: string
  numerals: readonly string[]
  /** Tonic colour the progression is written for. */
  family: 'major' | 'minor'
}

export const PROGRESSION_PRESETS: readonly ProgressionPreset[] = [
  // Major
  { id: 'axis', numerals: ['I', 'V', 'vi', 'IV'], family: 'major' },
  { id: 'sensitive', numerals: ['vi', 'IV', 'I', 'V'], family: 'major' },
  { id: 'doowop', numerals: ['I', 'vi', 'IV', 'V'], family: 'major' },
  { id: 'royalRoad', numerals: ['IV', 'V', 'iii', 'vi'], family: 'major' },
  { id: 'classicRock', numerals: ['I', 'IV', 'V', 'IV'], family: 'major' },
  { id: 'mixolydianRock', numerals: ['I', 'bVII', 'IV', 'I'], family: 'major' },
  { id: 'stoner', numerals: ['I', 'bIII', 'IV', 'I'], family: 'major' },
  { id: 'romantic', numerals: ['I', 'iii', 'IV', 'iv'], family: 'major' },
  { id: 'lydianFloat', numerals: ['I', 'II', 'I', 'II'], family: 'major' },
  { id: 'jazzTwoFiveOne', numerals: ['ii7', 'V7', 'Imaj7', 'Imaj7'], family: 'major' },
  { id: 'jazzTurnaround', numerals: ['Imaj7', 'vi7', 'ii7', 'V7'], family: 'major' },
  { id: 'lofiDescent', numerals: ['IVmaj7', 'iii7', 'ii7', 'Imaj7'], family: 'major' },
  { id: 'funkVamp', numerals: ['I7', 'I7', 'IV7', 'IV7'], family: 'major' },
  {
    id: 'twelveBar',
    numerals: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
    family: 'major',
  },
  // Minor
  { id: 'epicMinor', numerals: ['i', 'bVI', 'bIII', 'bVII'], family: 'minor' },
  { id: 'classicMinor', numerals: ['i', 'iv', 'v', 'i'], family: 'minor' },
  { id: 'andalusian', numerals: ['i', 'bVII', 'bVI', 'V'], family: 'minor' },
  { id: 'minorPlagal', numerals: ['i', 'iv', 'bVII', 'bIII'], family: 'minor' },
  { id: 'harmonicMinor', numerals: ['i', 'bVI', 'iv', 'V'], family: 'minor' },
  { id: 'minorDescent', numerals: ['i', 'v', 'bVI', 'iv'], family: 'minor' },
  { id: 'dorianVamp', numerals: ['i', 'IV', 'i', 'IV'], family: 'minor' },
  { id: 'minorVamp', numerals: ['i7', 'iv7', 'i7', 'iv7'], family: 'minor' },
  { id: 'lofiMinor', numerals: ['i7', 'iv7', 'bVIImaj7', 'bIIImaj7'], family: 'minor' },
  { id: 'jazzMinorTwoFive', numerals: ['iiø7', 'V7', 'i7', 'i7'], family: 'minor' },
  { id: 'phrygianMetal', numerals: ['i', 'bII', 'i', 'bII'], family: 'minor' },
  { id: 'metalRise', numerals: ['i', 'bVI', 'bVII', 'i'], family: 'minor' },
  { id: 'doom', numerals: ['i', 'i', 'bII', 'i'], family: 'minor' },
  { id: 'tritone', numerals: ['i', 'bV', 'i', 'bII'], family: 'minor' },
  { id: 'chromaticTension', numerals: ['i', 'bII', 'bIII', 'bII'], family: 'minor' },
  { id: 'ambientMinor', numerals: ['i', 'bVI', 'i', 'bVI'], family: 'minor' },
]

export function getProgressionPreset(id: string): ProgressionPreset | undefined {
  return PROGRESSION_PRESETS.find((p) => p.id === id)
}

/** Resolves Roman numerals to chords, extending plain triads with `extension`. */
export function resolveProgression(
  numerals: readonly string[],
  tonic: PitchClass,
  scale: ScaleId,
  extension: ChordExtension = 'triad',
): Chord[] {
  return numerals.map((n) => {
    const chord = parseRoman(n, tonic)
    if (!chord) throw new Error(`Invalid Roman numeral: ${n}`)
    return extendChord(chord, extension, tonic, scale)
  })
}

/** Share (0–1) of chord tones that belong to the scale; for picking presets that suit a key. */
export function scaleFit(chords: readonly Chord[], tonic: PitchClass, scale: ScaleId): number {
  const { intervals } = SCALES[scale]
  let total = 0
  let inside = 0
  for (const chord of chords) {
    for (const pc of [0, triadKind(chord.quality) === 'min' ? 3 : 4, 7]) {
      total++
      if (intervals.includes(pitchClass(chord.root + pc - tonic))) inside++
    }
  }
  return total === 0 ? 1 : inside / total
}

/* ---------- Markov chain ---------- */

/**
 * Transition weights between scale degrees (row = from, column = to), following
 * functional harmony: tonic → subdominant/dominant → tonic.
 */
export const MARKOV_MAJOR: readonly (readonly number[])[] = [
  //  I    ii   iii  IV   V    vi   vii°
  [0, 2, 1, 4, 4, 3, 0.3], // I
  [0.5, 0, 0.5, 1, 5, 0.5, 0.5], // ii
  [0.5, 0.5, 0, 2, 0.5, 4, 0], // iii
  [2.5, 1, 0.5, 0, 4, 1.5, 0.3], // IV
  [5, 0.3, 0.5, 1.5, 0, 3, 0], // V
  [1, 3, 0.5, 4, 2, 0, 0.2], // vi
  [5, 0, 1, 0, 0.5, 1, 0], // vii°
]

export const MARKOV_MINOR: readonly (readonly number[])[] = [
  //  i    ii°  III  iv   v    VI   VII
  [0, 0.5, 2.5, 3, 2, 3.5, 3], // i
  [1, 0, 0.5, 0.5, 4, 0.5, 0.5], // ii°
  [1.5, 0, 0, 2, 1, 3, 3], // III
  [2.5, 0.5, 1, 0, 3, 1.5, 2.5], // iv
  [4, 0, 0.5, 1.5, 0, 2.5, 1], // v
  [2, 0.5, 2.5, 2.5, 1.5, 0, 4], // VI
  [3.5, 0, 3, 1, 0.5, 1.5, 0], // VII
]

export type Cadence = 'loop' | 'authentic' | 'none'

export interface MarkovOptions {
  family: 'major' | 'minor'
  /** First degree (default 0, the tonic). */
  start?: number
  /**
   * 'loop': the last chord leads smoothly back to the first;
   * 'authentic': ends V → I; 'none': free.
   */
  cadence?: Cadence
  /** Adjusts a transition weight, e.g. to favour darker degrees for a mood. */
  modifyWeight?: (from: number, to: number, weight: number) => number
}

/** Generates `length` 0-based scale degrees with a weighted Markov chain. */
export function markovProgression(rng: Rng, length: number, opts: MarkovOptions): number[] {
  const matrix = opts.family === 'major' ? MARKOV_MAJOR : MARKOV_MINOR
  const cadence = opts.cadence ?? 'loop'
  const start = opts.start ?? 0
  const weight = (from: number, to: number) => {
    if (from === to) return 0
    const w = matrix[from][to]
    return Math.max(0, opts.modifyWeight ? opts.modifyWeight(from, to, w) : w)
  }
  const pickNext = (from: number, score: (to: number) => number, avoid: readonly number[] = [from]) => {
    const entries = matrix.map((_, to) => [to, score(to)] as const)
    if (entries.some(([, w]) => w > 0)) return rng.weightedPick(entries)
    // Every option was zeroed by the modifier: any degree not in `avoid` will do.
    return rng.pick(matrix.map((_, to) => to).filter((to) => !avoid.includes(to)))
  }

  const degrees = [start]
  if (length <= 1) return degrees.slice(0, Math.max(0, length))

  const forced = cadence === 'authentic' && length >= 3 ? [4, 0] : []
  const freeLength = length - forced.length

  for (let i = 1; i < freeLength; i++) {
    const from = degrees[i - 1]
    const isLast = i === length - 1
    if (isLast && cadence === 'loop') {
      // Weight by both the step into this chord and the step back to the first chord.
      degrees.push(
        pickNext(from, (to) => weight(from, to) * (to === start ? 0 : weight(to, start)), [from, start]),
      )
    } else if (i === freeLength - 1 && forced.length > 0) {
      // Avoid repeating the forced dominant right before it.
      degrees.push(pickNext(from, (to) => (to === forced[0] ? 0 : weight(from, to))))
    } else {
      degrees.push(pickNext(from, (to) => weight(from, to)))
    }
  }
  degrees.push(...forced)
  return degrees
}

/**
 * Turns scale degrees into chords. With `majorDominant`, the minor v becomes a
 * major V (harmonic-minor dominant) for a stronger pull back to the tonic.
 */
export function degreesToChords(
  degrees: readonly number[],
  tonic: PitchClass,
  scale: ScaleId,
  extension: ChordExtension = 'triad',
  majorDominant = false,
): Chord[] {
  const len = SCALES[SCALES[scale].harmony].intervals.length
  return degrees.map((degree) => {
    let chord = diatonicTriad(tonic, scale, degree)
    const d = ((degree % len) + len) % len
    if (majorDominant && d === 4 && chord.quality === 'min') chord = { ...chord, quality: 'maj' }
    return extendChord(chord, extension, tonic, scale)
  })
}
