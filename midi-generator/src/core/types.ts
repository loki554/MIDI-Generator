/**
 * Core data model. Everything here is plain JSON-serializable data so that a
 * Project can be stored as-is (e.g. in generation history) and restored later.
 */

/** MIDI ticks per quarter note. All note times are in ticks. */
export const PPQ = 480

export type Tick = number
/** 0–11, C = 0. */
export type PitchClass = number

export const PART_TYPES = ['drums', 'bass', 'chords', 'melody', 'arp', 'pad', 'riff'] as const
export type PartType = (typeof PART_TYPES)[number]

export const GENRES = [
  'pop',
  'hipHop',
  'lofi',
  'house',
  'techno',
  'dnb',
  'rock',
  'metal',
  'deathMetal',
  'stonerRock',
  'doomMetal',
  'thrashMetal',
  'jazz',
  'funk',
  'ambient',
] as const
export type Genre = (typeof GENRES)[number]

export const MOODS = [
  'happy',
  'sad',
  'dark',
  'epic',
  'chill',
  'dreamy',
  'tense',
  'romantic',
  'aggressive',
] as const
export type Mood = (typeof MOODS)[number]

export const SCALE_IDS = [
  'major',
  'minor',
  'dorian',
  'phrygian',
  'lydian',
  'mixolydian',
  'locrian',
  'harmonicMinor',
  'melodicMinor',
  'majorPentatonic',
  'minorPentatonic',
  'blues',
  'phrygianDominant',
] as const
export type ScaleId = (typeof SCALE_IDS)[number]

export interface TimeSignature {
  numerator: number
  denominator: number
}

export const TIME_SIGNATURES = [
  { numerator: 4, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 6, denominator: 8 },
] as const satisfies readonly TimeSignature[]

export const CHORD_QUALITIES = [
  'maj',
  'min',
  'dim',
  'aug',
  'sus2',
  'sus4',
  'power',
  'maj6',
  'min6',
  'maj7',
  'min7',
  'dom7',
  'm7b5',
  'dim7',
  'minMaj7',
  'augMaj7',
  'add9',
  'minAdd9',
  'maj9',
  'min9',
  'dom9',
  'min11',
  'maj13',
  'dom13',
] as const
export type ChordQuality = (typeof CHORD_QUALITIES)[number]

export interface Chord {
  root: PitchClass
  quality: ChordQuality
}

/** A chord placed on the timeline; the shared harmony all parts are built from. */
export interface HarmonyEvent {
  start: Tick
  duration: Tick
  chord: Chord
}

export interface Note {
  id: string
  /** MIDI note number 0–127. */
  pitch: number
  start: Tick
  duration: Tick
  /** MIDI velocity 1–127. */
  velocity: number
}

export interface Track {
  id: string
  partType: PartType
  name: string
  /** General MIDI program 0–127 (ignored for drums, which use channel 10). */
  program: number
  /** MIDI channel 0–15; drums use 9 (channel 10). */
  channel: number
  /** Any CSS color, e.g. `var(--part-bass)` or `#ff8a4c`. */
  color: string
  muted: boolean
  solo: boolean
  /** Linear gain 0–1. */
  volume: number
  notes: Note[]
  /** Seed this track was generated with; regenerating a part changes only this. */
  seed: number
}

/* ---------- Generation settings ---------- */

export type GenerationMode = 'single' | 'multi'

/** 'auto' lets the genre/mood presets decide. */
export type Auto<T> = T | 'auto'

export type ChordExtension = 'triad' | 'seventh' | 'ninth' | 'eleventh' | 'thirteenth' | 'sus2' | 'sus4' | 'add9' | 'power'

export interface GlobalSettings {
  mode: GenerationMode
  /** Part generated in single-part mode. */
  singlePart: PartType
  genre: Genre
  mood: Mood
  key: PitchClass
  scale: Auto<ScaleId>
  bpm: number
  timeSignature: TimeSignature
  /** Pattern length, 1–32 bars. */
  bars: number
  /** 0–1: amount of delay applied to off-beat subdivisions. */
  swing: number
  /** 0–1: rhythmic density and harmonic richness. */
  complexity: number
  /** 0–1: random timing and velocity deviation. */
  humanize: number
  seed: number
  /** When locked, Generate keeps the seed instead of rolling a new one. */
  seedLocked: boolean
  /**
   * Progression preset id, 'markov' (always generate with the Markov chain) or
   * 'auto' (genre and mood decide between presets and the Markov chain).
   */
  progression: string
  /** Chord changes per bar: 0.5 = one chord every two bars. */
  chordsPerBar: Auto<0.5 | 1 | 2>
}

interface PartSettingsBase {
  enabled: boolean
  /** GM program override; 'auto' picks the genre default. */
  program: Auto<number>
}

export interface DrumSettings extends PartSettingsBase {
  /** 0–1: probability scaling of optional hits. */
  density: number
  /** Fill every N bars; 0 disables fills. */
  fillEvery: 0 | 2 | 4 | 8
  ghostNotes: boolean
  hihatRolls: boolean
  crashOnSection: boolean
}

export type BassStyle = 'root' | 'octave' | 'walking' | 'sub808' | 'offbeat' | 'syncopated' | 'riff'

export interface BassSettings extends PartSettingsBase {
  style: Auto<BassStyle>
  /** Octave of the root register (MIDI octave, C1 = 24). */
  octave: number
  approachNotes: boolean
}

export type ChordRhythm = 'sustain' | 'stabs' | 'syncopated' | 'strum'

export interface ChordSettings extends PartSettingsBase {
  extension: Auto<ChordExtension>
  rhythm: Auto<ChordRhythm>
  octave: number
  voiceLeading: boolean
}

export type PhraseStructure = 'AABA' | 'ABAC' | 'AAAB' | 'ABAB'

export interface MelodySettings extends PartSettingsBase {
  /** 0–1: notes per beat. */
  density: number
  octave: number
  /** Range in semitones above the lowest note. */
  range: number
  structure: Auto<PhraseStructure>
  /** 0–1: how strongly the motif repeats vs. varies. */
  repetition: number
}

export type ArpPattern = 'up' | 'down' | 'upDown' | 'random' | 'converge'
export type ArpRate = '1/8' | '1/8t' | '1/16' | '1/16t' | '1/32'

export interface ArpSettings extends PartSettingsBase {
  pattern: ArpPattern
  rate: ArpRate
  octaves: 1 | 2 | 3
  octave: number
}

export interface PadSettings extends PartSettingsBase {
  extension: Auto<ChordExtension>
  octave: number
}

export type RiffStyle = 'chug' | 'gallop' | 'tremolo' | 'groove' | 'halfTime'

export interface RiffSettings extends PartSettingsBase {
  style: Auto<RiffStyle>
  /** 0–1: share of short palm-muted notes. */
  palmMute: number
  /** 0–1: probability of chromatic passing notes. */
  chromaticism: number
  octave: number
}

export interface PartSettingsMap {
  drums: DrumSettings
  bass: BassSettings
  chords: ChordSettings
  melody: MelodySettings
  arp: ArpSettings
  pad: PadSettings
  riff: RiffSettings
}

export interface GenSettings {
  global: GlobalSettings
  parts: PartSettingsMap
}

/* ---------- Project ---------- */

export const PROJECT_VERSION = 1

export interface Project {
  version: typeof PROJECT_VERSION
  id: string
  /** Unix epoch milliseconds. */
  createdAt: number
  bpm: number
  timeSignature: TimeSignature
  bars: number
  key: PitchClass
  /** Resolved scale (never 'auto'). */
  scale: ScaleId
  harmony: HarmonyEvent[]
  tracks: Track[]
  /** Settings the project was generated with, for regeneration and history. */
  settings: GenSettings
}
