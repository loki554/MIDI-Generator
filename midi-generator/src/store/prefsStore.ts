import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'dark' | 'light'

export const SOUND_SOURCES = ['synth', 'gmClassic', 'gmRich', 'electronic'] as const
export type SoundSource = (typeof SOUND_SOURCES)[number]

/** Must match the key read by the inline theme script in index.html. */
export const PREFS_STORAGE_KEY = 'midigen-prefs'

interface PrefsState {
  theme: Theme
  soundSource: SoundSource
  toggleTheme: () => void
  setSoundSource: (source: SoundSource) => void
}

export const usePrefsStore = create<PrefsState>()(
  persist(
    (set) => ({
      theme: 'dark',
      soundSource: 'synth',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setSoundSource: (soundSource) => set({ soundSource }),
    }),
    {
      name: PREFS_STORAGE_KEY,
      version: 1,
      partialize: ({ theme, soundSource }) => ({ theme, soundSource }),
    },
  ),
)
