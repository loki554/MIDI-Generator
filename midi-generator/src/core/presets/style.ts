/**
 * Combines a genre and a mood into concrete style decisions.
 * Rule of thumb: the genre owns rhythm and arrangement (drums, bass and chord
 * rhythm, riff style, tempo range), the mood owns harmony and dynamics (scale,
 * progression bias, velocity, density, register). Explicit settings always win
 * over 'auto'.
 */
import type { Rng } from '../random'
import { resolveProgression, scaleFit, type Cadence, getProgressionPreset } from '../theory/progressions'
import { SCALES } from '../theory/scales'
import type {
  BassStyle,
  ChordExtension,
  ChordRhythm,
  GenSettings,
  Genre,
  Mood,
  PhraseStructure,
  RiffStyle,
  ScaleId,
  TimeSignature,
} from '../types'
import type { DrumFillId, DrumPatternId } from './drumPatterns'
import { GENRES_DEF } from './genres'
import { MOODS_DEF } from './moods'

type Weights<K extends string> = Partial<Record<K, number>>

export type ProgressionChoice = { kind: 'preset'; id: string } | { kind: 'markov'; cadence: Cadence }

export interface ResolvedStyle {
  genre: Genre
  mood: Mood
  scale: ScaleId
  family: 'major' | 'minor'
  progression: ProgressionChoice
  /** Markov bias on transitions into each degree. */
  degreeBias: readonly number[]
  majorDominant: boolean
  chordsPerBar: 0.5 | 1 | 2
  extension: ChordExtension
  padExtension: ChordExtension
  chordRhythm: ChordRhythm
  bassStyle: BassStyle
  riffStyle: RiffStyle
  drumPattern: DrumPatternId
  fills: Weights<DrumFillId>
  swingGrid: 8 | 16
  velocity: readonly [number, number]
  /** Combined note density multiplier (genre × mood × complexity), ~0.3–1.8. */
  density: number
  register: -1 | 0 | 1
  legato: number
  melodyGrid: 8 | 16
  structure: PhraseStructure
}

/**
 * Multiplies genre and mood weights key by key. Keys missing on one side use
 * that side's floor, so the genre dominates and the mood tilts.
 */
export function combineWeights<K extends string>(
  genre: Weights<K>,
  mood: Weights<K>,
  genreFloor = 0.1,
  moodFloor = 0.5,
): Weights<K> {
  const keys = new Set([...Object.keys(genre), ...Object.keys(mood)] as K[])
  const out: Weights<K> = {}
  for (const k of keys) out[k] = (genre[k] ?? genreFloor) * (mood[k] ?? moodFloor)
  return out
}

const RICH_EXTENSIONS: ReadonlySet<ChordExtension> = new Set(['seventh', 'ninth', 'eleventh', 'thirteenth'])
const PLAIN_EXTENSIONS: ReadonlySet<ChordExtension> = new Set(['triad', 'power'])

/** Higher complexity favours richer chords. */
function tiltByComplexity(weights: Weights<ChordExtension>, complexity: number): Weights<ChordExtension> {
  const out: Weights<ChordExtension> = {}
  for (const [k, w] of Object.entries(weights) as Array<[ChordExtension, number]>) {
    const tilt = RICH_EXTENSIONS.has(k) ? 0.5 + complexity : PLAIN_EXTENSIONS.has(k) ? 1.5 - complexity : 1
    out[k] = w * tilt
  }
  return out
}

/** Suggested tempo for a genre/mood pair, inside the genre range. */
export function suggestBpm(genre: Genre, mood: Mood): number {
  const [lo, hi] = GENRES_DEF[genre].bpm
  return Math.round(lo + (hi - lo) * MOODS_DEF[mood].tempo)
}

export function drumPatternFor(genre: Genre, ts: TimeSignature, rng: Rng): DrumPatternId {
  const def = GENRES_DEF[genre]
  if (ts.numerator === 4 && ts.denominator === 4) return rng.weightedKey(def.drums)
  if (ts.numerator === 3 && ts.denominator === 4) {
    return genre === 'jazz' || genre === 'lofi' ? 'jazzWaltz' : 'waltz'
  }
  return def.compoundDrums
}

function pickProgression(settings: GenSettings, scale: ScaleId, rng: Rng): ProgressionChoice {
  const { genre, mood, key, progression } = settings.global
  const def = GENRES_DEF[genre]
  const cadence: Cadence = def.authenticCadence ? 'authentic' : 'loop'

  if (progression === 'markov') return { kind: 'markov', cadence }
  if (progression !== 'auto' && getProgressionPreset(progression)) return { kind: 'preset', id: progression }
  if (rng.chance(def.markovChance)) return { kind: 'markov', cadence }

  const family = SCALES[scale].family
  const bias = MOODS_DEF[mood].presetBias
  const entries = Object.entries(def.progressions).map(([id, w]) => {
    const preset = getProgressionPreset(id)!
    const fit = scaleFit(resolveProgression(preset.numerals, key, scale), key, scale)
    const familyMatch = preset.family === family ? 1 : 0.15
    return [id, w * (bias[id] ?? 1) * fit * fit * familyMatch] as const
  })
  if (!entries.some(([, w]) => w > 0)) return { kind: 'markov', cadence }
  return { kind: 'preset', id: rng.weightedPick(entries) }
}

/** Resolves every 'auto' decision for a generation run. Deterministic for a given rng. */
export function resolveStyle(settings: GenSettings, rng: Rng): ResolvedStyle {
  const g = settings.global
  const genre = GENRES_DEF[g.genre]
  const mood = MOODS_DEF[g.mood]
  const parts = settings.parts
  // One fork per decision keeps choices independent: changing one setting
  // doesn't reshuffle unrelated ones.
  const r = (label: string) => rng.fork(label)

  const scale: ScaleId = g.scale !== 'auto' ? g.scale : r('scale').weightedKey(combineWeights(genre.scales, mood.scales, 0.05, 0.05))
  const family = SCALES[scale].family

  const extensionWeights = tiltByComplexity(combineWeights(genre.extensions, mood.extensions), g.complexity)
  const padWeights = tiltByComplexity(combineWeights(genre.padExtensions, mood.extensions), g.complexity)

  const isTriple = g.timeSignature.numerator === 3 && g.timeSignature.denominator === 4
  let chordsPerBar: 0.5 | 1 | 2 =
    g.chordsPerBar !== 'auto' ? g.chordsPerBar : (Number(r('chordsPerBar').weightedKey(genre.chordsPerBar)) as 0.5 | 1 | 2)
  if (isTriple && chordsPerBar === 2) chordsPerBar = 1

  return {
    genre: g.genre,
    mood: g.mood,
    scale,
    family,
    progression: pickProgression(settings, scale, r('progression')),
    degreeBias: mood.degreeBias[family],
    majorDominant: family === 'minor' && r('majorDominant').chance(mood.majorDominant),
    chordsPerBar,
    extension: parts.chords.extension !== 'auto' ? parts.chords.extension : r('extension').weightedKey(extensionWeights),
    padExtension: parts.pad.extension !== 'auto' ? parts.pad.extension : r('padExtension').weightedKey(padWeights),
    chordRhythm: parts.chords.rhythm !== 'auto' ? parts.chords.rhythm : r('chordRhythm').weightedKey(genre.chordRhythms),
    bassStyle: parts.bass.style !== 'auto' ? parts.bass.style : r('bassStyle').weightedKey(genre.bassStyles),
    riffStyle: parts.riff.style !== 'auto' ? parts.riff.style : r('riffStyle').weightedKey(genre.riffStyles),
    drumPattern: drumPatternFor(g.genre, g.timeSignature, r('drums')),
    fills: genre.fills,
    swingGrid: genre.swingGrid,
    velocity: mood.velocity,
    density: genre.density * mood.density * (0.6 + 0.8 * g.complexity),
    register: mood.register,
    legato: mood.legato,
    melodyGrid: genre.melodyGrid,
    structure:
      parts.melody.structure !== 'auto'
        ? parts.melody.structure
        : r('structure').weightedKey<PhraseStructure>({ AABA: 2, ABAC: 2, AAAB: 1, ABAB: 1 }),
  }
}
