/** Actions that span several stores. */
import { generateProject } from '../core/generators'
import { defaultProgram } from '../core/presets/gm'
import type { Auto, PartType } from '../core/types'
import { useProjectStore } from './projectStore'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

/** Generates a new project from the current settings (rolling a new seed unless locked). */
export function generate(): void {
  const settingsStore = useSettingsStore.getState()
  if (!settingsStore.settings.global.seedLocked) settingsStore.rollSeed()
  const { settings } = useSettingsStore.getState()

  const project = generateProject(settings)
  useProjectStore.getState().setProject(project)

  const ui = useUiStore.getState()
  const keep = project.tracks.some((t) => t.id === ui.selectedTrackId)
  if (!keep) ui.selectTrack(project.tracks[0]?.id ?? null)
  else ui.setSelection([])
}

/** Changes a part's instrument in the settings and on its existing track. */
export function setPartProgram(part: PartType, program: Auto<number>): void {
  useSettingsStore.getState().patchPart(part, { program })
  const { project, updateMix } = useProjectStore.getState()
  const track = project?.tracks.find((t) => t.partType === part)
  if (!track) return
  const genre = useSettingsStore.getState().settings.global.genre
  updateMix(track.id, { program: program === 'auto' ? defaultProgram(part, genre) : program })
}

/** Keeps the playback tempo of the current project and the next generation in sync. */
export function setTempo(bpm: number): void {
  useSettingsStore.getState().patchGlobal({ bpm })
  useProjectStore.getState().setBpm(bpm)
}
