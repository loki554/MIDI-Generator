import type { Rng } from '../random'
import { extendChord, rootPosition, voiceLead } from '../theory/chords'
import { midiOf, nearestWithPitchClass } from '../theory/notes'
import type { Chord, ChordSettings, HarmonyEvent, Tick } from '../types'
import { eventAt, type GenContext, type NoteDraft, velocity } from './context'

/** One-bar rhythm cells: [start step, length in steps] on a 16-step grid. */
type Cell = ReadonlyArray<readonly [number, number]>

const STAB_CELLS: readonly Cell[] = [
  [[2, 2], [6, 2], [10, 2], [14, 2]], // off-beat stabs
  [[0, 2], [4, 2], [8, 2], [12, 2]], // on the beat
  [[0, 2], [3, 2], [6, 2], [10, 2], [12, 2]], // pushes
  [[0, 1], [3, 1], [6, 2], [10, 1], [11, 2]], // funk 16ths
]

const SYNC_CELLS: readonly Cell[] = [
  [[0, 6], [6, 4], [10, 6]], // 3+3+2
  [[0, 3], [3, 5], [8, 3], [11, 5]],
  [[0, 4], [6, 2], [8, 4], [14, 2]],
  [[2, 4], [7, 3], [12, 4]], // jazz comping, avoiding the downbeat
]

/** Down/up strum pattern: [step, length, direction]. */
const STRUM_CELL: ReadonlyArray<readonly [number, number, 'down' | 'up']> = [
  [0, 4, 'down'],
  [4, 2, 'down'],
  [6, 4, 'up'],
  [10, 2, 'up'],
  [12, 4, 'down'],
]

interface Hit {
  start: Tick
  duration: Tick
  /** Relative loudness 0–1. */
  level: number
  strum?: 'down' | 'up'
}

function cellHits(ctx: GenContext, cells: readonly Cell[], legato: number): Hit[] {
  const hits: Hit[] = []
  for (let bar = 0; bar < ctx.bars; bar++) {
    // Alternate between two cells (A A A B) for some movement.
    const cell = bar % 4 === 3 && cells.length > 1 ? cells[1] : cells[0]
    for (const [step, len] of cell) {
      if (step >= ctx.stepsPerBar) continue
      const start = bar * ctx.barTicks + step * ctx.stepTicks
      const maxLen = ctx.stepsPerBar - step
      hits.push({
        start,
        duration: Math.round(Math.min(len, maxLen) * ctx.stepTicks * legato),
        level: step % ctx.pulseSteps === 0 ? 0.8 : 0.68,
      })
    }
  }
  return hits
}

function rhythmHits(ctx: GenContext, rng: Rng): Hit[] {
  const { style } = ctx
  const legato = Math.min(1, style.legato)
  switch (style.chordRhythm) {
    case 'stabs': {
      const a = rng.pick(STAB_CELLS)
      return cellHits(ctx, [a, rng.pick(STAB_CELLS)], 0.8 * legato)
    }
    case 'syncopated': {
      const a = rng.pick(SYNC_CELLS)
      return cellHits(ctx, [a, rng.pick(SYNC_CELLS)], 0.95 * legato)
    }
    case 'strum': {
      const hits: Hit[] = []
      for (let bar = 0; bar < ctx.bars; bar++) {
        for (const [step, len, dir] of STRUM_CELL) {
          if (step >= ctx.stepsPerBar) continue
          hits.push({
            start: bar * ctx.barTicks + step * ctx.stepTicks,
            duration: Math.round(Math.min(len, ctx.stepsPerBar - step) * ctx.stepTicks * 0.95),
            level: dir === 'down' ? 0.85 : 0.62,
            strum: dir,
          })
        }
      }
      return hits
    }
    default:
      // Sustain: one hit per chord, filled in per event below.
      return []
  }
}

/** Voices every harmony event once, with voice leading or in root position. */
function voiceEvents(ctx: GenContext, part: ChordSettings): Map<HarmonyEvent, number[]> {
  const { style } = ctx
  const voicings = new Map<HarmonyEvent, number[]>()
  const isPower = style.extension === 'power'
  const center = midiOf(0, part.octave) + (isPower ? -6 : 5)
  let previous: number[] | null = null

  for (const event of ctx.harmony) {
    const chord: Chord = extendChord(event.chord, style.extension, ctx.key, ctx.scale)
    let voicing: number[]
    if (chord.quality === 'power') {
      const root = nearestWithPitchClass(chord.root, center)
      voicing = [root, root + 7, root + 12]
    } else if (part.voiceLeading) {
      voicing = voiceLead(previous, chord, {
        low: center - 9,
        high: center + 12,
        center,
        allowOpen: ctx.settings.global.complexity > 0.6,
        maxVoices: 5,
      })
    } else {
      voicing = rootPosition(chord, part.octave)
    }
    voicings.set(event, voicing)
    previous = voicing
  }
  return voicings
}

export function generateChords(ctx: GenContext, part: ChordSettings, rng: Rng): NoteDraft[] {
  const voicings = voiceEvents(ctx, part)
  const notes: NoteDraft[] = []

  let hits = rhythmHits(ctx, rng)
  if (hits.length === 0) {
    hits = ctx.harmony.map((e) => ({ start: e.start, duration: e.duration, level: 0.7 }))
  }

  for (const hit of hits) {
    const event = eventAt(ctx, hit.start)
    const end = Math.min(hit.start + hit.duration, event.start + event.duration)
    const voicing = voicings.get(event)!
    const ordered = hit.strum === 'up' ? [...voicing].reverse() : voicing
    ordered.forEach((pitch, i) => {
      // Strums roll the voices ~12 ticks apart; block chords hit together.
      const offset = hit.strum ? i * 12 : 0
      const start = hit.start + offset
      if (start >= end) return
      notes.push({ pitch, start, duration: end - start, velocity: velocity(ctx, hit.level - i * 0.02) })
    })
  }
  return notes
}
