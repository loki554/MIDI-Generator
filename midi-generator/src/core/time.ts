import { PPQ, type Tick, type TimeSignature } from './types'

/** Ticks in one beat of the given meter (a quarter in 4/4, an eighth in 6/8). */
export function ticksPerBeat(ts: TimeSignature): Tick {
  return (PPQ * 4) / ts.denominator
}

export function ticksPerBar(ts: TimeSignature): Tick {
  return ticksPerBeat(ts) * ts.numerator
}

/** Ticks per step of a 1/n note grid (16 → sixteenth). */
export function ticksPerStep(division: number): Tick {
  return (PPQ * 4) / division
}

export function steps16PerBar(ts: TimeSignature): number {
  return ticksPerBar(ts) / ticksPerStep(16)
}

/** Compound meters (6/8, 9/8, 12/8) group beats in threes. */
export function isCompound(ts: TimeSignature): boolean {
  return ts.denominator === 8 && ts.numerator % 3 === 0
}

export function totalTicks(ts: TimeSignature, bars: number): Tick {
  return ticksPerBar(ts) * bars
}

export function ticksToSeconds(ticks: Tick, bpm: number): number {
  return (ticks / PPQ) * (60 / bpm)
}

export function secondsToTicks(seconds: number, bpm: number): Tick {
  return (seconds * bpm * PPQ) / 60
}

/** 1-based "bar.beat.sixteenth" position for display. */
export function formatPosition(tick: Tick, ts: TimeSignature): string {
  const bar = Math.floor(tick / ticksPerBar(ts))
  const inBar = tick - bar * ticksPerBar(ts)
  const beat = Math.floor(inBar / ticksPerBeat(ts))
  const sixteenth = Math.floor((inBar - beat * ticksPerBeat(ts)) / ticksPerStep(16))
  return `${bar + 1}.${beat + 1}.${sixteenth + 1}`
}
