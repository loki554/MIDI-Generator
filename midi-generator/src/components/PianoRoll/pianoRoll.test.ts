import { describe, expect, it } from 'vitest'
import { PPQ, type Note, type Track } from '../../core/types'
import { hitNote, notesInBox, rowsFor, tickToX, xToTick, yToRow, rowToY, RULER_H, type View } from './geometry'
import { deleteNotes, duplicateOffset, moveNotes, pasteNotes, resizeNotes, setVelocity } from './noteOps'

const note = (id: string, pitch: number, start: number, duration = PPQ): Note => ({ id, pitch, start, duration, velocity: 100 })

const track = (partType: Track['partType'], notes: Note[] = []): Track => ({
  id: partType,
  partType,
  name: partType,
  program: 0,
  channel: 0,
  color: '#fff',
  muted: false,
  solo: false,
  volume: 1,
  notes,
  seed: 1,
})

const view: View = { width: 800, height: 400, scrollX: 0, scrollY: 0, zoomX: 100, zoomY: 10, keysW: 64 }
const bounds = { totalTicks: PPQ * 16, minDuration: 30 }

describe('geometry', () => {
  it('maps ticks and rows to pixels and back', () => {
    expect(tickToX(view, PPQ)).toBe(164)
    expect(xToTick(view, 164)).toBe(PPQ)
    const scrolled = { ...view, scrollX: 50, scrollY: 30 }
    expect(xToTick(scrolled, tickToX(scrolled, 777))).toBeCloseTo(777)
    expect(yToRow(scrolled, rowToY(scrolled, 42) + 1)).toBe(42)
  })

  it('builds 128 rows for melodic tracks and kit rows for drums', () => {
    const melodic = rowsFor(track('melody'))
    expect(melodic.pitches[0]).toBe(127)
    expect(melodic.rowOf.get(60)).toBe(67)
    const drums = rowsFor(track('drums', [note('a', 77, 0)]))
    expect(drums.drums).toBe(true)
    expect(drums.pitches).toContain(36)
    expect(drums.pitches).toContain(77) // used notes outside the standard kit are kept
    expect(drums.pitches).toEqual([...drums.pitches].sort((a, b) => b - a))
  })

  it('hits notes and their resize handle', () => {
    const rows = rowsFor(track('melody'))
    const n = note('a', 60, PPQ, PPQ)
    const y = rowToY(view, rows.rowOf.get(60)!) + 5
    expect(hitNote(view, rows, [n], tickToX(view, PPQ) + 10, y)).toEqual({ note: n, part: 'body' })
    expect(hitNote(view, rows, [n], tickToX(view, 2 * PPQ) - 2, y)?.part).toBe('end')
    expect(hitNote(view, rows, [n], tickToX(view, PPQ) + 10, y + view.zoomY)).toBeNull()
    expect(y).toBeGreaterThan(RULER_H)
  })

  it('keeps narrow notes movable, with the resize handle just past their end', () => {
    const rows = rowsFor(track('melody'))
    const tiny = note('t', 60, PPQ, 30) // ~6 px at this zoom
    const y = rowToY(view, rows.rowOf.get(60)!) + 5
    const x2 = tickToX(view, PPQ + 30)
    expect(hitNote(view, rows, [tiny], x2 - 1, y)?.part).toBe('body')
    expect(hitNote(view, rows, [tiny], x2 + 3, y)?.part).toBe('end')
    expect(hitNote(view, rows, [tiny], x2 + 6, y)).toBeNull()
  })

  it('selects notes intersecting a box', () => {
    const rows = rowsFor(track('melody'))
    const notes = [note('a', 60, 0), note('b', 62, PPQ * 2), note('c', 72, 0)]
    const r60 = rows.rowOf.get(60)!
    const r62 = rows.rowOf.get(62)!
    expect(notesInBox(rows, notes, { t1: PPQ * 3, t2: 10, r1: r60, r2: r62 }).sort()).toEqual(['a', 'b'])
  })
})

describe('note operations', () => {
  const rows = rowsFor(track('melody'))
  const notes = [note('a', 60, 0), note('b', 64, PPQ), note('c', 67, PPQ * 4)]

  it('moves a group, clamping it at the pattern start and end', () => {
    const moved = moveNotes(notes, new Set(['a', 'b']), -PPQ * 5, -2, rows, bounds)
    expect(moved.find((n) => n.id === 'a')).toMatchObject({ start: 0, pitch: 62 }) // can't go before 0
    expect(moved.find((n) => n.id === 'b')).toMatchObject({ start: PPQ, pitch: 66 }) // group keeps its shape
    const late = moveNotes(notes, new Set(['c']), PPQ * 100, 0, rows, bounds)
    expect(late.find((n) => n.id === 'c')!.start).toBe(bounds.totalTicks - PPQ)
  })

  it('moves drum notes between kit rows', () => {
    const drumRows = rowsFor(track('drums'))
    const kick = note('k', 36, 0)
    const [moved] = moveNotes([kick], new Set(['k']), 0, -1, drumRows, bounds)
    expect(moved.pitch).toBe(drumRows.pitches[drumRows.rowOf.get(36)! - 1])
  })

  it('resizes with a minimum length and the pattern end', () => {
    expect(resizeNotes(notes, new Set(['a']), -PPQ * 10, bounds)[0].duration).toBe(30)
    expect(resizeNotes(notes, new Set(['c']), PPQ * 100, bounds)[2].duration).toBe(bounds.totalTicks - PPQ * 4)
  })

  it('deletes, sets velocity and pastes with fresh ids', () => {
    expect(deleteNotes(notes, new Set(['b'])).map((n) => n.id)).toEqual(['a', 'c'])
    expect(setVelocity(notes, new Map([['a', 300]]))[0].velocity).toBe(127)
    const { notes: pasted, ids } = pasteNotes(notes, [notes[0], notes[1]], PPQ * 8, bounds)
    expect(pasted).toHaveLength(5)
    expect(ids).toHaveLength(2)
    expect(ids.some((id) => notes.some((n) => n.id === id))).toBe(false)
    expect(pasted.filter((n) => ids.includes(n.id)).map((n) => n.start)).toEqual([PPQ * 8, PPQ * 9])
  })

  it('drops pasted notes beyond the pattern end', () => {
    const { ids } = pasteNotes([], notes, bounds.totalTicks - PPQ, bounds)
    expect(ids).toHaveLength(1)
  })

  it('duplicates by the selection length rounded to the grid', () => {
    expect(duplicateOffset([note('a', 60, 0, PPQ * 3)], PPQ * 4)).toBe(PPQ * 4)
    expect(duplicateOffset([note('a', 60, PPQ, PPQ)], PPQ / 4)).toBe(PPQ)
  })
})
