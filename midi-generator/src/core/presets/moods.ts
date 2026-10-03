import type { ChordExtension, Mood, ScaleId } from '../types'

type Weights<K extends string> = Partial<Record<K, number>>

export interface MoodDef {
  scales: Weights<ScaleId>
  /**
   * Multipliers on Markov transitions *into* each scale degree (I…VII),
   * for major- and minor-family keys.
   */
  degreeBias: { major: readonly number[]; minor: readonly number[] }
  /** Multipliers on genre progression-preset weights. */
  presetBias: Readonly<Record<string, number>>
  /** Blended with the genre's extension weights. */
  extensions: Weights<ChordExtension>
  /** Use a major V in minor keys (harmonic-minor pull). Probability 0–1. */
  majorDominant: number
  /** MIDI velocity range for parts. */
  velocity: readonly [number, number]
  /** Note density multiplier. */
  density: number
  /** Octave shift for melodic parts. */
  register: -1 | 0 | 1
  /** Note length multiplier (legato > 1, staccato < 1). */
  legato: number
  /** Where in the genre BPM range the mood sits, 0–1. */
  tempo: number
}

const NEUTRAL = [1, 1, 1, 1, 1, 1, 1] as const

export const MOODS_DEF: Record<Mood, MoodDef> = {
  happy: {
    scales: { major: 3, majorPentatonic: 2, mixolydian: 1.5, lydian: 1 },
    degreeBias: { major: [1, 0.8, 0.6, 1.3, 1.3, 0.8, 0.4], minor: [1, 0.5, 1.5, 1, 1, 1.3, 1.5] },
    presetBias: { axis: 1.5, doowop: 1.5, classicRock: 1.3, mixolydianRock: 1.3, funkVamp: 1.2 },
    extensions: { triad: 2, add9: 1, sus2: 1 },
    majorDominant: 0.2,
    velocity: [80, 112],
    density: 1.1,
    register: 0,
    legato: 0.85,
    tempo: 0.65,
  },
  sad: {
    scales: { minor: 3, dorian: 1, harmonicMinor: 1, minorPentatonic: 0.5 },
    degreeBias: { major: [1, 1.2, 1.3, 1.2, 0.8, 1.6, 0.3], minor: [1, 0.6, 1, 1.4, 1, 1.3, 1] },
    presetBias: { sensitive: 1.5, romantic: 1.3, classicMinor: 1.3, minorDescent: 1.3 },
    extensions: { seventh: 2, add9: 1, triad: 1 },
    majorDominant: 0.3,
    velocity: [58, 92],
    density: 0.8,
    register: 0,
    legato: 1.15,
    tempo: 0.3,
  },
  dark: {
    scales: { phrygian: 3, minor: 2, harmonicMinor: 2, locrian: 1 },
    degreeBias: { major: [1, 1.2, 1.3, 1, 1, 1.4, 0.8], minor: [1, 1.5, 0.6, 1.2, 1.2, 1.2, 0.8] },
    presetBias: { phrygianMetal: 1.5, doom: 1.5, tritone: 1.3, chromaticTension: 1.3, harmonicMinor: 1.3 },
    extensions: { triad: 2, power: 1, seventh: 1 },
    majorDominant: 0.4,
    velocity: [70, 105],
    density: 0.9,
    register: -1,
    legato: 1,
    tempo: 0.45,
  },
  epic: {
    scales: { minor: 3, harmonicMinor: 1, major: 1, dorian: 0.5 },
    degreeBias: { major: [1, 0.6, 0.6, 1.4, 1.4, 1.4, 0.3], minor: [1, 0.4, 1.5, 1, 1, 1.6, 1.6] },
    presetBias: { epicMinor: 2, metalRise: 1.5, royalRoad: 1.2, andalusian: 1.2 },
    extensions: { triad: 2, sus2: 1, power: 1 },
    majorDominant: 0.5,
    velocity: [85, 120],
    density: 1.1,
    register: 0,
    legato: 1,
    tempo: 0.6,
  },
  chill: {
    scales: { dorian: 2, major: 2, minor: 1, majorPentatonic: 1, lydian: 1 },
    degreeBias: { major: NEUTRAL, minor: NEUTRAL },
    presetBias: { lofiDescent: 1.5, lofiMinor: 1.5, dorianVamp: 1.3, jazzTwoFiveOne: 1.2 },
    extensions: { seventh: 3, ninth: 2 },
    majorDominant: 0.2,
    velocity: [55, 88],
    density: 0.75,
    register: 0,
    legato: 1.2,
    tempo: 0.25,
  },
  dreamy: {
    scales: { lydian: 3, major: 2, dorian: 1 },
    degreeBias: { major: [1, 1, 1.2, 1.3, 0.7, 1.2, 0.3], minor: [1, 0.6, 1.3, 1, 0.8, 1.4, 1.2] },
    presetBias: { lydianFloat: 2, ambientMinor: 1.3, romantic: 1.3 },
    extensions: { add9: 2, ninth: 2, sus2: 2 },
    majorDominant: 0.1,
    velocity: [50, 85],
    density: 0.7,
    register: 1,
    legato: 1.4,
    tempo: 0.3,
  },
  tense: {
    scales: { harmonicMinor: 2, phrygian: 2, locrian: 1, phrygianDominant: 1 },
    degreeBias: { major: [1, 1.2, 1, 1, 1.5, 1, 1.3], minor: [1, 1.6, 0.6, 1, 1.4, 1, 0.7] },
    presetBias: { chromaticTension: 2, tritone: 1.5, harmonicMinor: 1.5, andalusian: 1.3 },
    extensions: { seventh: 2, triad: 1 },
    majorDominant: 0.7,
    velocity: [70, 110],
    density: 1,
    register: 0,
    legato: 0.8,
    tempo: 0.6,
  },
  romantic: {
    scales: { major: 2, minor: 2, harmonicMinor: 0.5 },
    degreeBias: { major: [1, 1.2, 1.2, 1.3, 1, 1.4, 0.3], minor: [1, 0.7, 1.3, 1.3, 1, 1.3, 1] },
    presetBias: { romantic: 2, royalRoad: 1.5, doowop: 1.3, sensitive: 1.3 },
    extensions: { seventh: 2, add9: 2, ninth: 1 },
    majorDominant: 0.5,
    velocity: [60, 95],
    density: 0.85,
    register: 0,
    legato: 1.2,
    tempo: 0.35,
  },
  aggressive: {
    scales: { phrygian: 2, minor: 2, locrian: 1, blues: 1 },
    degreeBias: { major: [1.2, 1, 0.8, 1, 1.2, 1, 1], minor: [1.2, 1.2, 0.8, 1, 1, 1, 1] },
    presetBias: { phrygianMetal: 1.5, tritone: 1.5, metalRise: 1.3, chromaticTension: 1.2 },
    extensions: { power: 3, triad: 1 },
    majorDominant: 0.3,
    velocity: [95, 127],
    density: 1.3,
    register: -1,
    legato: 0.6,
    tempo: 0.8,
  },
}
