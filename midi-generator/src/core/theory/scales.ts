import type { PitchClass, ScaleId } from '../types'
import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, pitchClass } from './notes'

export interface ScaleDef {
  /** Semitones from the tonic, ascending, starting at 0. */
  intervals: readonly number[]
  /** Major or minor colour of the tonic triad. */
  family: 'major' | 'minor'
  /**
   * Seven-note scale used to build chords. Pentatonic and blues scales borrow
   * the harmony of their parent mode.
   */
  harmony: ScaleId
  /**
   * For diatonic modes: semitones from the parent major key's tonic up to this
   * mode's tonic (dorian = 2). Used for sharp/flat spelling.
   */
  majorOffset: number
}

export const SCALES: Record<ScaleId, ScaleDef> = {
  major: { intervals: [0, 2, 4, 5, 7, 9, 11], family: 'major', harmony: 'major', majorOffset: 0 },
  minor: { intervals: [0, 2, 3, 5, 7, 8, 10], family: 'minor', harmony: 'minor', majorOffset: 9 },
  dorian: { intervals: [0, 2, 3, 5, 7, 9, 10], family: 'minor', harmony: 'dorian', majorOffset: 2 },
  phrygian: { intervals: [0, 1, 3, 5, 7, 8, 10], family: 'minor', harmony: 'phrygian', majorOffset: 4 },
  lydian: { intervals: [0, 2, 4, 6, 7, 9, 11], family: 'major', harmony: 'lydian', majorOffset: 5 },
  mixolydian: { intervals: [0, 2, 4, 5, 7, 9, 10], family: 'major', harmony: 'mixolydian', majorOffset: 7 },
  locrian: { intervals: [0, 1, 3, 5, 6, 8, 10], family: 'minor', harmony: 'locrian', majorOffset: 11 },
  harmonicMinor: { intervals: [0, 2, 3, 5, 7, 8, 11], family: 'minor', harmony: 'harmonicMinor', majorOffset: 9 },
  melodicMinor: { intervals: [0, 2, 3, 5, 7, 9, 11], family: 'minor', harmony: 'melodicMinor', majorOffset: 9 },
  majorPentatonic: { intervals: [0, 2, 4, 7, 9], family: 'major', harmony: 'major', majorOffset: 0 },
  minorPentatonic: { intervals: [0, 3, 5, 7, 10], family: 'minor', harmony: 'minor', majorOffset: 9 },
  blues: { intervals: [0, 3, 5, 6, 7, 10], family: 'minor', harmony: 'minor', majorOffset: 9 },
  phrygianDominant: { intervals: [0, 1, 4, 5, 7, 8, 10], family: 'major', harmony: 'phrygianDominant', majorOffset: 4 },
}

export function scaleLength(scale: ScaleId): number {
  return SCALES[scale].intervals.length
}

export function scalePitchClasses(tonic: PitchClass, scale: ScaleId): PitchClass[] {
  return SCALES[scale].intervals.map((i) => pitchClass(tonic + i))
}

export function isInScale(midi: number, tonic: PitchClass, scale: ScaleId): boolean {
  return SCALES[scale].intervals.includes(pitchClass(midi - tonic))
}

/** 0-based scale degree of a note, or null if it is not in the scale. */
export function scaleDegreeOf(midi: number, tonic: PitchClass, scale: ScaleId): number | null {
  const i = SCALES[scale].intervals.indexOf(pitchClass(midi - tonic))
  return i === -1 ? null : i
}

/**
 * MIDI note of a 0-based scale degree. Degrees wrap into neighbouring octaves:
 * with 7 notes, degree 7 is the tonic an octave up and -1 the leading tone below.
 * `tonicMidi` is the MIDI note of degree 0.
 */
export function degreeToMidi(degree: number, tonicMidi: number, scale: ScaleId): number {
  const { intervals } = SCALES[scale]
  const len = intervals.length
  const octave = Math.floor(degree / len)
  const index = degree - octave * len
  return tonicMidi + octave * 12 + intervals[index]
}

/**
 * Moves a note onto the scale. 'nearest' resolves ties downwards.
 * Notes already in the scale are returned unchanged.
 */
export function snapToScale(
  midi: number,
  tonic: PitchClass,
  scale: ScaleId,
  direction: 'nearest' | 'up' | 'down' = 'nearest',
): number {
  if (isInScale(midi, tonic, scale)) return midi
  for (let d = 1; d < 12; d++) {
    if (direction !== 'up' && isInScale(midi - d, tonic, scale)) return midi - d
    if (direction !== 'down' && isInScale(midi + d, tonic, scale)) return midi + d
  }
  return midi
}

/** All scale notes within [low, high] inclusive, ascending. */
export function scaleNotesInRange(tonic: PitchClass, scale: ScaleId, low: number, high: number): number[] {
  const out: number[] = []
  for (let m = low; m <= high; m++) if (isInScale(m, tonic, scale)) out.push(m)
  return out
}

/**
 * Moves `steps` scale steps from `midi` (which should be in the scale; otherwise
 * it is snapped first).
 */
export function stepInScale(midi: number, steps: number, tonic: PitchClass, scale: ScaleId): number {
  const start = snapToScale(midi, tonic, scale)
  const degree = scaleDegreeOf(start, tonic, scale)!
  const tonicMidi = start - SCALES[scale].intervals[degree]
  return degreeToMidi(degree + steps, tonicMidi, scale)
}

const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb

/** Whether a key is conventionally spelled with flats (F major, D minor, G dorian…). */
export function prefersFlats(tonic: PitchClass, scale: ScaleId): boolean {
  return FLAT_MAJOR_KEYS.has(pitchClass(tonic - SCALES[scale].majorOffset))
}

/** Spelled tonic for display, e.g. "Eb" for E♭ minor, "F#" for F♯ minor. */
export function keyName(tonic: PitchClass, scale: ScaleId): string {
  return (prefersFlats(tonic, scale) ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pitchClass(tonic)]
}
