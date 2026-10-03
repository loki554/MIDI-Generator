import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { engine, seek } from '../../audio/transport'
import { ticksPerBar, ticksPerBeat, totalTicks } from '../../core/time'
import { PPQ, type Note, type Project, type Track } from '../../core/types'
import { usePlaybackStore } from '../../store/playbackStore'
import { usePrefsStore } from '../../store/prefsStore'
import { createHistoryTransaction, useProjectStore } from '../../store/projectStore'
import { SNAP_TICKS, useUiStore, ZOOM_X, ZOOM_Y } from '../../store/uiStore'
import {
  areaAt,
  contentSize,
  DRUM_KEYS_W,
  hitNote,
  KEYS_W,
  notesInBox,
  type Rows,
  rowsFor,
  RULER_H,
  snapDown,
  snapRound,
  tickToX,
  type View,
  xToTick,
  yToRow,
} from './geometry'
import { addNote, deleteNotes, moveNotes, newNoteId, resizeNotes, setVelocity } from './noteOps'
import { drawRoll, drawVelocityLane, laneVelocity, VELOCITY_H } from './renderer'
import styles from './PianoRoll.module.css'
import { readTheme, resolveColor, type RollTheme } from './theme'
import { usePianoRollHotkeys } from './usePianoRollHotkeys'

type Drag =
  | { kind: 'move'; origin: Note[]; ids: Set<string>; anchor: Note; startTick: number; startRow: number; lastPitch: number }
  | { kind: 'resize'; origin: Note[]; ids: Set<string>; anchor: Note; startTick: number }
  | { kind: 'box'; x0: number; y0: number; x: number; y: number; base: Set<string> }
  | { kind: 'erase' }
  | { kind: 'ruler'; x0: number; startTick: number; dragging: boolean }
  | { kind: 'keys'; pitch: number }
  | { kind: 'velocity'; lastX: number; lastVel: number }

interface Latest {
  project: Project
  track: Track
  rows: Rows
  view: Omit<View, 'scrollX' | 'scrollY'>
  total: number
  theme: RollTheme
  color: string
}

interface PianoRollProps {
  project: Project
  track: Track
}

export function PianoRoll({ project, track }: PianoRollProps) {
  const { t } = useTranslation()
  const scrollerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const laneRef = useRef<HTMLCanvasElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const activeKeyRef = useRef<number | null>(null)
  const txRef = useRef<ReturnType<typeof createHistoryTransaction> | null>(null)
  const frameRef = useRef(0)
  const latestRef = useRef<Latest | null>(null)
  const pendingScrollRef = useRef<{ left?: number; top?: number } | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  const zoomX = useUiStore((s) => s.zoomX)
  const zoomY = useUiStore((s) => s.zoomY)
  const showVelocity = useUiStore((s) => s.showVelocity)
  const fitRequest = useUiStore((s) => s.fitRequest)
  const selected = useUiStore((s) => s.selectedNoteIds)
  const snap = useUiStore((s) => s.snap)
  const tool = useUiStore((s) => s.tool)
  const playing = usePlaybackStore((s) => s.playing)
  const cursor = usePlaybackStore((s) => s.cursor)
  const loopRegion = usePlaybackStore((s) => s.loopRegion)
  const themeName = usePrefsStore((s) => s.theme)

  const rows = rowsFor(track)
  const keysW = rows.drums ? DRUM_KEYS_W : KEYS_W
  const total = totalTicks(project.timeSignature, project.bars)
  const content = contentSize({ zoomX, zoomY, keysW }, total, rows.pitches.length)

  const tx = () => (txRef.current ??= createHistoryTransaction())

  /* ---------- drawing ---------- */

  // Reads only refs, so it is stable across renders.
  const view = useCallback((): View => {
    const l = latestRef.current!
    const el = scrollerRef.current
    return { ...l.view, scrollX: el?.scrollLeft ?? 0, scrollY: el?.scrollTop ?? 0 }
  }, [])

  const draw = () => {
    const l = latestRef.current
    const canvas = canvasRef.current
    if (!l || !canvas || l.view.width === 0) return
    const dpr = window.devicePixelRatio || 1
    const v = view()
    const pw = Math.round(v.width * dpr)
    const ph = Math.round(v.height * dpr)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    const ui = useUiStore.getState()
    const pb = usePlaybackStore.getState()
    const drag = dragRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const ghosts = l.rows.drums
      ? []
      : l.project.tracks
          .filter((tr) => tr.id !== l.track.id && tr.partType !== 'drums')
          .map((tr) => ({ notes: tr.notes, color: resolveColor(tr.color) }))
    drawRoll(
      ctx,
      {
        view: v,
        rows: l.rows,
        totalTicks: l.total,
        beatTicks: ticksPerBeat(l.project.timeSignature),
        barTicks: ticksPerBar(l.project.timeSignature),
        snapTicks: SNAP_TICKS[ui.snap],
        notes: l.track.notes,
        selected: ui.selectedNoteIds,
        color: l.color,
        ghosts,
        key: l.project.key,
        scale: l.project.scale,
        playhead: engine.position(),
        cursor: pb.cursor,
        loopRegion: pb.loopRegion,
        box: drag?.kind === 'box' ? { x1: drag.x0, y1: drag.y0, x2: drag.x, y2: drag.y } : null,
        activeKey: activeKeyRef.current,
        theme: l.theme,
      },
      dpr,
    )
    const lane = laneRef.current
    if (lane && ui.showVelocity) {
      const lw = Math.round(v.width * dpr)
      const lh = Math.round(VELOCITY_H * dpr)
      if (lane.width !== lw || lane.height !== lh) {
        lane.width = lw
        lane.height = lh
      }
      const lctx = lane.getContext('2d')
      if (lctx) {
        drawVelocityLane(
          lctx,
          { view: v, notes: l.track.notes, selected: ui.selectedNoteIds, color: l.color, theme: l.theme, totalTicks: l.total },
          v.width,
          dpr,
          t('pianoRoll.velocityShort'),
        )
      }
    }
  }

  // Stable: always calls the latest draw() through a ref.
  const drawRef = useRef(draw)
  const requestDraw = useCallback(() => {
    if (frameRef.current) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0
      drawRef.current()
    })
  }, [])

  // Keep the latest render data for event handlers and animation frames.
  useLayoutEffect(() => {
    drawRef.current = draw
    latestRef.current = {
      project,
      track,
      rows,
      view: { width: size.width, height: size.height, zoomX, zoomY, keysW },
      total,
      theme: latestRef.current?.theme ?? readTheme(),
      color: resolveColor(track.color),
    }
    if (pendingScrollRef.current && scrollerRef.current) {
      const { left, top } = pendingScrollRef.current
      if (left !== undefined) scrollerRef.current.scrollLeft = left
      if (top !== undefined) scrollerRef.current.scrollTop = top
      pendingScrollRef.current = null
    }
    requestDraw()
  })

  useEffect(() => {
    if (!latestRef.current) return
    // Wait for the theme attribute to be applied before reading the colors.
    requestAnimationFrame(() => {
      if (latestRef.current) latestRef.current = { ...latestRef.current, theme: readTheme(), color: resolveColor(track.color) }
      requestDraw()
    })
  }, [themeName, track.color, requestDraw])

  // Redraw on selection/cursor/loop changes (store values used in draw()).
  useEffect(() => requestDraw(), [selected, cursor, loopRegion, snap, showVelocity, requestDraw])

  // Animate the playhead while playing.
  useEffect(() => {
    if (!playing) {
      requestDraw()
      return
    }
    let raf = 0
    const loop = () => {
      drawRef.current()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, requestDraw])

  // Viewport size.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ width: el.clientWidth, height: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Ctrl+wheel zooms time, Alt+wheel zooms rows, both around the pointer.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey && !e.altKey) return
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const ui = useUiStore.getState()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const v = view()
      if (e.altKey) {
        const row = (y - RULER_H + v.scrollY) / v.zoomY
        const next = Math.min(ZOOM_Y.max, Math.max(ZOOM_Y.min, ui.zoomY * factor))
        pendingScrollRef.current = { top: row * next - (y - RULER_H) }
        ui.setZoom({ y: next })
      } else {
        const tick = xToTick(v, x)
        const next = Math.min(ZOOM_X.max, Math.max(ZOOM_X.min, ui.zoomX * factor))
        pendingScrollRef.current = { left: (tick * next) / PPQ - (x - v.keysW) }
        ui.setZoom({ x: next })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [view])

  // Fit the whole pattern horizontally: on request, for every new project, when
  // switching between drum and melodic tracks (different key column) and once
  // the viewport is measured. Deliberately not on every resize, to keep manual zoom.
  const measured = size.width > 0 && size.height > 0
  useEffect(() => {
    const l = latestRef.current
    if (!measured || !l) return
    const fit = (l.view.width - l.view.keysW - 12) / (l.total / PPQ)
    useUiStore.getState().setZoom({ x: fit })
    pendingScrollRef.current = { left: 0 }
  }, [fitRequest, project.id, measured, rows.drums])

  // Scroll vertically to the notes when a track (or project) is opened.
  useEffect(() => {
    const el = scrollerRef.current
    const l = latestRef.current
    if (!el || !l || !measured) return
    if (l.rows.drums) {
      el.scrollTop = 0
      return
    }
    const pitches = l.track.notes.map((n) => n.pitch).sort((a, b) => a - b)
    const mid = pitches.length ? pitches[Math.floor(pitches.length / 2)] : 60
    const row = l.rows.rowOf.get(mid) ?? 60
    el.scrollTop = Math.max(0, row * l.view.zoomY - (l.view.height - RULER_H) / 2)
  }, [track.id, project.id, measured])

  usePianoRollHotkeys({ project, track, rows, total })

  /* ---------- pointer interactions ---------- */

  const setNotes = (notes: Note[]) => useProjectStore.getState().setNotes(track.id, notes)
  const currentNotes = () => useProjectStore.getState().project?.tracks.find((tr) => tr.id === track.id)?.notes ?? []
  const snapFor = (e: { altKey: boolean }) => (e.altKey ? 1 : SNAP_TICKS[useUiStore.getState().snap])
  const minDuration = (s: number) => Math.max(15, s > 1 ? s : 15)
  const preview = (pitch: number, velocity = 100) => void engine.preview(track, pitch, velocity)
  const local = (e: ReactPointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const eraseAt = (x: number, y: number) => {
    const hit = hitNote(view(), rows, currentNotes(), x, y)
    if (!hit) return
    setNotes(deleteNotes(currentNotes(), new Set([hit.note.id])))
    const ui = useUiStore.getState()
    if (ui.selectedNoteIds.has(hit.note.id)) ui.setSelection([...ui.selectedNoteIds].filter((id) => id !== hit.note.id))
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e)
    const v = view()
    const area = areaAt(v, x, y)
    const ui = useUiStore.getState()
    e.currentTarget.setPointerCapture(e.pointerId)

    if (area === 'ruler') {
      dragRef.current = { kind: 'ruler', x0: x, startTick: Math.max(0, xToTick(v, x)), dragging: false }
      return
    }
    if (area === 'keys') {
      const pitch = rows.pitches[yToRow(v, y)]
      if (pitch === undefined) return
      activeKeyRef.current = pitch
      dragRef.current = { kind: 'keys', pitch }
      preview(pitch)
      requestDraw()
      return
    }
    if (area !== 'grid') return

    const notes = currentNotes()
    const hit = hitNote(v, rows, notes, x, y)

    if (e.button === 2 || ui.tool === 'delete') {
      tx().begin()
      dragRef.current = { kind: 'erase' }
      eraseAt(x, y)
      return
    }
    if (e.button !== 0) return

    if (hit) {
      if (e.ctrlKey || e.metaKey) {
        const next = new Set(ui.selectedNoteIds)
        if (next.has(hit.note.id)) next.delete(hit.note.id)
        else next.add(hit.note.id)
        ui.setSelection(next)
        return
      }
      let ids = new Set(ui.selectedNoteIds)
      if (!ids.has(hit.note.id)) {
        ids = new Set([hit.note.id])
        ui.setSelection(ids)
      }
      ui.setLastNote(hit.note.duration, hit.note.velocity)
      tx().begin()
      const startTick = xToTick(v, x)
      if (hit.part === 'end') {
        dragRef.current = { kind: 'resize', origin: notes, ids, anchor: hit.note, startTick }
      } else {
        dragRef.current = { kind: 'move', origin: notes, ids, anchor: hit.note, startTick, startRow: yToRow(v, y), lastPitch: hit.note.pitch }
        preview(hit.note.pitch, hit.note.velocity)
      }
      return
    }

    if (e.shiftKey || ui.tool === 'select') {
      // Shift+drag (or the select tool) replaces the selection; with Ctrl it adds to it.
      const additive = e.ctrlKey || e.metaKey
      const base = additive ? new Set(ui.selectedNoteIds) : new Set<string>()
      if (!additive) ui.setSelection([])
      dragRef.current = { kind: 'box', x0: x, y0: y, x, y, base }
      return
    }

    // Draw tool on empty space: create a note and keep dragging it.
    const row = yToRow(v, y)
    const tick = xToTick(v, x)
    if (row < 0 || row >= rows.pitches.length || tick < 0 || tick >= total) return
    const s = snapFor(e)
    const start = snapDown(tick, s)
    const note: Note = {
      id: newNoteId(),
      pitch: rows.pitches[row],
      start,
      duration: Math.max(minDuration(s), Math.min(ui.lastNoteLength, total - start)),
      velocity: ui.lastVelocity,
    }
    tx().begin()
    const next = addNote(notes, note)
    setNotes(next)
    ui.setSelection([note.id])
    preview(note.pitch, note.velocity)
    dragRef.current = { kind: 'move', origin: next, ids: new Set([note.id]), anchor: note, startTick: tick, startRow: row, lastPitch: note.pitch }
  }

  const updateCursor = (x: number, y: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const v = view()
    const area = areaAt(v, x, y)
    let cursorStyle = 'default'
    if (area === 'ruler') cursorStyle = 'text'
    else if (area === 'keys') cursorStyle = 'pointer'
    else if (area === 'grid') {
      const tool = useUiStore.getState().tool
      const hit = hitNote(v, rows, currentNotes(), x, y)
      if (tool === 'delete') cursorStyle = 'not-allowed'
      else if (hit) cursorStyle = hit.part === 'end' ? 'ew-resize' : 'move'
      else cursorStyle = tool === 'draw' ? 'crosshair' : 'default'
    }
    if (canvas.style.cursor !== cursorStyle) canvas.style.cursor = cursorStyle
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const { x, y } = local(e)
    const drag = dragRef.current
    if (!drag) {
      updateCursor(x, y)
      return
    }
    const v = view()
    const s = snapFor(e)
    switch (drag.kind) {
      case 'move': {
        const rawStart = drag.anchor.start + (xToTick(v, x) - drag.startTick)
        const dTick = (s > 1 ? snapRound(rawStart, s) : Math.round(rawStart)) - drag.anchor.start
        const dRow = yToRow(v, y) - drag.startRow
        const next = moveNotes(drag.origin, drag.ids, dTick, dRow, rows, { totalTicks: total, minDuration: 15 })
        setNotes(next)
        const pitch = next.find((n) => n.id === drag.anchor.id)?.pitch
        if (pitch !== undefined && pitch !== drag.lastPitch) {
          drag.lastPitch = pitch
          preview(pitch, drag.anchor.velocity)
        }
        break
      }
      case 'resize': {
        const rawEnd = drag.anchor.start + drag.anchor.duration + (xToTick(v, x) - drag.startTick)
        const end = s > 1 ? snapRound(rawEnd, s) : Math.round(rawEnd)
        const dTick = end - (drag.anchor.start + drag.anchor.duration)
        const next = resizeNotes(drag.origin, drag.ids, dTick, { totalTicks: total, minDuration: minDuration(s) })
        setNotes(next)
        const anchor = next.find((n) => n.id === drag.anchor.id)
        if (anchor) useUiStore.getState().setLastNote(anchor.duration)
        break
      }
      case 'box': {
        drag.x = x
        drag.y = y
        const ids = notesInBox(rows, currentNotes(), {
          t1: xToTick(v, drag.x0),
          t2: xToTick(v, x),
          r1: yToRow(v, drag.y0),
          r2: yToRow(v, y),
        })
        useUiStore.getState().setSelection([...drag.base, ...ids])
        requestDraw()
        break
      }
      case 'erase':
        eraseAt(x, y)
        break
      case 'ruler': {
        if (!drag.dragging && Math.abs(x - drag.x0) < 4) break
        drag.dragging = true
        const a = snapRound(drag.startTick, s)
        const b = snapRound(Math.max(0, Math.min(total, xToTick(v, x))), s)
        const pb = usePlaybackStore.getState()
        if (Math.abs(b - a) >= s) {
          pb.setLoopRegion({ start: Math.min(a, b), end: Math.max(a, b) })
          if (!pb.loop) pb.setLoop(true)
        }
        break
      }
      case 'keys': {
        const pitch = rows.pitches[yToRow(v, y)]
        if (pitch !== undefined && pitch !== drag.pitch) {
          drag.pitch = pitch
          activeKeyRef.current = pitch
          preview(pitch)
          requestDraw()
        }
        break
      }
    }
  }

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    if (drag.kind === 'ruler' && !drag.dragging) {
      seek(Math.min(total - 1, Math.max(0, snapRound(drag.startTick, snapFor(e)))))
    }
    if (drag.kind === 'keys') activeKeyRef.current = null
    if (drag.kind === 'box') {
      // Plain click on empty space in the select tool clears the selection.
      if (Math.abs(drag.x - drag.x0) < 3 && Math.abs(drag.y - drag.y0) < 3) useUiStore.getState().setSelection(drag.base)
    }
    tx().end()
    requestDraw()
  }

  const onDoubleClick = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    if (areaAt(view(), e.clientX - r.left, e.clientY - r.top) === 'ruler') usePlaybackStore.getState().setLoopRegion(null)
  }

  /* ---------- velocity lane ---------- */

  const applyVelocityLine = (x0: number, v0: number, x1: number, v1: number) => {
    const v = view()
    const ui = useUiStore.getState()
    const [xa, xb] = x0 <= x1 ? [x0, x1] : [x1, x0]
    const changes = new Map<string, number>()
    for (const n of currentNotes()) {
      if (ui.selectedNoteIds.size > 0 && !ui.selectedNoteIds.has(n.id)) continue
      const nx = tickToX(v, n.start)
      if (nx < xa - 4 || nx > xb + 4) continue
      const f = xb === xa ? 1 : (nx - x0) / (x1 - x0)
      changes.set(n.id, v0 + (v1 - v0) * Math.min(1, Math.max(0, f)))
    }
    if (changes.size > 0) setNotes(setVelocity(currentNotes(), changes))
  }

  const onLaneDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = local(e)
    const vel = laneVelocity(y)
    tx().begin()
    dragRef.current = { kind: 'velocity', lastX: x, lastVel: vel }
    applyVelocityLine(x, vel, x, vel)
    useUiStore.getState().setLastNote(useUiStore.getState().lastNoteLength, vel)
  }

  const onLaneMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (drag?.kind !== 'velocity') return
    const { x, y } = local(e)
    const vel = laneVelocity(y)
    applyVelocityLine(drag.lastX, drag.lastVel, x, vel)
    drag.lastX = x
    drag.lastVel = vel
  }

  const onLaneUp = () => {
    if (dragRef.current?.kind === 'velocity') dragRef.current = null
    tx().end()
  }

  const toolClass = tool === 'delete' ? styles.toolDelete : ''

  return (
    <div className={styles.root}>
      <div ref={scrollerRef} className={styles.scroller} onScroll={requestDraw}>
        <div
          className={styles.spacer}
          style={{ width: Math.max(content.width + 24, size.width), height: Math.max(content.height, size.height) }}
        >
          <canvas
            ref={canvasRef}
            className={`${styles.canvas} ${toolClass}`}
            style={{ width: size.width, height: size.height }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onDoubleClick={onDoubleClick}
            onContextMenu={(e) => e.preventDefault()}
            aria-label={t('pianoRoll.title')}
            role="img"
          />
        </div>
      </div>
      {showVelocity && (
        <canvas
          ref={laneRef}
          className={styles.lane}
          style={{ width: size.width, height: VELOCITY_H }}
          onPointerDown={onLaneDown}
          onPointerMove={onLaneMove}
          onPointerUp={onLaneUp}
          onPointerCancel={onLaneUp}
          aria-label={t('pianoRoll.velocity')}
          role="img"
        />
      )}
    </div>
  )
}
