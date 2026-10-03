import type { PitchClass } from '../types'

export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const LETTER_PC: Record<string, PitchClass> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const MIDI_MIN = 0
export const MIDI_MAX = 127

/** Scientific pitch notation: MIDI 60 = C4. */
const OCTAVE_OFFSET = -1

export function pitchClass(midi: number): PitchClass {
  return ((midi % 12) + 12) % 12
}

export function octaveOf(midi: number): number {
  return Math.floor(midi / 12) + OCTAVE_OFFSET
}

/** MIDI note number of a pitch class in a given octave (C4 = 60). */
export function midiOf(pc: PitchClass, octave: number): number {
  return (octave - OCTAVE_OFFSET) * 12 + pitchClass(pc)
}

export function pitchClassName(pc: PitchClass, preferFlats = false): string {
  return (preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP)[pitchClass(pc)]
}

/** 60 → "C4", 61 → "C#4" (or "Db4" with preferFlats). */
export function midiToName(midi: number, preferFlats = false): string {
  return `${pitchClassName(midi, preferFlats)}${octaveOf(midi)}`
}

/** Parses "C", "f#", "Bb", "E♭" into a pitch class. Returns null if invalid. */
export function parsePitchClass(name: string): PitchClass | null {
  const m = /^([A-Ga-g])([#♯b♭]*)$/.exec(name.trim())
  if (!m) return null
  let pc = LETTER_PC[m[1].toUpperCase()]
  for (const acc of m[2]) pc += acc === '#' || acc === '♯' ? 1 : -1
  return pitchClass(pc)
}

/** Parses "C4", "Db3", "A#-1" into a MIDI note number. Returns null if invalid or out of range. */
export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g][#♯b♭]*)(-?\d+)$/.exec(name.trim())
  if (!m) return null
  // Don't wrap the pitch class here, so that "Cb4" = B3 and "B#3" = C4.
  const letter = LETTER_PC[m[1][0].toUpperCase()]
  let offset = 0
  for (const acc of m[1].slice(1)) offset += acc === '#' || acc === '♯' ? 1 : -1
  const midi = (Number(m[2]) - OCTAVE_OFFSET) * 12 + letter + offset
  return midi >= MIDI_MIN && midi <= MIDI_MAX ? midi : null
}

export function clampMidi(midi: number): number {
  return Math.min(MIDI_MAX, Math.max(MIDI_MIN, Math.round(midi)))
}

export function transpose(midi: number, semitones: number): number {
  return clampMidi(midi + semitones)
}

const BLACK_KEYS = new Set([1, 3, 6, 8, 10])

export function isBlackKey(midi: number): boolean {
  return BLACK_KEYS.has(pitchClass(midi))
}

/** Smallest distance between two pitch classes (0–6). */
export function pitchClassDistance(a: PitchClass, b: PitchClass): number {
  const d = Math.abs(pitchClass(a) - pitchClass(b))
  return Math.min(d, 12 - d)
}

/**
 * Nearest MIDI note with the given pitch class to `target`.
 * Ties resolve downwards.
 */
export function nearestWithPitchClass(pc: PitchClass, target: number): number {
  const base = target - pitchClass(target) + pitchClass(pc)
  const candidates = [base - 12, base, base + 12]
  let best = candidates[0]
  for (const c of candidates) {
    if (Math.abs(c - target) < Math.abs(best - target)) best = c
  }
  return best
}
