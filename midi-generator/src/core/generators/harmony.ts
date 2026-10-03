import type { ResolvedStyle } from '../presets/style'
import type { Rng } from '../random'
import { degreesToChords, getProgressionPreset, markovProgression, resolveProgression } from '../theory/progressions'
import { ticksPerBar } from '../time'
import type { Chord, HarmonyEvent, PitchClass, TimeSignature } from '../types'

export interface HarmonyInput {
  key: PitchClass
  ts: TimeSignature
  bars: number
  style: ResolvedStyle
}

/** Chords of one progression loop (base triads; presets may carry explicit 7ths). */
function progressionLoop(input: HarmonyInput, slots: number, rng: Rng): Chord[] {
  const { key, style } = input
  if (style.progression.kind === 'preset') {
    const preset = getProgressionPreset(style.progression.id)!
    return resolveProgression(preset.numerals, key, style.scale)
  }
  // Markov: a 4-chord loop, or an 8-chord one for longer patterns.
  const length = slots <= 4 ? slots : slots % 8 === 0 && rng.chance(0.35) ? 8 : 4
  const bias = style.degreeBias
  const degrees = markovProgression(rng, length, {
    family: style.family,
    cadence: style.progression.cadence,
    modifyWeight: (_from, to, w) => w * bias[to],
  })
  return degreesToChords(degrees, key, style.scale, 'triad', style.majorDominant)
}

/**
 * The shared harmony every part follows: the progression loop tiled over the
 * pattern at the style's harmonic rhythm (chords per bar).
 */
export function buildHarmony(input: HarmonyInput, rng: Rng): HarmonyEvent[] {
  const barTicks = ticksPerBar(input.ts)
  const total = barTicks * input.bars
  const slotTicks = barTicks / input.style.chordsPerBar
  const slots = Math.ceil(total / slotTicks)
  const loop = progressionLoop(input, slots, rng)

  const events: HarmonyEvent[] = []
  for (let i = 0; i < slots; i++) {
    const start = i * slotTicks
    events.push({ start, duration: Math.min(slotTicks, total - start), chord: loop[i % loop.length] })
  }
  return events
}
