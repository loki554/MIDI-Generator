import { create } from 'zustand'
import type { Tick } from '../core/types'

export interface LoopRegion {
  start: Tick
  end: Tick
}

interface PlaybackState {
  playing: boolean
  loop: boolean
  /** Loop range; null = the whole pattern. */
  loopRegion: LoopRegion | null
  metronome: boolean
  /** Where playback starts and returns to on stop (set by clicking the ruler). */
  cursor: Tick
  setPlaying: (playing: boolean) => void
  setLoop: (loop: boolean) => void
  setLoopRegion: (region: LoopRegion | null) => void
  setMetronome: (on: boolean) => void
  setCursor: (tick: Tick) => void
}

export const usePlaybackStore = create<PlaybackState>()((set) => ({
  playing: false,
  loop: true,
  loopRegion: null,
  metronome: false,
  cursor: 0,
  setPlaying: (playing) => set({ playing }),
  setLoop: (loop) => set({ loop }),
  setLoopRegion: (loopRegion) => set({ loopRegion }),
  setMetronome: (metronome) => set({ metronome }),
  setCursor: (cursor) => set({ cursor: Math.max(0, cursor) }),
}))
