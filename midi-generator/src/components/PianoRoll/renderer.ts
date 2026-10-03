/** Draws the piano roll (ruler, keyboard, grid, notes, playhead) onto a 2D canvas. */
import { GM_DRUM_NAMES } from '../../core/presets/gm'
import { isBlackKey, midiToName, pitchClass } from '../../core/theory/notes'
import { isInScale } from '../../core/theory/scales'
import { PPQ, type Note, type PitchClass, type ScaleId, type Tick } from '../../core/types'
import { type Rows, RULER_H, rowToY, tickToX, type View, xToTick, yToRow } from './geometry'
import type { RollTheme } from './theme'

export interface RollScene {
  view: View
  rows: Rows
  totalTicks: Tick
  beatTicks: Tick
  barTicks: Tick
  snapTicks: Tick
  notes: readonly Note[]
  selected: ReadonlySet<string>
  color: string
  ghosts: ReadonlyArray<{ notes: readonly Note[]; color: string }>
  key: PitchClass
  scale: ScaleId
  playhead: Tick | null
  cursor: Tick
  loopRegion: { start: Tick; end: Tick } | null
  /** Rubber-band selection in canvas pixels. */
  box: { x1: number; y1: number; x2: number; y2: number } | null
  activeKey: number | null
  theme: RollTheme
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rr)
}

function visibleRows(s: RollScene): [number, number] {
  const { view, rows } = s
  const first = Math.max(0, yToRow(view, RULER_H))
  const last = Math.min(rows.pitches.length - 1, yToRow(view, view.height))
  return [first, last]
}

function drawGrid(ctx: CanvasRenderingContext2D, s: RollScene) {
  const { view, rows, theme } = s
  const [first, last] = visibleRows(s)
  const right = view.width
  const endX = Math.min(right, tickToX(view, s.totalTicks))

  // Row backgrounds: black-key rows darker, scale rows tinted.
  for (let r = first; r <= last; r++) {
    const pitch = rows.pitches[r]
    const y = rowToY(view, r)
    if (rows.drums) {
      ctx.fillStyle = r % 2 ? theme.rowBlack : theme.rowWhite
    } else {
      ctx.fillStyle = isBlackKey(pitch) ? theme.rowBlack : theme.rowWhite
    }
    ctx.fillRect(view.keysW, y, right - view.keysW, view.zoomY)
    if (!rows.drums && isInScale(pitch, s.key, s.scale)) {
      ctx.globalAlpha = pitchClass(pitch) === pitchClass(s.key) ? 0.14 : 0.06
      ctx.fillStyle = theme.accent
      ctx.fillRect(view.keysW, y, right - view.keysW, view.zoomY)
      ctx.globalAlpha = 1
    }
    // Row separators, stronger between octaves (B/C).
    const octaveLine = !rows.drums && pitchClass(pitch) === 0
    ctx.fillStyle = octaveLine ? theme.lineStrong : theme.line
    ctx.globalAlpha = octaveLine ? 1 : 0.5
    ctx.fillRect(view.keysW, y + view.zoomY - 1, right - view.keysW, 1)
    ctx.globalAlpha = 1
  }

  // Vertical lines: snap steps (if not too dense), beats, bars.
  const startTick = Math.max(0, xToTick(view, view.keysW))
  const endTick = Math.min(s.totalTicks, xToTick(view, right))
  const step = s.snapTicks > 1 && (s.snapTicks * view.zoomX) / PPQ >= 6 ? s.snapTicks : s.beatTicks
  for (let t = Math.floor(startTick / step) * step; t <= endTick; t += step) {
    const x = Math.round(tickToX(view, t)) + 0.5
    const isBar = t % s.barTicks === 0
    const isBeat = t % s.beatTicks === 0
    ctx.strokeStyle = isBar ? theme.lineStrong : theme.line
    ctx.globalAlpha = isBar ? 1 : isBeat ? 0.9 : 0.4
    ctx.lineWidth = isBar ? 1.5 : 1
    ctx.beginPath()
    ctx.moveTo(x, RULER_H)
    ctx.lineTo(x, view.height)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  ctx.lineWidth = 1

  // Outside the pattern.
  if (endX < right) {
    ctx.fillStyle = theme.bg
    ctx.globalAlpha = 0.7
    ctx.fillRect(endX, RULER_H, right - endX, view.height - RULER_H)
    ctx.globalAlpha = 1
  }

  // Loop region tint.
  if (s.loopRegion) {
    const x1 = tickToX(view, s.loopRegion.start)
    const x2 = tickToX(view, s.loopRegion.end)
    ctx.fillStyle = theme.accent
    ctx.globalAlpha = 0.05
    ctx.fillRect(x1, RULER_H, x2 - x1, view.height - RULER_H)
    ctx.globalAlpha = 1
  }
}

function drawNotes(ctx: CanvasRenderingContext2D, s: RollScene) {
  const { view, rows, theme } = s
  const left = view.keysW
  const h = view.zoomY

  const visible = (n: Note) => {
    const x2 = tickToX(view, n.start + n.duration)
    const x1 = tickToX(view, n.start)
    return x2 >= left && x1 <= view.width
  }

  // Ghost notes of other tracks.
  for (const ghost of s.ghosts) {
    ctx.fillStyle = ghost.color
    ctx.globalAlpha = 0.16
    for (const n of ghost.notes) {
      const row = rows.rowOf.get(n.pitch)
      if (row === undefined || !visible(n)) continue
      const x = tickToX(view, n.start)
      roundRect(ctx, x + 0.5, rowToY(view, row) + 1, Math.max(2, tickToX(view, n.start + n.duration) - x - 1), h - 2, 2)
      ctx.fill()
    }
  }
  ctx.globalAlpha = 1

  ctx.font = `600 ${Math.min(11, h - 3)}px system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  for (const n of s.notes) {
    const row = rows.rowOf.get(n.pitch)
    if (row === undefined || !visible(n)) continue
    const x = tickToX(view, n.start)
    const w = Math.max(3, tickToX(view, n.start + n.duration) - x - 1)
    const y = rowToY(view, row)
    const selected = s.selected.has(n.id)
    roundRect(ctx, x + 0.5, y + 1, w, h - 2, 3)
    ctx.fillStyle = s.color
    // Louder notes are more opaque.
    ctx.globalAlpha = selected ? 1 : 0.45 + 0.55 * (n.velocity / 127)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.lineWidth = selected ? 2 : 1
    ctx.strokeStyle = selected ? (theme.dark ? '#ffffff' : '#111318') : 'rgba(0,0,0,0.35)'
    ctx.stroke()
    if (!rows.drums && w > 30 && h >= 11) {
      ctx.fillStyle = 'rgba(0,0,0,0.65)'
      ctx.fillText(midiToName(n.pitch), x + 4, y + h / 2 + 0.5)
    }
  }
  ctx.lineWidth = 1

  if (s.box) {
    const { x1, y1, x2, y2 } = s.box
    ctx.fillStyle = theme.accent
    ctx.globalAlpha = 0.12
    ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    ctx.globalAlpha = 1
    ctx.strokeStyle = theme.accent
    ctx.strokeRect(Math.min(x1, x2) + 0.5, Math.min(y1, y2) + 0.5, Math.abs(x2 - x1), Math.abs(y2 - y1))
  }
}

function drawRuler(ctx: CanvasRenderingContext2D, s: RollScene) {
  const { view, theme } = s
  ctx.fillStyle = theme.surface
  ctx.fillRect(view.keysW, 0, view.width - view.keysW, RULER_H)

  if (s.loopRegion) {
    const x1 = Math.max(view.keysW, tickToX(view, s.loopRegion.start))
    const x2 = tickToX(view, s.loopRegion.end)
    ctx.fillStyle = theme.accent
    ctx.globalAlpha = 0.35
    ctx.fillRect(x1, 2, x2 - x1, RULER_H - 4)
    ctx.globalAlpha = 1
  }

  ctx.font = '600 11px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  const start = Math.max(0, xToTick(view, view.keysW))
  const end = Math.min(s.totalTicks, xToTick(view, view.width))
  const barPx = (s.barTicks * view.zoomX) / PPQ
  const labelEvery = barPx < 28 ? Math.ceil(28 / barPx) : 1
  for (let t = Math.floor(start / s.beatTicks) * s.beatTicks; t <= end; t += s.beatTicks) {
    const x = Math.round(tickToX(view, t)) + 0.5
    const isBar = t % s.barTicks === 0
    ctx.strokeStyle = isBar ? theme.textMuted : theme.lineStrong
    ctx.beginPath()
    ctx.moveTo(x, isBar ? 4 : RULER_H - 7)
    ctx.lineTo(x, RULER_H)
    ctx.stroke()
    const bar = t / s.barTicks
    if (isBar && bar % labelEvery === 0) {
      ctx.fillStyle = theme.textMuted
      ctx.fillText(String(bar + 1), x + 4, RULER_H / 2)
    }
  }
  ctx.fillStyle = theme.line
  ctx.fillRect(view.keysW, RULER_H - 1, view.width - view.keysW, 1)

  // Start cursor marker.
  const cx = tickToX(view, s.cursor)
  if (cx >= view.keysW) {
    ctx.fillStyle = theme.text
    ctx.beginPath()
    ctx.moveTo(cx - 5, RULER_H - 9)
    ctx.lineTo(cx + 5, RULER_H - 9)
    ctx.lineTo(cx, RULER_H - 2)
    ctx.closePath()
    ctx.fill()
  }
}

function drawKeys(ctx: CanvasRenderingContext2D, s: RollScene) {
  const { view, rows, theme } = s
  const [first, last] = visibleRows(s)
  ctx.fillStyle = theme.surface
  ctx.fillRect(0, RULER_H, view.keysW, view.height - RULER_H)
  ctx.font = `${Math.min(11, view.zoomY - 2)}px system-ui, sans-serif`
  ctx.textBaseline = 'middle'

  for (let r = first; r <= last; r++) {
    const pitch = rows.pitches[r]
    const y = rowToY(view, r)
    const active = s.activeKey === pitch
    if (rows.drums) {
      ctx.fillStyle = active ? theme.accent : r % 2 ? theme.rowBlack : theme.surface
      ctx.fillRect(0, y, view.keysW, view.zoomY)
      ctx.fillStyle = active ? '#fff' : theme.textMuted
      if (view.zoomY >= 9) ctx.fillText(GM_DRUM_NAMES[pitch] ?? String(pitch), 6, y + view.zoomY / 2)
    } else {
      const black = isBlackKey(pitch)
      ctx.fillStyle = active ? theme.accent : black ? theme.keyBlack : theme.keyWhite
      ctx.fillRect(0, y, black ? view.keysW * 0.62 : view.keysW, view.zoomY)
      if (black && !active) {
        ctx.fillStyle = theme.keyWhite
        ctx.fillRect(view.keysW * 0.62, y, view.keysW * 0.38, view.zoomY)
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, y + view.zoomY - 1, view.keysW, 1)
      if (pitchClass(pitch) === 0 && view.zoomY >= 8) {
        ctx.fillStyle = active ? '#fff' : '#3a3f4b'
        ctx.fillText(midiToName(pitch), view.keysW - 28, y + view.zoomY / 2)
      }
    }
  }
  ctx.fillStyle = theme.lineStrong
  ctx.fillRect(view.keysW - 1, RULER_H, 1, view.height - RULER_H)
  // Corner above the keys.
  ctx.fillStyle = theme.surface
  ctx.fillRect(0, 0, view.keysW, RULER_H)
  ctx.fillStyle = theme.line
  ctx.fillRect(0, RULER_H - 1, view.keysW, 1)
}

function drawPlayhead(ctx: CanvasRenderingContext2D, s: RollScene) {
  const { view, theme } = s
  if (s.playhead === null) return
  const x = Math.round(tickToX(view, s.playhead)) + 0.5
  if (x < view.keysW || x > view.width) return
  ctx.strokeStyle = theme.accent
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, 0)
  ctx.lineTo(x, view.height)
  ctx.stroke()
  ctx.lineWidth = 1
}

export function drawRoll(ctx: CanvasRenderingContext2D, s: RollScene, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = s.theme.bg
  ctx.fillRect(0, 0, s.view.width, s.view.height)
  drawGrid(ctx, s)
  drawNotes(ctx, s)
  drawRuler(ctx, s)
  drawKeys(ctx, s)
  drawPlayhead(ctx, s)
}

/* ---------- velocity lane ---------- */

export const VELOCITY_H = 76

export function drawVelocityLane(
  ctx: CanvasRenderingContext2D,
  s: Pick<RollScene, 'view' | 'notes' | 'selected' | 'color' | 'theme' | 'totalTicks'>,
  width: number,
  dpr: number,
  label: string,
) {
  const { view, theme } = s
  const h = VELOCITY_H
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = theme.rowWhite
  ctx.fillRect(0, 0, width, h)
  ctx.strokeStyle = theme.line
  for (const f of [0.25, 0.5, 0.75]) {
    const y = Math.round(4 + (h - 8) * (1 - f)) + 0.5
    ctx.beginPath()
    ctx.moveTo(view.keysW, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  const lv = { ...view, width }
  for (const n of s.notes) {
    const x = tickToX(lv, n.start)
    if (x < view.keysW - 2 || x > width) continue
    const barH = (h - 8) * (n.velocity / 127)
    const selected = s.selected.has(n.id)
    ctx.fillStyle = s.color
    ctx.globalAlpha = selected || s.selected.size === 0 ? 1 : 0.4
    ctx.fillRect(Math.round(x), h - 4 - barH, 3, barH)
    ctx.beginPath()
    ctx.arc(Math.round(x) + 1.5, h - 4 - barH, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  ctx.fillStyle = theme.surface
  ctx.fillRect(0, 0, view.keysW, h)
  ctx.fillStyle = theme.lineStrong
  ctx.fillRect(view.keysW - 1, 0, 1, h)
  ctx.fillRect(0, 0, width, 1)
  ctx.fillStyle = theme.textMuted
  ctx.font = '600 10px system-ui, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 8, h / 2)
}

/** Velocity (1–127) for a y position in the lane. */
export function laneVelocity(y: number): number {
  return Math.max(1, Math.min(127, Math.round(((VELOCITY_H - 4 - y) / (VELOCITY_H - 8)) * 127)))
}
