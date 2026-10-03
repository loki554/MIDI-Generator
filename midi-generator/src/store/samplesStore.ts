import { create } from 'zustand'

export type SampleStatus = 'idle' | 'loading' | 'ready' | 'error'

interface SamplesState {
  status: SampleStatus
  /** Instruments loaded / requested for the current project. */
  loaded: number
  total: number
  set: (patch: Partial<Pick<SamplesState, 'status' | 'loaded' | 'total'>>) => void
}

/** Loading state of the selected sample pack, shown next to the sound selector. */
export const useSamplesStore = create<SamplesState>()((set) => ({
  status: 'idle',
  loaded: 0,
  total: 0,
  set: (patch) => set(patch),
}))
