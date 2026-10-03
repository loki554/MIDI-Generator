import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createDefaultSettings } from '../core/defaults'
import { genreDefaults } from '../core/presets/genres'
import { suggestBpm } from '../core/presets/style'
import { randomSeed } from '../core/random'
import { PART_TYPES, type GenSettings, type Genre, type GlobalSettings, type PartSettingsMap, type PartType } from '../core/types'

interface SettingsState {
  settings: GenSettings
  patchGlobal: (patch: Partial<GlobalSettings>) => void
  patchPart: <P extends PartType>(part: P, patch: Partial<PartSettingsMap[P]>) => void
  /** Switches genre and applies its defaults: tempo, swing and the parts it uses. */
  setGenre: (genre: Genre) => void
  rollSeed: () => number
  reset: () => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Persisted values over current defaults, so settings added later get their defaults. */
function deepMerge<T>(base: T, saved: unknown): T {
  if (!isObject(base) || !isObject(saved)) return (saved === undefined ? base : (saved as T))
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(saved)) {
    if (k in out) out[k] = isObject(out[k]) ? deepMerge(out[k], v) : v
  }
  return out as T
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: createDefaultSettings(randomSeed()),
      patchGlobal: (patch) => set((s) => ({ settings: { ...s.settings, global: { ...s.settings.global, ...patch } } })),
      patchPart: (part, patch) =>
        set((s) => ({
          settings: {
            ...s.settings,
            parts: { ...s.settings.parts, [part]: { ...s.settings.parts[part], ...patch } },
          },
        })),
      setGenre: (genre) => {
        const { settings } = get()
        const defaults = genreDefaults(genre)
        const parts = { ...settings.parts }
        for (const p of PART_TYPES) parts[p] = { ...parts[p], enabled: defaults.parts.includes(p) } as never
        set({
          settings: {
            global: { ...settings.global, genre, bpm: suggestBpm(genre, settings.global.mood), swing: defaults.swing },
            parts,
          },
        })
      },
      rollSeed: () => {
        const seed = randomSeed()
        get().patchGlobal({ seed })
        return seed
      },
      reset: () => set({ settings: createDefaultSettings(randomSeed()) }),
    }),
    {
      name: 'midigen-settings',
      version: 1,
      partialize: ({ settings }) => ({ settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: deepMerge(current.settings, (persisted as Partial<SettingsState> | undefined)?.settings),
      }),
    },
  ),
)
