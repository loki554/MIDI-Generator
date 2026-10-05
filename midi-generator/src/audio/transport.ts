/** The app's engine instance, bound to the stores, plus transport actions. */
import { usePlaybackStore } from '../store/playbackStore'
import { usePrefsStore } from '../store/prefsStore'
import { useProjectStore } from '../store/projectStore'
import { useSamplesStore } from '../store/samplesStore'
import { useUiStore } from '../store/uiStore'
import { AudioEngine } from './engine'
import { isPack } from './samples/packs'

export const engine = new AudioEngine(
  () => {
    const { loop, loopRegion, metronome } = usePlaybackStore.getState()
    const { soundSource } = usePrefsStore.getState()
    return { project: useProjectStore.getState().project, loop, loopRegion, metronome, soundSource }
  },
  () => usePlaybackStore.getState().setPlaying(false),
  () => void prepareSamples(),
)
engine.setMasterVolume(usePrefsStore.getState().masterVolume)

/** Creates/resumes audio (call from a user gesture) — also starts sample loading. */
export async function ensureAudio(): Promise<void> {
  await engine.ensure()
}

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

/* ---------- sample packs ---------- */

let prepareRun = 0

/**
 * Loads the selected pack's instruments for the current project. Until they
 * are ready (or if loading fails) the engine plays the synth for that track.
 */
export async function prepareSamples(): Promise<void> {
  const run = ++prepareRun
  const samples = useSamplesStore.getState()
  const source = usePrefsStore.getState().soundSource
  const project = useProjectStore.getState().project
  if (!isPack(source)) {
    engine.clearSamples()
    samples.set({ status: 'idle', loaded: 0, total: 0 })
    return
  }
  if (!project || !engine.context) return

  const result = await engine.prepareSamples(source, project, (p) => {
    if (run !== prepareRun) return
    const done = p.loaded + p.failed >= p.total
    samples.set({ status: done ? (p.failed ? 'error' : 'ready') : 'loading', loaded: p.loaded, total: p.total })
  })
  if (run !== prepareRun || !result) return
  samples.set({ status: result.failed ? 'error' : 'ready', loaded: result.loaded, total: result.total })
}

/** Instruments only change with the sound source, the project or a track's program. */
const instrumentSignature = () => {
  const p = useProjectStore.getState().project
  return p ? `${p.id}|${p.tracks.map((t) => `${t.id}:${t.program}`).join(',')}` : ''
}
let lastSignature = instrumentSignature()

usePrefsStore.subscribe((s, prev) => {
  if (s.soundSource !== prev.soundSource) void prepareSamples()
  if (s.masterVolume !== prev.masterVolume) engine.setMasterVolume(s.masterVolume)
})
useProjectStore.subscribe(() => {
  const sig = instrumentSignature()
  if (sig === lastSignature) return
  lastSignature = sig
  void prepareSamples()
})

// Dev-only handles for debugging and browser-driven checks.
if (import.meta.env.DEV) {
  Object.assign(window, {
    __engine: engine,
    __stores: { project: useProjectStore, playback: usePlaybackStore, ui: useUiStore, samples: useSamplesStore, prefs: usePrefsStore },
  })
}
