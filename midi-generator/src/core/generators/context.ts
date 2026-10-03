import type { ResolvedStyle } from '../presets/style'
import { chordPitchClasses } from '../theory/chords'
import { isCompound, ticksPerBar, ticksPerBeat, ticksPerStep } from '../time'
import type { Chord, GenSettings, HarmonyEvent, PitchClass, ScaleId, Tick, TimeSignature } from '../types'

/** A note before ids are assigned and post-processing runs. */
export interface NoteDraft {
  pitch: number
  start: Tick
  duration: Tick
  velocity: number
}

/** Everything a part generator needs, shared by all parts of one generation run. */
export interface GenContext {
  settings: GenSettings
  style: ResolvedStyle
  key: PitchClass
  scale: ScaleId
  ts: TimeSignature
  bars: number
  /** Ticks per bar, beat and sixteenth step. */
  barTicks: Tick
  beatTicks: Tick
  stepTicks: Tick
  stepsPerBar: number
  /** Sixteenth steps per felt pulse: 4 in x/4, 6 (dotted quarter) in 6/8. */
  pulseSteps: number
  totalTicks: Tick
  harmony: HarmonyEvent[]
}

export function createContext(
  settings: GenSettings,
  style: ResolvedStyle,
  harmony: HarmonyEvent[],
): GenContext {
  const ts = settings.global.timeSignature
  const barTicks = ticksPerBar(ts)
  const stepTicks = ticksPerStep(16)
  return {
    settings,
    style,
    key: settings.global.key,
    scale: style.scale,
    ts,
    bars: settings.global.bars,
    barTicks,
    beatTicks: ticksPerBeat(ts),
    stepTicks,
    stepsPerBar: barTicks / stepTicks,
    pulseSteps: isCompound(ts) ? 6 : ticksPerBeat(ts) / stepTicks,
    totalTicks: barTicks * settings.global.bars,
    harmony,
  }
}

/** Harmony event sounding at `tick` (the last one if past the end). */
export function eventAt(ctx: GenContext, tick: Tick): HarmonyEvent {
  const { harmony } = ctx
  for (let i = harmony.length - 1; i >= 0; i--) if (harmony[i].start <= tick) return harmony[i]
  return harmony[0]
}

export function chordAt(ctx: GenContext, tick: Tick): Chord {
  return eventAt(ctx, tick).chord
}

/** The event after `event`, wrapping to the first (patterns loop). */
export function nextEvent(ctx: GenContext, event: HarmonyEvent): HarmonyEvent {
  const i = ctx.harmony.indexOf(event)
  return ctx.harmony[(i + 1) % ctx.harmony.length]
}

/** Maps a relative loudness 0–1 into the mood's MIDI velocity range. */
export function velocity(ctx: GenContext, relative: number): number {
  const [lo, hi] = ctx.style.velocity
  const v = lo + (hi - lo) * Math.min(1, Math.max(0, relative))
  return Math.min(127, Math.max(1, Math.round(v)))
}

/** Whether a tick falls on a felt beat (pulse). */
export function isOnPulse(ctx: GenContext, tick: Tick): boolean {
  return (tick % ctx.barTicks) % (ctx.pulseSteps * ctx.stepTicks) === 0
}

export function chordTonesIn(chord: Chord, low: number, high: number): number[] {
  const pcs = chordPitchClasses(chord)
  const out: number[] = []
  for (let m = low; m <= high; m++) if (pcs.includes(((m % 12) + 12) % 12)) out.push(m)
  return out
}

/** Nearest element of a sorted list to `target` (ties go down). */
export function nearestIn(values: readonly number[], target: number): number {
  let best = values[0]
  for (const v of values) if (Math.abs(v - target) < Math.abs(best - target)) best = v
  return best
}
