import type { Rng } from '../random'
import { PPQ, type Tick } from '../types'
import type { NoteDraft } from './context'

const MIN_DURATION = 15

/**
 * Maps a straight tick position to its swung position. Within each pair of grid
 * steps the off-beat moves later by `amount / 3` of a step (amount 1 = triplet feel);
 * everything in between is stretched linearly so note order is preserved.
 */
export function swingTick(tick: Tick, amount: number, grid: 8 | 16): Tick {
  if (amount <= 0) return tick
  const step = (PPQ * 4) / grid
  const pair = step * 2
  const d = amount / 3
  const pos = tick % pair
  const base = tick - pos
  const swung = pos <= step ? pos * (1 + d) : step * (1 + d) + (pos - step) * (1 - d)
  return base + swung
}

export function applySwing(notes: readonly NoteDraft[], amount: number, grid: 8 | 16): NoteDraft[] {
  if (amount <= 0) return notes.map((n) => ({ ...n }))
  return notes.map((n) => {
    const start = Math.round(swingTick(n.start, amount, grid))
    const end = Math.round(swingTick(n.start + n.duration, amount, grid))
    return { ...n, start, duration: Math.max(MIN_DURATION, end - start) }
  })
}

/**
 * Random timing and velocity deviation. `amount` 0–1 maps to up to ~±20 ticks
 * (at PPQ 480) and ~±12 velocity. Notes on tick 0 stay put so loops start tight.
 */
export function humanize(notes: readonly NoteDraft[], amount: number, rng: Rng): NoteDraft[] {
  if (amount <= 0) return notes.map((n) => ({ ...n }))
  const timingSd = amount * 8
  const velocitySd = amount * 6
  return notes.map((n) => {
    const shift = n.start === 0 ? 0 : Math.round(Math.max(-20, Math.min(20, rng.gaussian(0, timingSd))))
    const velocity = Math.round(n.velocity + Math.max(-12, Math.min(12, rng.gaussian(0, velocitySd))))
    return { ...n, start: Math.max(0, n.start + shift), velocity }
  })
}

/**
 * Makes notes valid and tidy: integer ticks, inside [0, totalTicks), pitch and
 * velocity in MIDI range, sorted, no duplicates and no overlapping notes of the
 * same pitch (the earlier one is shortened).
 */
export function finalizeNotes(notes: readonly NoteDraft[], totalTicks: Tick): NoteDraft[] {
  const cleaned = notes
    .map((n) => {
      const start = Math.max(0, Math.round(n.start))
      const end = Math.min(totalTicks, Math.round(n.start + n.duration))
      return {
        pitch: Math.min(127, Math.max(0, Math.round(n.pitch))),
        start,
        duration: end - start,
        velocity: Math.min(127, Math.max(1, Math.round(n.velocity))),
      }
    })
    .filter((n) => n.start < totalTicks && n.duration >= MIN_DURATION)
    .sort((a, b) => a.start - b.start || a.pitch - b.pitch || b.velocity - a.velocity)

  const out: NoteDraft[] = []
  const lastByPitch = new Map<number, NoteDraft>()
  for (const n of cleaned) {
    const prev = lastByPitch.get(n.pitch)
    if (prev) {
      if (prev.start === n.start) continue // duplicate: keep the louder one (sorted first)
      if (prev.start + prev.duration > n.start) prev.duration = n.start - prev.start
    }
    out.push(n)
    lastByPitch.set(n.pitch, n)
  }
  // Shortening can only shrink a note to the gap before the next one, never below 1 tick.
  return out.filter((n) => n.duration > 0)
}
