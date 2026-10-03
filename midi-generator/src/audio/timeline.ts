/**
 * Pure timing math for the scheduler. Playback runs on an "unwrapped" tick
 * timeline that only ever grows; with looping on it maps back into the loop.
 */
import type { Note, Tick } from '../core/types'

export interface LoopRange {
  start: Tick
  end: Tick
}

/** Wrapped (pattern) tick for an unwrapped playback tick. */
export function wrapTick(unwrapped: Tick, loop: LoopRange | null): Tick {
  if (!loop || unwrapped < loop.start) return unwrapped
  const len = loop.end - loop.start
  if (len <= 0) return loop.start
  return loop.start + ((unwrapped - loop.start) % len)
}

export interface Segment {
  /** Wrapped range [start, end). */
  start: Tick
  end: Tick
  /** Unwrapped tick = wrapped tick + offset. */
  offset: Tick
}

/** Splits the unwrapped window [from, to) into wrapped segments at loop boundaries. */
export function segmentsBetween(from: Tick, to: Tick, loop: LoopRange | null): Segment[] {
  if (to <= from) return []
  if (!loop || loop.end <= loop.start) return [{ start: from, end: to, offset: 0 }]
  const out: Segment[] = []
  let u = from
  while (u < to) {
    const w = wrapTick(u, loop)
    const segEnd = Math.min(to, u + (loop.end - w))
    out.push({ start: w, end: w + (segEnd - u), offset: u - w })
    u = segEnd
  }
  return out
}

export interface ScheduledNote {
  note: Note
  /** Unwrapped tick at which the note starts. */
  at: Tick
  /** Duration in ticks, cut at the loop end so loops don't overlap themselves. */
  duration: Tick
}

/** Notes starting inside the window, with their unwrapped start ticks. */
export function notesInWindow(notes: readonly Note[], from: Tick, to: Tick, loop: LoopRange | null): ScheduledNote[] {
  const out: ScheduledNote[] = []
  for (const seg of segmentsBetween(from, to, loop)) {
    for (const note of notes) {
      if (note.start < seg.start || note.start >= seg.end) continue
      const duration = loop ? Math.min(note.duration, loop.end - note.start) : note.duration
      out.push({ note, at: note.start + seg.offset, duration })
    }
  }
  return out
}

/** Unwrapped ticks of grid lines (e.g. metronome beats) inside the window. */
export function gridInWindow(step: Tick, from: Tick, to: Tick, loop: LoopRange | null): Array<{ at: Tick; tick: Tick }> {
  const out: Array<{ at: Tick; tick: Tick }> = []
  for (const seg of segmentsBetween(from, to, loop)) {
    for (let t = Math.ceil(seg.start / step) * step; t < seg.end; t += step) out.push({ at: t + seg.offset, tick: t })
  }
  return out
}
