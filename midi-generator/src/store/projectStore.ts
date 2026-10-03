import { temporal } from 'zundo'
import { create } from 'zustand'
import { regeneratePart } from '../core/generators'
import { randomSeed } from '../core/random'
import type { Note, PartType, Project, Track } from '../core/types'

export type MixPatch = Partial<Pick<Track, 'muted' | 'solo' | 'volume' | 'program'>>

interface ProjectState {
  project: Project | null
  setProject: (project: Project | null) => void
  /** Mixer changes (mute, solo, volume, program) — not recorded in undo history. */
  updateMix: (trackId: string, patch: MixPatch) => void
  setBpm: (bpm: number) => void
  /** Replaces a track's notes (recorded in undo history unless paused). */
  setNotes: (trackId: string, notes: Note[]) => void
  regenerate: (part: PartType) => void
}

function mapTrack(project: Project, trackId: string, fn: (t: Track) => Track): Project {
  return { ...project, tracks: project.tracks.map((t) => (t.id === trackId ? fn(t) : t)) }
}

export const useProjectStore = create<ProjectState>()(
  temporal(
    (set, get) => ({
      project: null,
      setProject: (project) => set({ project }),
      updateMix: (trackId, patch) =>
        withoutHistory(() => {
          const { project } = get()
          if (project) set({ project: mapTrack(project, trackId, (t) => ({ ...t, ...patch })) })
        }),
      setBpm: (bpm) =>
        withoutHistory(() => {
          const { project } = get()
          if (project && project.bpm !== bpm) set({ project: { ...project, bpm } })
        }),
      setNotes: (trackId, notes) => {
        const { project } = get()
        if (project) set({ project: mapTrack(project, trackId, (t) => ({ ...t, notes })) })
      },
      regenerate: (part) => {
        const { project } = get()
        if (project) set({ project: regeneratePart(project, part, randomSeed()) })
      },
    }),
    {
      partialize: (s) => ({ project: s.project }),
      equality: (a, b) => a.project === b.project,
      limit: 100,
    },
  ),
)

/** Runs `fn` without recording undo history (for mixer tweaks and other non-edits). */
export function withoutHistory(fn: () => void): void {
  const temporalState = useProjectStore.temporal.getState()
  const wasTracking = temporalState.isTracking
  temporalState.pause()
  try {
    fn()
  } finally {
    if (wasTracking) temporalState.resume()
  }
}

/**
 * Groups many live updates (e.g. while dragging notes) into one undo step:
 * call `begin()` on pointer down and `end()` on pointer up.
 */
export function createHistoryTransaction() {
  let before: Project | null = null
  let active = false
  return {
    begin() {
      if (active) return
      before = useProjectStore.getState().project
      active = true
      useProjectStore.temporal.getState().pause()
    },
    end() {
      if (!active) return
      active = false
      const after = useProjectStore.getState().project
      // Restore the pre-drag state silently, then apply the result as one tracked change.
      useProjectStore.setState({ project: before })
      useProjectStore.temporal.getState().resume()
      if (after !== before) useProjectStore.setState({ project: after })
      before = null
    },
    get active() {
      return active
    },
  }
}

export const undo = () => useProjectStore.temporal.getState().undo()
export const redo = () => useProjectStore.temporal.getState().redo()
