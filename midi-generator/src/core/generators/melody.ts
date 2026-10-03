import type { Rng } from '../random'
import { chordPitchClasses } from '../theory/chords'
import { midiOf, pitchClass } from '../theory/notes'
import { scaleNotesInRange, snapToScale } from '../theory/scales'
import type { MelodySettings, Tick } from '../types'
import { chordAt, chordTonesIn, type GenContext, nearestIn, type NoteDraft, velocity } from './context'

/** One rhythmic event inside a segment, in sixteenth steps. Negative length = rest. */
type RhythmEvent = { step: number; length: number; rest: boolean }

/** Pulse templates (step lengths summing to one pulse); negative = rest. */
const PULSE_TEMPLATES_4: ReadonlyArray<readonly [readonly number[], number, number]> = [
  // [template, weight at low density, weight at high density]
  [[4], 3, 1],
  [[2, 2], 2, 3],
  [[3, 1], 1, 1.5],
  [[2, 1, 1], 0.3, 1.5],
  [[1, 1, 2], 0.3, 1.5],
  [[1, 1, 1, 1], 0, 1.2],
  [[-4], 2.5, 0.2],
  [[2, -2], 1.5, 0.5],
  [[-2, 2], 1, 0.8],
]

const PULSE_TEMPLATES_6: ReadonlyArray<readonly [readonly number[], number, number]> = [
  [[6], 3, 1],
  [[2, 2, 2], 1, 3],
  [[4, 2], 2, 2],
  [[2, 4], 1, 1],
  [[-6], 2.5, 0.2],
  [[-2, 2, 2], 1, 1],
  [[2, 2, -2], 1, 0.7],
]

/** Rhythm of a segment of `bars` bars. */
function makeRhythm(ctx: GenContext, bars: number, density: number, rng: Rng): RhythmEvent[] {
  const templates = ctx.pulseSteps === 6 ? PULSE_TEMPLATES_6 : PULSE_TEMPLATES_4
  const t = Math.min(1, Math.max(0, (density - 0.3) / 1.2)) // 0 sparse … 1 busy
  const allow16 = ctx.style.melodyGrid === 16
  const usable = templates.filter(([tpl]) => allow16 || tpl.every((l) => Math.abs(l) % 2 === 0))
  const entries = usable.map(([tpl, lo, hi]) => [tpl, lo + (hi - lo) * t] as const)

  const events: RhythmEvent[] = []
  const pulses = Math.floor((bars * ctx.stepsPerBar) / ctx.pulseSteps)
  for (let p = 0; p < pulses; p++) {
    let step = p * ctx.pulseSteps
    for (const len of rng.weightedPick(entries)) {
      events.push({ step, length: Math.abs(len), rest: len < 0 })
      step += Math.abs(len)
    }
  }
  // Tie some notes into the following rest for longer, singing lines.
  for (let i = 0; i < events.length - 1; i++) {
    if (!events[i].rest && events[i + 1].rest && rng.chance(0.4 * ctx.style.legato)) {
      events[i].length += events[i + 1].length
      events.splice(i + 1, 1)
    }
  }
  // Phrase ending: hold the last note of the segment.
  const lastBarStart = (bars - 1) * ctx.stepsPerBar
  const endIdx = events.findIndex((e) => e.step >= lastBarStart + ctx.pulseSteps && !e.rest)
  if (endIdx > 0 && rng.chance(0.7)) {
    const held = events[endIdx]
    held.length = Math.max(ctx.pulseSteps, Math.min(bars * ctx.stepsPerBar - held.step - ctx.pulseSteps, 8))
    events.splice(endIdx + 1)
    const after = held.step + held.length
    if (after < bars * ctx.stepsPerBar) events.push({ step: after, length: bars * ctx.stepsPerBar - after, rest: true })
  }
  // Never start a phrase with nothing at all.
  if (events.every((e) => e.rest)) events[0].rest = false
  return events
}

/** Scale-step moves for each note: mostly steps, occasional leaps, arch-shaped. */
function makeContour(count: number, rng: Rng): number[] {
  const moves: number[] = []
  for (let i = 0; i < count; i++) {
    const rising = i < count / 2
    const step = rng.weightedPick([
      [0, 1.2],
      [1, rising ? 3 : 2],
      [-1, rising ? 2 : 3],
      [2, 1.2],
      [-2, 1.2],
      [3, 0.4],
      [-3, 0.4],
      [4, 0.25],
      [-4, 0.25],
    ] as const)
    moves.push(step)
  }
  return moves
}

interface Motif {
  rhythm: RhythmEvent[]
  moves: number[]
}

function vary(motif: Motif, amount: number, rng: Rng): Motif {
  return {
    rhythm: motif.rhythm.map((e) => ({ ...e })),
    moves: motif.moves.map((m) => (rng.chance(amount) ? m + rng.pick([-1, 1]) : m)),
  }
}

export function generateMelody(ctx: GenContext, part: MelodySettings, rng: Rng): NoteDraft[] {
  const { style } = ctx
  const low = midiOf(ctx.key, part.octave + style.register)
  const high = low + Math.max(7, part.range)
  const scaleNotes = scaleNotesInRange(ctx.key, ctx.scale, low, high)
  const density = style.density * (0.5 + part.density)

  // Segments of the phrase structure (AABA…), each 1+ bars.
  const segBars = Math.max(1, Math.floor(ctx.bars / 4))
  const segments = Math.ceil(ctx.bars / segBars)
  const letters = style.structure.split('')

  const motifs = new Map<string, Motif>()
  const notes: NoteDraft[] = []
  let pitch = nearestIn(chordTonesIn(ctx.harmony[0].chord, low, high), low + (high - low) * 0.4)
  let forcedDir = 0
  let repeats = 0
  const firstPitch = new Map<string, number>()

  for (let s = 0; s < segments; s++) {
    const bars = Math.min(segBars, ctx.bars - s * segBars)
    const letter = letters[s % letters.length]
    const segRng = rng.fork('segment', s)
    let motif = motifs.get(letter)
    // Pitch the segment's first note starts on; null = continue from the previous note.
    let anchor: number | null = null
    if (!motif || bars !== segBars) {
      const rhythm = makeRhythm(ctx, bars, density, segRng)
      motif = { rhythm, moves: makeContour(rhythm.length, segRng) }
      if (!motifs.has(letter)) {
        motifs.set(letter, motif)
        anchor = pitch
      }
    } else if (!segRng.chance(part.repetition)) {
      // Development: sequence (shifted start), inversion or small mutations.
      const kind = segRng.weightedPick([['sequence', 1], ['invert', 0.6], ['mutate', 1.4]] as const)
      if (kind === 'invert') motif = { rhythm: motif.rhythm, moves: motif.moves.map((m) => -m) }
      else motif = vary(motif, kind === 'mutate' ? 0.3 : 0, segRng)
      if (kind === 'sequence') {
        anchor = snapToScale(firstPitch.get(letter)! + segRng.pick([-3, -2, 2, 3]), ctx.key, ctx.scale)
      }
    } else {
      // Literal repeat: restart from the same pitch so the motif is recognisable.
      anchor = firstPitch.get(letter)!
    }

    const segStart: Tick = s * segBars * ctx.barTicks
    const playable = motif.rhythm.filter((e) => !e.rest)
    playable.forEach((event, i) => {
      const start = segStart + event.step * ctx.stepTicks
      if (start >= ctx.totalTicks) return
      const chord = chordAt(ctx, start)
      const strong = event.step % ctx.pulseSteps === 0 || event.length >= ctx.pulseSteps
      const isFirst = i === 0

      let move = forcedDir !== 0 ? forcedDir : (motif.moves[i] ?? 0)
      forcedDir = 0
      if (move === 0 && repeats >= 1) move = pitch > (low + high) / 2 ? -1 : 1

      // Move through the scale from the previous pitch.
      const idx = scaleNotes.indexOf(nearestIn(scaleNotes, pitch))
      let targetIdx = idx + move
      if (targetIdx < 0 || targetIdx >= scaleNotes.length) targetIdx = idx - move // reflect at the range edge
      targetIdx = Math.min(scaleNotes.length - 1, Math.max(0, targetIdx))
      let next = isFirst && anchor !== null ? nearestIn(scaleNotes, anchor) : scaleNotes[targetIdx]

      // Strong beats land on chord tones.
      if (strong) {
        const tones = chordTonesIn(chord, low, high)
        if (tones.length > 0) next = nearestIn(tones, next)
      }

      // Leap compensation: after a leap, step back the other way.
      const interval = next - pitch
      if (Math.abs(interval) > 4) forcedDir = interval > 0 ? -1 : 1
      repeats = next === pitch ? repeats + 1 : 0
      pitch = next
      if (isFirst && !firstPitch.has(letter)) firstPitch.set(letter, pitch)

      const end = Math.min(start + event.length * ctx.stepTicks, ctx.totalTicks)
      const accent = strong ? 0.12 : 0
      const arc = Math.sin((Math.PI * (i + 0.5)) / playable.length) * 0.1
      notes.push({
        pitch,
        start,
        duration: Math.max(30, Math.round((end - start) * Math.min(1, 0.9 * style.legato))),
        velocity: velocity(ctx, 0.62 + accent + arc),
      })
    })
  }

  // Cadence: end the melody on a stable chord tone (root or third) of the last chord.
  // Chosen near the previous note so the line resolves by step instead of leaping.
  const last = notes[notes.length - 1]
  if (last) {
    const chord = chordAt(ctx, last.start)
    const pcs = chordPitchClasses(chord)
    const stable = chordTonesIn(chord, low, high).filter((p) => pitchClass(p) === pcs[0] || pitchClass(p) === pcs[1])
    const before = notes.length > 1 ? notes[notes.length - 2].pitch : last.pitch
    if (stable.length > 0) last.pitch = nearestIn(stable, before)
  }
  return notes
}
