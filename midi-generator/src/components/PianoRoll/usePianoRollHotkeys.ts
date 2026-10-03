import { useEffect, useRef } from 'react'
import { ticksPerBeat } from '../../core/time'
import type { Note, Project, Track } from '../../core/types'
import { isTypingTarget } from '../../hooks/useGlobalHotkeys'
import { usePlaybackStore } from '../../store/playbackStore'
import { useProjectStore } from '../../store/projectStore'
import { SNAP_TICKS, useUiStore } from '../../store/uiStore'
import type { Rows } from './geometry'
import { deleteNotes, duplicateOffset, moveNotes, pasteNotes } from './noteOps'

/** In-app clipboard: copied notes with starts relative to the first one. */
let clipboard: Note[] = []

interface Args {
  project: Project
  track: Track
  rows: Rows
  total: number
}

/**
 * Editing shortcuts for the open track: Delete, Ctrl+A/C/X/V/D, arrows to
 * transpose/move, Esc to deselect and P/E/D to switch tools. Each edit is one
 * undo step.
 */
export function usePianoRollHotkeys(args: Args): void {
  const latest = useRef(args)
  useEffect(() => {
    latest.current = args
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      // Arrow keys belong to focused controls (radio groups, sliders) unless focus is on the page or the editor.
      const target = e.target as HTMLElement | null
      const onPage = !target || target === document.body || target.tagName === 'CANVAS' || target.closest('[data-piano-roll]') !== null
      if (e.key.startsWith('Arrow') && !onPage) return
      const { project, track, rows, total } = latest.current
      const ui = useUiStore.getState()
      const notes = useProjectStore.getState().project?.tracks.find((t) => t.id === track.id)?.notes
      if (!notes) return
      const setNotes = (next: Note[]) => useProjectStore.getState().setNotes(track.id, next)
      const selected = ui.selectedNoteIds
      const selection = notes.filter((n) => selected.has(n.id))
      const mod = e.ctrlKey || e.metaKey
      const bounds = { totalTicks: total, minDuration: 15 }
      const snap = SNAP_TICKS[ui.snap] > 1 ? SNAP_TICKS[ui.snap] : ticksPerBeat(project.timeSignature) / 4
      const key = e.key.toLowerCase()
      let handled = true

      if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
        setNotes(deleteNotes(notes, selected))
        ui.setSelection([])
      } else if (mod && key === 'a') {
        ui.setSelection(notes.map((n) => n.id))
      } else if (mod && (key === 'c' || key === 'x') && selection.length) {
        const first = Math.min(...selection.map((n) => n.start))
        clipboard = selection.map((n) => ({ ...n, start: n.start - first }))
        if (key === 'x') {
          setNotes(deleteNotes(notes, selected))
          ui.setSelection([])
        }
      } else if (mod && key === 'v' && clipboard.length) {
        // Paste at the playback cursor.
        const at = usePlaybackStore.getState().cursor
        const result = pasteNotes(notes, clipboard, at, bounds)
        setNotes(result.notes)
        ui.setSelection(result.ids)
      } else if (mod && key === 'd' && selection.length) {
        const result = pasteNotes(notes, selection, duplicateOffset(selection, snap), bounds)
        setNotes(result.notes)
        ui.setSelection(result.ids)
      } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && selection.length && !mod) {
        // Rows go top to bottom, so "up" is a negative row delta.
        const step = rows.drums ? 1 : e.shiftKey ? 12 : 1
        setNotes(moveNotes(notes, selected, 0, e.key === 'ArrowUp' ? -step : step, rows, bounds))
      } else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && selection.length && !mod) {
        setNotes(moveNotes(notes, selected, e.key === 'ArrowLeft' ? -snap : snap, 0, rows, bounds))
      } else if (e.key === 'Escape') {
        ui.setSelection([])
      } else if (!mod && !e.altKey && (key === 'p' || key === 'b')) {
        ui.setTool('draw')
      } else if (!mod && !e.altKey && key === 'e') {
        ui.setTool('select')
      } else if (!mod && !e.altKey && key === 'd') {
        ui.setTool('delete')
      } else {
        handled = false
      }
      if (handled) e.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
