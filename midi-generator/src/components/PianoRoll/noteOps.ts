/**
 * Pure note edits used by the piano roll. Group operations clamp the *delta*
 * so that every note stays inside the pattern and the row range together.
 */
import type { Note, Tick } from '../../core/types'
import type { Rows } from './geometry'

export interface Bounds {
  totalTicks: Tick
  minDuration: Tick
}

let counter = 0
/** Unique id for notes created in the editor. */
export function newNoteId(): string {
  counter = (counter + 1) % 1_000_000
  return `n${Date.now().toString(36)}${counter.toString(36)}`
}

const byStart = (a: Note, b: Note) => a.start - b.start || a.pitch - b.pitch

/** Moves notes by ticks and rows (rows, so drum rows move between kit pieces). */
export function moveNotes(
  notes: readonly Note[],
  ids: ReadonlySet<string>,
  dTick: Tick,
  dRow: number,
  rows: Rows,
  bounds: Bounds,
): Note[] {
  const moving = notes.filter((n) => ids.has(n.id))
  if (moving.length === 0) return [...notes]
  const minStart = Math.min(...moving.map((n) => n.start))
  const maxEnd = Math.max(...moving.map((n) => n.start + n.duration))
  const dt = Math.max(-minStart, Math.min(bounds.totalTicks - maxEnd, dTick))
  const movingRows = moving.map((n) => rows.rowOf.get(n.pitch) ?? 0)
  const dr = Math.max(-Math.min(...movingRows), Math.min(rows.pitches.length - 1 - Math.max(...movingRows), dRow))
  return notes
    .map((n) => {
      if (!ids.has(n.id)) return n
      const row = (rows.rowOf.get(n.pitch) ?? 0) + dr
      return { ...n, start: n.start + dt, pitch: rows.pitches[row] }
    })
    .sort(byStart)
}

/** Changes durations by `dTick` relative to the given (original) notes. */
export function resizeNotes(notes: readonly Note[], ids: ReadonlySet<string>, dTick: Tick, bounds: Bounds): Note[] {
  return notes.map((n) => {
    if (!ids.has(n.id)) return n
    const duration = Math.max(bounds.minDuration, Math.min(bounds.totalTicks - n.start, n.duration + dTick))
    return { ...n, duration }
  })
}

export function deleteNotes(notes: readonly Note[], ids: ReadonlySet<string>): Note[] {
  return notes.filter((n) => !ids.has(n.id))
}

export function addNote(notes: readonly Note[], note: Note): Note[] {
  return [...notes, note].sort(byStart)
}

export function setVelocity(notes: readonly Note[], velocities: ReadonlyMap<string, number>): Note[] {
  return notes.map((n) => {
    const v = velocities.get(n.id)
    return v === undefined ? n : { ...n, velocity: Math.max(1, Math.min(127, Math.round(v))) }
  })
}

/**
 * Copies of `source` shifted by `offset` with new ids, clipped to the pattern.
 * Returns the merged notes and the ids of the copies (to select them).
 */
export function pasteNotes(
  notes: readonly Note[],
  source: readonly Note[],
  offset: Tick,
  bounds: Bounds,
): { notes: Note[]; ids: string[] } {
  const copies = source
    .map((n) => ({ ...n, id: newNoteId(), start: n.start + offset }))
    .filter((n) => n.start >= 0 && n.start < bounds.totalTicks)
    .map((n) => ({ ...n, duration: Math.min(n.duration, bounds.totalTicks - n.start) }))
  return { notes: [...notes, ...copies].sort(byStart), ids: copies.map((n) => n.id) }
}

/** Span to shift a duplicate by: the selection length rounded up to whole `grid` steps. */
export function duplicateOffset(selection: readonly Note[], grid: Tick): Tick {
  if (selection.length === 0) return 0
  const start = Math.min(...selection.map((n) => n.start))
  const end = Math.max(...selection.map((n) => n.start + n.duration))
  return Math.max(grid, Math.ceil((end - start) / grid) * grid)
}
