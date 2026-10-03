import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../defaults'
import { createRng } from '../random'
import { getProgressionPreset } from '../theory/progressions'
import { GENRES, MOODS, PART_TYPES, SCALE_IDS, type GenSettings } from '../types'
import { DRUM_FILLS, DRUM_PATTERNS, metricAccent, parseStep } from './drumPatterns'
import {
  DRUM_NOTES,
  GM_DRUM_NAMES,
  GM_FAMILIES,
  GM_PROGRAMS,
  GM_PROGRAM_NAMES,
  defaultProgram,
  gmProgramsByFamily,
} from './gm'
import { GENRES_DEF, genreDefaults } from './genres'
import { MOODS_DEF } from './moods'
import { combineWeights, resolveStyle, suggestBpm } from './style'

const settingsFor = (patch: Partial<GenSettings['global']> = {}): GenSettings => {
  const s = createDefaultSettings(1234)
  s.global = { ...s.global, ...patch }
  return s
}

describe('GM reference', () => {
  it('has 128 programs in 16 families of 8', () => {
    expect(GM_PROGRAM_NAMES).toHaveLength(128)
    expect(GM_FAMILIES).toHaveLength(16)
    for (const { programs } of gmProgramsByFamily()) expect(programs).toHaveLength(8)
    expect(GM_PROGRAMS[30]).toEqual({ program: 30, name: 'Distortion Guitar', family: 'guitar' })
    expect(GM_PROGRAMS[33].family).toBe('bass')
  })

  it('names every drum voice', () => {
    for (const note of Object.values(DRUM_NOTES)) expect(GM_DRUM_NAMES[note]).toBeTruthy()
  })

  it('gives every part a valid default program in every genre', () => {
    for (const genre of GENRES) {
      for (const part of PART_TYPES) {
        const p = defaultProgram(part, genre)
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThan(128)
      }
    }
    expect(defaultProgram('riff', 'metal')).toBe(30)
    expect(defaultProgram('bass', 'jazz')).toBe(32)
  })
})

describe('drum patterns', () => {
  it.each(Object.entries(DRUM_PATTERNS))('%s has lanes of the right length and valid symbols', (_, pattern) => {
    for (const [voice, lane] of Object.entries(pattern.lanes)) {
      expect(voice in DRUM_NOTES).toBe(true)
      expect(lane).toHaveLength(pattern.steps)
      expect(lane).toMatch(/^[Xxg1-9.]+$/)
    }
  })

  it('decodes step symbols', () => {
    expect(parseStep('X')).toMatchObject({ probability: 1, kind: 'fixed' })
    expect(parseStep('g')).toMatchObject({ kind: 'ghost' })
    expect(parseStep('3')).toMatchObject({ probability: 0.3, kind: 'optional' })
    expect(parseStep('.')).toBeNull()
  })

  it('accents the downbeat most', () => {
    expect(metricAccent(0, 4, 16)).toBeGreaterThan(metricAccent(4, 4, 16))
    expect(metricAccent(4, 4, 16)).toBeGreaterThan(metricAccent(2, 4, 16))
    expect(metricAccent(2, 4, 16)).toBeGreaterThan(metricAccent(1, 4, 16))
  })

  it.each(Object.entries(DRUM_FILLS))('fill %s stays inside its window', (_, fill) => {
    for (const [voice, step, vel] of fill.hits) {
      expect(voice in DRUM_NOTES).toBe(true)
      expect(step).toBeGreaterThanOrEqual(0)
      expect(step).toBeLessThan(fill.length)
      expect(vel).toBeGreaterThan(0)
      expect(vel).toBeLessThanOrEqual(1)
    }
  })

  it('has the metal-specific grooves', () => {
    expect(DRUM_PATTERNS.blast.lanes.snare).toBe('.x.x.x.x.x.x.x.x')
    expect(DRUM_PATTERNS.skank.lanes.kick.startsWith('X...x')).toBe(true)
    expect(DRUM_PATTERNS.gallop.lanes.kick).toBe('X.xxx.xxx.xxx.xx')
    expect(DRUM_PATTERNS.doom.lanes.snare.indexOf('X')).toBe(8)
  })
})

describe('genres', () => {
  it.each(GENRES)('%s references valid presets', (genre) => {
    const def = GENRES_DEF[genre]
    expect(def.bpm[0]).toBeLessThan(def.bpm[1])
    expect(def.defaultBpm).toBeGreaterThanOrEqual(def.bpm[0])
    expect(def.defaultBpm).toBeLessThanOrEqual(def.bpm[1])
    for (const id of Object.keys(def.progressions)) expect(getProgressionPreset(id), id).toBeDefined()
    for (const id of Object.keys(def.drums)) expect(DRUM_PATTERNS[id as keyof typeof DRUM_PATTERNS].steps).toBe(16)
    expect(DRUM_PATTERNS[def.compoundDrums].steps).toBe(12)
    for (const id of Object.keys(def.fills)) expect(id in DRUM_FILLS).toBe(true)
    for (const s of Object.keys(def.scales)) expect(SCALE_IDS).toContain(s)
    for (const p of def.parts) expect(PART_TYPES).toContain(p)
  })

  it('exposes UI defaults', () => {
    expect(genreDefaults('dnb').bpm).toBe(174)
    expect(genreDefaults('jazz').swing).toBeGreaterThan(0.5)
    expect(genreDefaults('metal').parts).toContain('riff')
  })
})

describe('moods', () => {
  it.each(MOODS)('%s is well formed', (mood) => {
    const def = MOODS_DEF[mood]
    expect(def.degreeBias.major).toHaveLength(7)
    expect(def.degreeBias.minor).toHaveLength(7)
    expect(def.velocity[0]).toBeGreaterThanOrEqual(1)
    expect(def.velocity[1]).toBeLessThanOrEqual(127)
    expect(def.velocity[0]).toBeLessThan(def.velocity[1])
    expect(def.tempo).toBeGreaterThanOrEqual(0)
    expect(def.tempo).toBeLessThanOrEqual(1)
    for (const id of Object.keys(def.presetBias)) expect(getProgressionPreset(id), id).toBeDefined()
  })

  it('suggests a tempo inside the genre range', () => {
    for (const genre of GENRES) {
      for (const mood of MOODS) {
        const bpm = suggestBpm(genre, mood)
        expect(bpm).toBeGreaterThanOrEqual(GENRES_DEF[genre].bpm[0])
        expect(bpm).toBeLessThanOrEqual(GENRES_DEF[genre].bpm[1])
      }
    }
    expect(suggestBpm('house', 'chill')).toBeLessThan(suggestBpm('house', 'aggressive'))
  })
})

describe('style resolution', () => {
  it('multiplies weights with floors', () => {
    expect(combineWeights({ a: 2, b: 1 }, { b: 3, c: 1 }, 0.1, 0.5)).toEqual({ a: 1, b: 3, c: 0.1 })
  })

  it('is deterministic', () => {
    const s = settingsFor({ genre: 'metal', mood: 'dark' })
    expect(resolveStyle(s, createRng(5))).toEqual(resolveStyle(s, createRng(5)))
  })

  it('resolves every genre × mood combination to valid choices', () => {
    for (const genre of GENRES) {
      for (const mood of MOODS) {
        for (const seed of [1, 2, 3]) {
          const style = resolveStyle(settingsFor({ genre, mood }), createRng(seed))
          expect(SCALE_IDS).toContain(style.scale)
          expect([0.5, 1, 2]).toContain(style.chordsPerBar)
          expect(style.drumPattern in DRUM_PATTERNS).toBe(true)
          if (style.progression.kind === 'preset') expect(getProgressionPreset(style.progression.id)).toBeDefined()
          expect(style.density).toBeGreaterThan(0.2)
          expect(style.density).toBeLessThan(2)
        }
      }
    }
  })

  it('lets explicit settings win over auto', () => {
    const s = settingsFor({ genre: 'pop', mood: 'happy', scale: 'locrian', progression: 'doom', chordsPerBar: 2 })
    s.parts.chords.extension = 'ninth'
    s.parts.chords.rhythm = 'strum'
    s.parts.bass.style = 'walking'
    s.parts.riff.style = 'tremolo'
    s.parts.melody.structure = 'ABAB'
    const style = resolveStyle(s, createRng(1))
    expect(style).toMatchObject({
      scale: 'locrian',
      progression: { kind: 'preset', id: 'doom' },
      chordsPerBar: 2,
      extension: 'ninth',
      chordRhythm: 'strum',
      bassStyle: 'walking',
      riffStyle: 'tremolo',
      structure: 'ABAB',
    })
    expect(resolveStyle(settingsFor({ progression: 'markov' }), createRng(1)).progression.kind).toBe('markov')
  })

  it('lets the genre own rhythm and the mood own harmony', () => {
    const scales = new Set<string>()
    for (let seed = 0; seed < 40; seed++) {
      const style = resolveStyle(settingsFor({ genre: 'house', mood: 'dreamy' }), createRng(seed))
      expect(style.drumPattern).toBe('house')
      scales.add(style.scale)
    }
    // Dreamy pulls house towards lydian/major even though house prefers minor.
    expect([...scales].some((s) => s === 'lydian' || s === 'major')).toBe(true)
  })

  it('picks meter-specific drum patterns and limits chord changes in 3/4', () => {
    const waltz = resolveStyle(settingsFor({ genre: 'jazz', timeSignature: { numerator: 3, denominator: 4 }, chordsPerBar: 2 }), createRng(1))
    expect(waltz.drumPattern).toBe('jazzWaltz')
    expect(waltz.chordsPerBar).toBe(1)
    const sixEight = resolveStyle(settingsFor({ genre: 'metal', timeSignature: { numerator: 6, denominator: 8 } }), createRng(1))
    expect(sixEight.drumPattern).toBe('sixEightMetal')
  })

  it('prefers richer chords at high complexity', () => {
    const count = (complexity: number) => {
      let rich = 0
      for (let seed = 0; seed < 200; seed++) {
        // Rock offers plain chords, the romantic mood adds sevenths and ninths.
        const ext = resolveStyle(settingsFor({ genre: 'rock', mood: 'romantic', complexity }), createRng(seed)).extension
        if (ext === 'seventh' || ext === 'ninth' || ext === 'eleventh' || ext === 'thirteenth') rich++
      }
      return rich
    }
    expect(count(1)).toBeGreaterThan(count(0))
  })
})
