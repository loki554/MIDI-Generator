/** The app's engine instance, bound to the stores, plus transport actions. */
import { usePlaybackStore } from '../store/playbackStore'
import { useProjectStore } from '../store/projectStore'
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

if (import.meta.env.DEV) {
  ;(window as unknown as { __engine: AudioEngine }).__engine = engine
}
