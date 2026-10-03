/** Pure coordinate math and hit-testing for the piano roll canvas. */
import { DRUM_NOTES } from '../../core/presets/gm'
import { PPQ, type Note, type Tick, type Track } from '../../core/types'

export const RULER_H = 24
export const KEYS_W = 64
export const DRUM_KEYS_W = 128

/** Rows top to bottom. Melodic tracks show all 128 pitches; drums show kit pieces only. */
export interface Rows {
  pitches: number[]
  rowOf: Map<number, number>
  drums: boolean
}

const STANDARD_KIT = [...new Set(Object.values(DRUM_NOTES))]

export function rowsFor(track: Track): Rows {
  let pitches: number[]
  if (track.partType === 'drums') {
    const used = track.notes.map((n) => n.pitch)
    pitches = [...new Set([...STANDARD_KIT, ...used])].sort((a, b) => b - a)
  } else {
    pitches = Array.from({ length: 128 }, (_, i) => 127 - i)
  }
  return { pitches, rowOf: new Map(pitches.map((p, i) => [p, i])), drums: track.partType === 'drums' }
}

export interface View {
  /** Canvas size in CSS pixels. */
  width: number
  height: number
  scrollX: number
  scrollY: number
  /** Pixels per beat (quarter note) and per row. */
  zoomX: number
  zoomY: number
  keysW: number
}

export const pxPerTick = (v: View) => v.zoomX / PPQ
export const tickToX = (v: View, tick: Tick) => v.keysW + tick * pxPerTick(v) - v.scrollX
export const xToTick = (v: View, x: number): Tick => (x - v.keysW + v.scrollX) / pxPerTick(v)
export const rowToY = (v: View, row: number) => RULER_H + row * v.zoomY - v.scrollY
export const yToRow = (v: View, y: number) => Math.floor((y - RULER_H + v.scrollY) / v.zoomY)

export function contentSize(v: Pick<View, 'zoomX' | 'zoomY' | 'keysW'>, totalTicks: Tick, rows: number) {
  return { width: v.keysW + (totalTicks * v.zoomX) / PPQ, height: RULER_H + rows * v.zoomY }
}

export type Area = 'ruler' | 'keys' | 'grid' | 'corner'

export function areaAt(v: View, x: number, y: number): Area {
  if (y < RULER_H) return x < v.keysW ? 'corner' : 'ruler'
  return x < v.keysW ? 'keys' : 'grid'
}

export interface NoteHit {
  note: Note
  /** 'end' when the pointer is on the note's right edge (resize handle). */
  part: 'body' | 'end'
}

/** Extra pixels right of a note that still grab its resize handle. */
const OUTER_HANDLE = 4

/**
 * Topmost note under the point (later notes are drawn on top, so search
 * backwards). Wide notes have the resize handle inside their right edge;
 * narrow ones are all "body" so they can still be moved, with the handle just
 * outside the right edge.
 */
export function hitNote(v: View, rows: Rows, notes: readonly Note[], x: number, y: number): NoteHit | null {
  const row = yToRow(v, y)
  let edgeHit: NoteHit | null = null
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i]
    if (rows.rowOf.get(n.pitch) !== row) continue
    const x1 = tickToX(v, n.start)
    const x2 = tickToX(v, n.start + n.duration)
    const width = x2 - x1
    if (x >= x1 && x <= x2) {
      const inner = width >= 12 ? Math.min(8, width * 0.3) : 0
      return { note: n, part: inner > 0 && x >= x2 - inner ? 'end' : 'body' }
    }
    if (!edgeHit && x > x2 && x <= x2 + OUTER_HANDLE) edgeHit = { note: n, part: 'end' }
  }
  return edgeHit
}

/** Ids of notes intersecting a rectangle given in ticks and rows (inclusive). */
export function notesInBox(
  rows: Rows,
  notes: readonly Note[],
  box: { t1: Tick; t2: Tick; r1: number; r2: number },
): string[] {
  const [t1, t2] = box.t1 <= box.t2 ? [box.t1, box.t2] : [box.t2, box.t1]
  const [r1, r2] = box.r1 <= box.r2 ? [box.r1, box.r2] : [box.r2, box.r1]
  return notes
    .filter((n) => {
      const r = rows.rowOf.get(n.pitch)
      return r !== undefined && r >= r1 && r <= r2 && n.start < t2 && n.start + n.duration > t1
    })
    .map((n) => n.id)
}

export const snapDown = (tick: Tick, snap: number) => Math.floor(tick / snap) * snap
export const snapRound = (tick: Tick, snap: number) => Math.round(tick / snap) * snap
