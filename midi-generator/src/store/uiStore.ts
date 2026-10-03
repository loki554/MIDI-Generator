import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PPQ } from '../core/types'

export type EditTool = 'draw' | 'select' | 'delete'
export type SnapValue = '1/4' | '1/8' | '1/16' | '1/32' | '1/8t' | '1/16t' | 'off'

export const SNAP_TICKS: Record<SnapValue, number> = {
  '1/4': PPQ,
  '1/8': PPQ / 2,
  '1/16': PPQ / 4,
  '1/32': PPQ / 8,
  '1/8t': PPQ / 3,
  '1/16t': PPQ / 6,
  off: 1,
}

interface UiState {
  selectedTrackId: string | null
  /** Selected note ids in the piano roll (of the selected track). */
  selectedNoteIds: ReadonlySet<string>
  tool: EditTool
  snap: SnapValue
  /** Horizontal zoom: pixels per beat (quarter note). */
  zoomX: number
  /** Vertical zoom: pixels per piano-roll row. */
  zoomY: number
  /** Length (ticks) and velocity of the next drawn note: the last one touched. */
  lastNoteLength: number
  lastVelocity: number
  showVelocity: boolean
  /** Incremented to ask the piano roll to fit the pattern into view. */
  fitRequest: number
  selectTrack: (id: string | null) => void
  setSelection: (ids: Iterable<string>) => void
  setTool: (tool: EditTool) => void
  setSnap: (snap: SnapValue) => void
  setZoom: (zoom: { x?: number; y?: number }) => void
  setLastNote: (length: number, velocity?: number) => void
  toggleVelocity: () => void
  requestFit: () => void
}

// Low minimum so "fit to view" can show 32 bars on a laptop screen.
export const ZOOM_X = { min: 6, max: 400 }
export const ZOOM_Y = { min: 6, max: 32 }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      selectedTrackId: null,
      selectedNoteIds: new Set(),
      tool: 'draw',
      snap: '1/16',
      zoomX: 80,
      zoomY: 14,
      lastNoteLength: PPQ / 4,
      lastVelocity: 100,
      showVelocity: true,
      fitRequest: 0,
      selectTrack: (id) => set({ selectedTrackId: id, selectedNoteIds: new Set() }),
      setSelection: (ids) => set({ selectedNoteIds: new Set(ids) }),
      setTool: (tool) => set({ tool }),
      setSnap: (snap) => set({ snap }),
      setZoom: ({ x, y }) =>
        set((s) => ({
          zoomX: x === undefined ? s.zoomX : clamp(x, ZOOM_X.min, ZOOM_X.max),
          zoomY: y === undefined ? s.zoomY : clamp(y, ZOOM_Y.min, ZOOM_Y.max),
        })),
      setLastNote: (length, velocity) => set((s) => ({ lastNoteLength: length, lastVelocity: velocity ?? s.lastVelocity })),
      toggleVelocity: () => set((s) => ({ showVelocity: !s.showVelocity })),
      requestFit: () => set((s) => ({ fitRequest: s.fitRequest + 1 })),
    }),
    {
      name: 'midigen-ui',
      version: 1,
      // Editor preferences only; selection is per session.
      partialize: ({ tool, snap, zoomX, zoomY, showVelocity }) => ({ tool, snap, zoomX, zoomY, showVelocity }),
    },
  ),
)
