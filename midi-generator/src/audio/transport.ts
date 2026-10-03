/** The app's engine instance, bound to the stores, plus transport actions. */
import { usePlaybackStore } from '../store/playbackStore'
import { useProjectStore } from '../store/projectStore'
import { useUiStore } from '../store/uiStore'
import { AudioEngine } from './engine'

export const engine = new AudioEngine(
  () => {
    const { loop, loopRegion, metronome } = usePlaybackStore.getState()
    return { project: useProjectStore.getState().project, loop, loopRegion, metronome }
  },
  () => usePlaybackStore.getState().setPlaying(false),
)

export async function play(): Promise<void> {
  if (!useProjectStore.getState().project) return
  usePlaybackStore.getState().setPlaying(true)
  await engine.play(usePlaybackStore.getState().cursor)
}

/** Stops and returns to the cursor, like FL Studio. */
export function stop(): void {
  engine.stop()
  usePlaybackStore.getState().setPlaying(false)
}

export function togglePlay(): void {
  if (engine.isPlaying) stop()
  else void play()
}

/** Moves the start cursor; while playing, jumps playback there. */
export function seek(tick: number): void {
  usePlaybackStore.getState().setCursor(tick)
  if (engine.isPlaying) void engine.play(tick)
}

// Dev-only handles for debugging and browser-driven checks.
if (import.meta.env.DEV) {
  Object.assign(window, { __engine: engine, __stores: { project: useProjectStore, playback: usePlaybackStore, ui: useUiStore } })
}
