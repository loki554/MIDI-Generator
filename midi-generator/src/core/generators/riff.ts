import type { Rng } from '../random'
import { midiOf, nearestWithPitchClass } from '../theory/notes'
import { SCALES, isInScale, snapToScale } from '../theory/scales'
import type { RiffSettings, RiffStyle, Tick } from '../types'
import { eventAt, type GenContext, type NoteDraft, velocity } from './context'

/**
 * Riff tokens, one per sixteenth step:
 *   P  palm-muted root (short)      O  open root
 *   C  power chord                  N  melodic single note (offset from root, see `offsets`)
 *   -  hold the previous note       .  rest
 */
interface RiffCell {
  tokens: string[]
  /** Semitone offsets above the root for 'N' tokens, by step. */
  offsets: Map<number, number>
}

const GROOVE_INTERVALS = [0, 3, 5, 6, 7, 10, 12] // minor pentatonic + blue note

function emptyCell(steps: number): RiffCell {
  return { tokens: Array.from({ length: steps }, () => '.'), offsets: new Map() }
}

/** Scale-aware melodic offsets above the root for tremolo lines. */
function scaleOffsets(ctx: GenContext): number[] {
  const iv = SCALES[ctx.scale].intervals
  return [...iv, 12]
}

function makeCell(ctx: GenContext, style: RiffStyle, rng: Rng): RiffCell {
  const steps = ctx.stepsPerBar
  const d = ctx.style.density
  const cell = emptyCell(steps)
  const t = cell.tokens

  switch (style) {
    case 'gallop': {
      for (let s = 0; s < steps; s += 4) {
        t[s] = 'P'
        if (s + 2 < steps) t[s + 2] = 'P'
        if (s + 3 < steps) t[s + 3] = 'P'
      }
      t[0] = 'C'
      if (steps >= 16 && rng.chance(0.5)) t[8] = 'C'
      break
    }
    case 'tremolo': {
      const offsets = scaleOffsets(ctx)
      let idx = 0
      for (let s = 0; s < steps; s++) {
        if (s % rng.pick([2, 4]) === 0 && s > 0) idx = Math.max(0, Math.min(offsets.length - 1, idx + rng.pick([-1, 1, 1, 2, -2])))
        t[s] = 'N'
        cell.offsets.set(s, offsets[idx])
      }
      break
    }
    case 'groove': {
      for (let s = 0; s < steps; s += 2) {
        if (s === 0) t[s] = 'C'
        else if (rng.chance(0.55 * d)) {
          t[s] = 'N'
          cell.offsets.set(s, rng.pick(GROOVE_INTERVALS))
        } else if (rng.chance(0.4)) t[s] = '-'
      }
      if (t[1] === '.') t[1] = '-'
      break
    }
    case 'halfTime': {
      t[0] = 'C'
      for (let s = 1; s < steps; s++) t[s] = '-'
      if (steps >= 16 && rng.chance(0.5)) {
        t[8] = rng.chance(0.5) ? 'C' : 'O'
      } else if (rng.chance(0.4)) {
        // A slow step away and back; chromatic colour is left to colour().
        t[steps - 4] = 'N'
        cell.offsets.set(steps - 4, rng.pick([3, 5, 7, 10]))
      }
      break
    }
    default: {
      // chug: palm-muted pedal on eighths, bursts of sixteenths, power-chord accents
      t[0] = 'C'
      t[1] = '-'
      for (let s = 2; s < steps; s++) {
        const onEighth = s % 2 === 0
        if (rng.chance(onEighth ? 0.85 * Math.min(1, d) : 0.35 * d)) t[s] = 'P'
      }
      for (const s of [3, 6, 10, 11, 14]) {
        if (s < steps && rng.chance(0.18)) {
          t[s] = 'C'
          if (s + 1 < steps) t[s + 1] = '-'
        }
      }
    }
  }
  return cell
}

/** Adds chromatic and modal colour: approach runs, tritone accents, phrygian b2. */
function colour(ctx: GenContext, cell: RiffCell, amount: number, rng: Rng): RiffCell {
  const out: RiffCell = { tokens: [...cell.tokens], offsets: new Map(cell.offsets) }
  const steps = out.tokens.length
  for (let s = 1; s < steps; s++) {
    if (out.tokens[s] === 'P' && s % 2 === 1 && rng.chance(amount * 0.5)) {
      out.tokens[s] = 'N'
      out.offsets.set(s, 1) // phrygian b2 stab
    }
    if (out.tokens[s] === 'C' && s > 0 && rng.chance(amount * 0.35)) {
      out.tokens[s] = 'T' // tritone power chord
    }
  }
  if (ctx.style.riffStyle !== 'halfTime' && rng.chance(amount)) {
    // Chromatic approach run into the next bar: marked with 'A' and resolved later.
    for (let s = steps - 3; s < steps; s++) out.tokens[s] = 'A'
  }
  return out
}

export function generateRiff(ctx: GenContext, part: RiffSettings, rng: Rng): NoteDraft[] {
  const style = ctx.style.riffStyle
  const center = midiOf(4, part.octave) // around E of the chosen octave
  const rootFor = (tick: Tick) => {
    const root = nearestWithPitchClass(eventAt(ctx, tick).chord.root, center)
    return root < 28 ? root + 12 : root
  }
  const onTonic = (tick: Tick) => eventAt(ctx, tick).chord.root === ctx.key
  const palmMute = part.palmMute
  const legato = Math.min(1, ctx.style.legato)

  const a = makeCell(ctx, style, rng.fork('A'))
  const b = makeCell(ctx, style, rng.fork('B'))
  const notes: NoteDraft[] = []
  const step = ctx.stepTicks
  // Halftime riffs breathe over two bars.
  const cellBars = style === 'halfTime' ? 2 : 1

  for (let bar = 0; bar < ctx.bars; bar += 1) {
    if (cellBars === 2 && bar % 2 === 1) continue
    const base = bar % 4 === 3 ? b : a
    const cell = colour(ctx, base, part.chromaticism, rng.fork('colour', bar))
    const barStart = bar * ctx.barTicks
    const span = Math.min(cellBars, ctx.bars - bar) * ctx.stepsPerBar
    const stretch = span / cell.tokens.length

    for (let i = 0; i < cell.tokens.length; i++) {
      const token = cell.tokens[i]
      if (token === '.' || token === '-') continue
      const start = barStart + Math.round(i * stretch) * step
      if (start >= ctx.totalTicks) continue
      // Length runs over following holds.
      let len = 1
      while (i + len < cell.tokens.length && cell.tokens[i + len] === '-') len++
      const lengthTicks = Math.round(len * stretch * step)
      const root = rootFor(start)
      const accent = i % ctx.pulseSteps === 0 ? 0.12 : 0

      const push = (pitch: number, duration: number, level: number) =>
        notes.push({ pitch, start, duration: Math.max(20, Math.round(duration)), velocity: velocity(ctx, level + accent) })

      switch (token) {
        case 'P': {
          const muted = rng.chance(0.4 + palmMute * 0.6)
          push(root, muted ? step * 0.5 : lengthTicks * legato, muted ? 0.66 : 0.76)
          break
        }
        case 'O':
          push(root, lengthTicks * legato, 0.8)
          break
        case 'C':
        case 'T': {
          // Tritone power chords only over the tonic, where they read as colour, not a wrong chord.
          const r = token === 'T' && onTonic(start) ? root + 6 : root
          for (const p of [r, r + 7, r + 12]) push(p, lengthTicks * legato, 0.84)
          break
        }
        case 'N': {
          const offset = cell.offsets.get(i) ?? 0
          let pitch = root + offset
          // Out-of-key notes are kept only as deliberate colour over the tonic (b2, blue note);
          // everywhere else they snap into the scale.
          const colourNote = (offset === 1 || offset === 6) && onTonic(start)
          if (!colourNote && !isInScale(pitch, ctx.key, ctx.scale)) pitch = snapToScale(pitch, ctx.key, ctx.scale)
          push(pitch, Math.min(lengthTicks, step * 2) * legato, 0.74)
          break
        }
        case 'A': {
          // Chromatic run into the next bar's root (the pattern loops at the end): -3, -2, -1 semitones.
          const nextBar = barStart + span * step
          const target = rootFor(nextBar >= ctx.totalTicks ? 0 : nextBar)
          push(target - (cell.tokens.length - i), step * 0.8, 0.72)
          break
        }
      }
    }
  }
  return notes
}
