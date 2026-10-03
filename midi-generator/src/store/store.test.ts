import { beforeEach, describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../core/defaults'
import { generateProject } from '../core/generators'
import { generate, setPartProgram } from './actions'
import { createHistoryTransaction, redo, undo, useProjectStore } from './projectStore'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

const temporal = () => useProjectStore.temporal.getState()

beforeEach(() => {
  useProjectStore.setState({ project: null })
  temporal().clear()
  useSettingsStore.setState({ settings: createDefaultSettings(7) })
})

describe('projectStore history', () => {
  it('undoes and redoes note edits', () => {
    const p = generateProject(createDefaultSettings(1), { createdAt: 0 })
    useProjectStore.getState().setProject(p)
    const track = p.tracks[0]
    useProjectStore.getState().setNotes(track.id, [])
    expect(useProjectStore.getState().project!.tracks[0].notes).toEqual([])
    undo()
    expect(useProjectStore.getState().project!.tracks[0].notes).toBe(track.notes)
    redo()
    expect(useProjectStore.getState().project!.tracks[0].notes).toEqual([])
  })

  it('keeps mixer changes and tempo out of the history', () => {
    const p = generateProject(createDefaultSettings(1), { createdAt: 0 })
    useProjectStore.getState().setProject(p)
    const before = temporal().pastStates.length
    useProjectStore.getState().updateMix(p.tracks[0].id, { muted: true, volume: 0.2 })
    useProjectStore.getState().setBpm(99)
    expect(temporal().pastStates.length).toBe(before)
    expect(useProjectStore.getState().project!.tracks[0].muted).toBe(true)
    expect(useProjectStore.getState().project!.bpm).toBe(99)
  })

  it('groups a drag into one undo step', () => {
    const p = generateProject(createDefaultSettings(1), { createdAt: 0 })
    useProjectStore.getState().setProject(p)
    const before = temporal().pastStates.length
    const tx = createHistoryTransaction()
    tx.begin()
    for (let i = 0; i < 5; i++) useProjectStore.getState().setNotes(p.tracks[0].id, p.tracks[0].notes.slice(i))
    tx.end()
    expect(temporal().pastStates.length).toBe(before + 1)
    undo()
    expect(useProjectStore.getState().project).toBe(p)
  })
})

describe('actions', () => {
  it('generates with a new seed unless the seed is locked', () => {
    const seed = useSettingsStore.getState().settings.global.seed
    generate()
    const rolled = useSettingsStore.getState().settings.global.seed
    expect(rolled).not.toBe(seed)
    expect(useProjectStore.getState().project!.settings.global.seed).toBe(rolled)
    expect(useUiStore.getState().selectedTrackId).toBe(useProjectStore.getState().project!.tracks[0].id)

    useSettingsStore.getState().patchGlobal({ seedLocked: true })
    const first = useProjectStore.getState().project!
    generate()
    expect(useSettingsStore.getState().settings.global.seed).toBe(rolled)
    expect(useProjectStore.getState().project!.tracks).toEqual(first.tracks.map((t) => ({ ...t })))
  })

  it('applies genre defaults when switching genre', () => {
    useSettingsStore.getState().setGenre('metal')
    const { global, parts } = useSettingsStore.getState().settings
    expect(global.genre).toBe('metal')
    expect(global.bpm).toBeGreaterThanOrEqual(100)
    expect(parts.riff.enabled).toBe(true)
    expect(parts.chords.enabled).toBe(false)
  })

  it('syncs instrument changes to the existing track', () => {
    generate()
    setPartProgram('chords', 5)
    expect(useSettingsStore.getState().settings.parts.chords.program).toBe(5)
    expect(useProjectStore.getState().project!.tracks.find((t) => t.partType === 'chords')!.program).toBe(5)
  })
})
