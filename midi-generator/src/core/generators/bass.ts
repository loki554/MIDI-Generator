import type { Rng } from '../random'
import { chordPitchClasses } from '../theory/chords'
import { midiOf, nearestWithPitchClass, pitchClass } from '../theory/notes'
import { isInScale, stepInScale } from '../theory/scales'
import type { BassSettings, Chord, Tick } from '../types'
import { eventAt, type GenContext, type NoteDraft, nextEvent, velocity } from './context'

const BASS_LOW = 28 // E1
const BASS_HIGH = 55 // G3

function clampToBass(pitch: number): number {
  let p = pitch
  while (p < BASS_LOW) p += 12
  while (p > BASS_HIGH) p -= 12
  return p
}

function rootIn(chord: Chord, center: number): number {
  return clampToBass(nearestWithPitchClass(chord.root, center))
}

interface Hit {
  start: Tick
  duration: Tick
  level: number
  /** Semitones above the root (0 root, 12 octave, 7 fifth…). */
  interval?: number
}

/** Repeats a one-bar cell of [step, length, level, interval] over the pattern. */
function barCells(
  ctx: GenContext,
  cellFor: (bar: number) => ReadonlyArray<readonly [number, number, number, number?]>,
): Hit[] {
  const hits: Hit[] = []
  for (let bar = 0; bar < ctx.bars; bar++) {
    for (const [step, len, level, interval] of cellFor(bar)) {
      if (step >= ctx.stepsPerBar) continue
      hits.push({
        start: bar * ctx.barTicks + step * ctx.stepTicks,
        duration: Math.min(len, ctx.stepsPerBar - step) * ctx.stepTicks,
        level,
        interval,
      })
    }
  }
  return hits
}

function rootHits(ctx: GenContext): Hit[] {
  const d = ctx.style.density
  const half = Math.floor(ctx.stepsPerBar / 2)
  if (d < 0.6) return barCells(ctx, () => [[0, half, 0.85], [half, half, 0.7]])
  const unit = d < 1 ? ctx.pulseSteps : 2
  const cell: Array<[number, number, number]> = []
  for (let s = 0; s < ctx.stepsPerBar; s += unit) cell.push([s, unit, s === 0 ? 0.85 : 0.7])
  return barCells(ctx, () => cell)
}

function octaveHits(ctx: GenContext): Hit[] {
  const cell: Array<[number, number, number, number]> = []
  for (let s = 0; s < ctx.stepsPerBar; s += 2) cell.push([s, 2, s % 4 === 0 ? 0.85 : 0.7, (s / 2) % 2 === 1 ? 12 : 0])
  return barCells(ctx, () => cell)
}

function offbeatHits(ctx: GenContext, rng: Rng): Hit[] {
  const cell: Array<[number, number, number, number]> = []
  for (let s = 2; s < ctx.stepsPerBar; s += 4) cell.push([s, 2, 0.8, rng.chance(0.15) ? 12 : 0])
  return barCells(ctx, () => cell)
}

/** 808-style: long sub notes on kick-like positions, occasional octave jumps. */
function sub808Hits(ctx: GenContext, rng: Rng): Hit[] {
  const positions = [0, ...[6, 7, 10, 11, 14].filter(() => rng.chance(0.3 * ctx.style.density))]
    .filter((s) => s < ctx.stepsPerBar)
    .sort((a, b) => a - b)
  const cell = positions.map((s, i) => {
    const next = positions[i + 1] ?? ctx.stepsPerBar
    return [s, next - s, s === 0 ? 0.95 : 0.8, i > 0 && rng.chance(0.25) ? 12 : 0] as const
  })
  return barCells(ctx, () => cell)
}

/** Funk: root on the one, syncopated sixteenths with octave, fifth and seventh. */
function syncopatedHits(ctx: GenContext, rng: Rng): Hit[] {
  const makeCell = () => {
    const cell: Array<readonly [number, number, number, number]> = [[0, 2, 0.95, 0]]
    for (const s of [3, 6, 7, 10, 11, 14]) {
      if (s >= ctx.stepsPerBar || !rng.chance(0.5 * ctx.style.density)) continue
      cell.push([s, 1, rng.chance(0.3) ? 0.5 : 0.78, rng.pick([0, 0, 12, 7, 10])])
    }
    return cell
  }
  const a = makeCell()
  const b = makeCell()
  return barCells(ctx, (bar) => (bar % 2 === 1 ? b : a))
}

/** Walking bass: one note per beat, chord tones moving towards the next root. */
function walkingNotes(ctx: GenContext, center: number, rng: Rng): NoteDraft[] {
  const notes: NoteDraft[] = []
  const beat = ctx.beatTicks
  let pitch = rootIn(ctx.harmony[0].chord, center)

  for (const event of ctx.harmony) {
    const beats = Math.max(1, Math.round(event.duration / beat))
    const root = rootIn(event.chord, pitch)
    const target = rootIn(nextEvent(ctx, event).chord, root)
    const tones = chordPitchClasses(event.chord)
    pitch = root
    for (let b = 0; b < beats; b++) {
      const start = event.start + b * beat
      if (b === 0) {
        pitch = root
      } else if (b === beats - 1) {
        // Approach the next root chromatically or by a scale step, without repeating the last note.
        const dir = target >= pitch ? 1 : -1
        const options = (
          [
            [stepInScale(target, -dir, ctx.key, ctx.scale), 0.5],
            [target - dir, 0.38],
            [target + dir, 0.12],
          ] as const
        ).filter(([p]) => p !== pitch && p !== target)
        pitch = options.length > 0 ? rng.weightedPick(options) : target - dir
      } else {
        const dir = target > pitch ? 1 : target < pitch ? -1 : rng.pick([1, -1])
        const candidates = [1, 2, 3, 4].map((n) => pitch + dir * n)
        const chordTone = candidates.find((c) => tones.includes(pitchClass(c)))
        pitch = chordTone ?? stepInScale(pitch, dir, ctx.key, ctx.scale)
      }
      pitch = clampToBass(pitch)
      notes.push({ pitch, start, duration: Math.round(beat * 0.9), velocity: velocity(ctx, b === 0 ? 0.85 : 0.72) })
    }
  }
  return notes
}

/** Doubles the riff an octave down: the lowest note of each riff onset. */
function riffNotes(ctx: GenContext, center: number, riff: readonly NoteDraft[]): NoteDraft[] {
  const byStart = new Map<Tick, NoteDraft>()
  for (const n of riff) {
    const existing = byStart.get(n.start)
    if (!existing || n.pitch < existing.pitch) byStart.set(n.start, n)
  }
  return [...byStart.values()].map((n) => ({
    ...n,
    pitch: clampToBass(nearestWithPitchClass(pitchClass(n.pitch), center)),
    velocity: velocity(ctx, 0.8),
  }))
}

/** Replaces the last note before a chord change with an approach note into the next root. */
function addApproachNotes(ctx: GenContext, notes: NoteDraft[], rng: Rng): void {
  const sorted = [...notes].sort((a, b) => a.start - b.start)
  for (const event of ctx.harmony) {
    const changeAt = event.start + event.duration
    const next = nextEvent(ctx, event)
    if (next.chord.root === event.chord.root || !rng.chance(0.55)) continue
    // The last note of the chord, but never the chord's own downbeat.
    const last = sorted.filter((n) => n.start > event.start && n.start < changeAt).pop()
    if (!last || changeAt - last.start > ctx.beatTicks) continue
    const target = rootIn(next.chord, last.pitch)
    const dir = target >= last.pitch ? 1 : -1
    const options = [target - dir, stepInScale(target, -dir, ctx.key, ctx.scale), clampToBass(target + 7 - 12)]
    last.pitch = clampToBass(rng.pick(options))
  }
}

export function generateBass(
  ctx: GenContext,
  part: BassSettings,
  rng: Rng,
  riff?: readonly NoteDraft[],
): NoteDraft[] {
  const { style } = ctx
  const center = midiOf(ctx.key, part.octave) + 2 - (style.bassStyle === 'sub808' ? 5 : 0)
  const legato = Math.min(1, style.legato)

  if (style.bassStyle === 'walking') return walkingNotes(ctx, center, rng.fork('walk'))
  if (style.bassStyle === 'riff' && riff && riff.length > 0) return riffNotes(ctx, center, riff)

  let hits: Hit[]
  switch (style.bassStyle) {
    case 'octave':
      hits = octaveHits(ctx)
      break
    case 'offbeat':
      hits = offbeatHits(ctx, rng.fork('offbeat'))
      break
    case 'sub808':
      hits = sub808Hits(ctx, rng.fork('808'))
      break
    case 'syncopated':
      hits = syncopatedHits(ctx, rng.fork('sync'))
      break
    default:
      hits = rootHits(ctx)
  }

  const notes: NoteDraft[] = hits.map((hit) => {
    const event = eventAt(ctx, hit.start)
    const end = Math.min(hit.start + hit.duration, event.start + event.duration)
    const root = rootIn(event.chord, center)
    let pitch = root + (hit.interval ?? 0)
    // Keep added intervals (b7, fifth) inside the key or the chord.
    if (!isInScale(pitch, ctx.key, ctx.scale) && !chordPitchClasses(event.chord).includes(pitchClass(pitch))) pitch = root
    const sustain = style.bassStyle === 'sub808' ? 1 : legato * 0.95
    return {
      pitch: clampToBass(pitch),
      start: hit.start,
      duration: Math.max(30, Math.round((end - hit.start) * sustain)),
      velocity: velocity(ctx, hit.level),
    }
  })

  if (part.approachNotes && style.bassStyle !== 'sub808') addApproachNotes(ctx, notes, rng.fork('approach'))
  return notes
}
