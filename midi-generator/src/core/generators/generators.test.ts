import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../defaults'
import { DRUM_CHANNEL, DRUM_NOTES, isGmDrumNote } from '../presets/gm'
import { resolveStyle } from '../presets/style'
import { createRng } from '../random'
import { chordPitchClasses, extendChord } from '../theory/chords'
import { pitchClass } from '../theory/notes'
import { SCALES, isInScale } from '../theory/scales'
import { ticksPerBar } from '../time'
import {
  GENRES,
  MOODS,
  PART_TYPES,
  PPQ,
  type GenSettings,
  type HarmonyEvent,
  type Project,
  type TimeSignature,
  type Track,
} from '../types'
import { arpSequence, arpTones } from './arp'
import { applySwing, finalizeNotes, humanize, swingTick } from './humanize'
import { generateProject, partSeed, partsToGenerate, regeneratePart } from './index'

const settingsFor = (patch: Partial<GenSettings['global']> = {}, allParts = true): GenSettings => {
  const s = createDefaultSettings(4242)
  s.global = { ...s.global, ...patch }
  if (allParts) for (const p of PART_TYPES) s.parts[p].enabled = true
  return s
}

const generate = (s: GenSettings) => generateProject(s, { createdAt: 0 })

const eventAt = (harmony: HarmonyEvent[], tick: number) =>
  [...harmony].reverse().find((e) => e.start <= tick) ?? harmony[0]

/** Share of notes whose pitch class is in the scale or in the sounding chord (incl. its power fifth). */
function inKeyShare(project: Project, track: Track): number {
  if (track.notes.length === 0) return 1
  let ok = 0
  for (const n of track.notes) {
    // Humanize may nudge a note across a chord change by up to 20 ticks.
    const events = [eventAt(project.harmony, Math.max(0, n.start - 25)), eventAt(project.harmony, n.start + 25)]
    const chordPcs = events.flatMap((event) => [
      ...chordPitchClasses(event.chord),
      ...chordPitchClasses(extendChord(event.chord, 'seventh', project.key, project.scale)),
      pitchClass(event.chord.root + 7),
    ])
    // Pentatonic and blues keys build chords from their parent seven-note scale.
    const inKey = isInScale(n.pitch, project.key, project.scale) || isInScale(n.pitch, project.key, SCALES[project.scale].harmony)
    if (inKey || chordPcs.includes(pitchClass(n.pitch))) ok++
  }
  return ok / track.notes.length
}

function expectValidTrack(project: Project, track: Track) {
  const total = ticksPerBar(project.timeSignature) * project.bars
  let prevStart = -1
  const lastEnd = new Map<number, number>()
  for (const n of track.notes) {
    expect(Number.isInteger(n.start) && Number.isInteger(n.duration)).toBe(true)
    expect(n.start).toBeGreaterThanOrEqual(0)
    expect(n.duration).toBeGreaterThan(0)
    expect(n.start + n.duration).toBeLessThanOrEqual(total)
    expect(n.pitch).toBeGreaterThanOrEqual(0)
    expect(n.pitch).toBeLessThanOrEqual(127)
    expect(n.velocity).toBeGreaterThanOrEqual(1)
    expect(n.velocity).toBeLessThanOrEqual(127)
    expect(n.start).toBeGreaterThanOrEqual(prevStart)
    expect(n.start).toBeGreaterThanOrEqual(lastEnd.get(n.pitch) ?? 0) // no same-pitch overlaps
    prevStart = n.start
    lastEnd.set(n.pitch, n.start + n.duration)
  }
  expect(new Set(track.notes.map((n) => n.id)).size).toBe(track.notes.length)
}

describe('generateProject', () => {
  it('is deterministic for the same settings and seed', () => {
    const s = settingsFor({ genre: 'jazz', mood: 'chill' })
    expect(generate(s)).toEqual(generate(s))
  })

  it('changes with the seed', () => {
    const a = generate(settingsFor({ seed: 1 }))
    const b = generate(settingsFor({ seed: 2 }))
    expect(a.tracks.map((t) => t.notes)).not.toEqual(b.tracks.map((t) => t.notes))
  })

  it('stores everything needed to regenerate and is JSON-serializable', () => {
    const p = generate(settingsFor())
    expect(JSON.parse(JSON.stringify(p))).toEqual(p)
    expect(p.settings.global.seed).toBe(4242)
    expect(p.scale).not.toBe('auto')
  })

  it('covers the timeline with contiguous harmony', () => {
    for (const bars of [1, 3, 8, 13, 32]) {
      for (const chordsPerBar of [0.5, 1, 2] as const) {
        const p = generate(settingsFor({ bars, chordsPerBar }))
        const total = ticksPerBar(p.timeSignature) * bars
        let t = 0
        for (const e of p.harmony) {
          expect(e.start).toBe(t)
          t += e.duration
        }
        expect(t).toBe(total)
      }
    }
  })

  // Acceptance: every genre × mood yields valid, in-key tracks.
  it.each(GENRES)('%s: valid, in-key tracks for every mood', (genre) => {
    for (const mood of MOODS) {
      const project = generate(settingsFor({ genre, mood, seed: GENRES.indexOf(genre) * 31 + MOODS.indexOf(mood) }))
      expect(project.tracks.map((t) => t.partType)).toEqual([...PART_TYPES])
      for (const track of project.tracks) {
        expectValidTrack(project, track)
        expect(track.notes.length, `${genre}/${mood}/${track.partType} is empty`).toBeGreaterThan(0)
        if (track.partType === 'drums') {
          expect(track.channel).toBe(DRUM_CHANNEL)
          for (const n of track.notes) expect(isGmDrumNote(n.pitch)).toBe(true)
          continue
        }
        expect(track.channel).not.toBe(DRUM_CHANNEL)
        const share = inKeyShare(project, track)
        const label = `${genre}/${mood}/${track.partType}`
        // Chords, pads, arps and melodies must be fully diatonic or chord tones.
        // Riffs carry deliberate chromatic colour; a bass that walks (chromatic approach
        // every few beats) or doubles the riff inherits that; other basses only add
        // the occasional approach note.
        const bassStyle = resolveStyle(project.settings, createRng(project.settings.global.seed).fork('style')).bassStyle
        const colourful = track.partType === 'riff' || (track.partType === 'bass' && (bassStyle === 'walking' || bassStyle === 'riff'))
        if (colourful) expect(share, label).toBeGreaterThanOrEqual(0.7)
        else if (track.partType === 'bass') expect(share, label).toBeGreaterThanOrEqual(0.8)
        else expect(share, label).toBe(1)
      }
    }
  })

  it.each([
    [3, 4],
    [6, 8],
  ])('handles %i/%i', (numerator, denominator) => {
    const ts: TimeSignature = { numerator, denominator }
    for (const genre of ['pop', 'jazz', 'metal', 'house'] as const) {
      const project = generate(settingsFor({ genre, timeSignature: ts, bars: 4 }))
      for (const track of project.tracks) {
        expectValidTrack(project, track)
        expect(track.notes.length).toBeGreaterThan(0)
      }
    }
  })

  it('handles every pattern length from 1 to 32 bars', () => {
    for (let bars = 1; bars <= 32; bars++) {
      const project = generate(settingsFor({ bars, seed: bars }))
      for (const track of project.tracks) expectValidTrack(project, track)
    }
  })

  it('generates only the chosen part in single mode', () => {
    for (const part of PART_TYPES) {
      const s = settingsFor({ mode: 'single', singlePart: part }, false)
      const p = generate(s)
      expect(p.tracks.map((t) => t.partType)).toEqual([part])
      expect(partsToGenerate(s)).toEqual([part])
    }
  })

  it('generates only enabled parts in multitrack mode', () => {
    const s = settingsFor({}, false)
    s.parts.drums.enabled = true
    s.parts.pad.enabled = true
    for (const p of ['bass', 'chords', 'melody', 'arp', 'riff'] as const) s.parts[p].enabled = false
    expect(generate(s).tracks.map((t) => t.partType)).toEqual(['drums', 'pad'])
  })

  it('uses genre default programs unless overridden', () => {
    const s = settingsFor({ genre: 'metal' })
    s.parts.chords.program = 5
    const p = generate(s)
    expect(p.tracks.find((t) => t.partType === 'riff')!.program).toBe(30)
    expect(p.tracks.find((t) => t.partType === 'chords')!.program).toBe(5)
  })

  it('makes the bass double the riff in metal', () => {
    const s = settingsFor({ genre: 'metal' })
    s.parts.bass.style = 'riff'
    s.global.swing = 0
    s.global.humanize = 0
    const p = generate(s)
    const riff = p.tracks.find((t) => t.partType === 'riff')!
    const bass = p.tracks.find((t) => t.partType === 'bass')!
    const riffStarts = new Set(riff.notes.map((n) => n.start))
    for (const n of bass.notes) expect(riffStarts.has(n.start)).toBe(true)
  })
})

describe('regeneratePart', () => {
  it('replaces only the target track and keeps its mixer state', () => {
    const original = generate(settingsFor())
    const muted = { ...original, tracks: original.tracks.map((t) => (t.partType === 'melody' ? { ...t, muted: true, volume: 0.3 } : t)) }
    const next = regeneratePart(muted, 'melody', partSeed(4242, 'melody', 1))
    for (const t of next.tracks) {
      const before = muted.tracks.find((b) => b.id === t.id)!
      if (t.partType === 'melody') {
        expect(t.notes).not.toEqual(before.notes)
        expect(t.muted).toBe(true)
        expect(t.volume).toBe(0.3)
      } else {
        expect(t).toBe(before)
      }
    }
    expect(next.harmony).toBe(original.harmony)
  })

  it('is deterministic for a seed', () => {
    const p = generate(settingsFor())
    const seed = partSeed(4242, 'drums', 7)
    expect(regeneratePart(p, 'drums', seed)).toEqual(regeneratePart(p, 'drums', seed))
  })

  it('adds a missing part in its natural position', () => {
    const s = settingsFor({}, false)
    for (const p of PART_TYPES) s.parts[p].enabled = p === 'drums' || p === 'melody'
    const next = regeneratePart(generate(s), 'bass', 99)
    expect(next.tracks.map((t) => t.partType)).toEqual(['drums', 'bass', 'melody'])
  })
})

describe('part details', () => {
  it('repeats the melody motif rhythm with full repetition (AABA)', () => {
    const s = settingsFor({ bars: 8, swing: 0, humanize: 0 })
    s.parts.melody.structure = 'AABA'
    s.parts.melody.repetition = 1
    const p = generate(s)
    const melody = p.tracks.find((t) => t.partType === 'melody')!
    const seg = 2 * ticksPerBar(p.timeSignature)
    const onsets = (i: number) => melody.notes.filter((n) => n.start >= i * seg && n.start < (i + 1) * seg).map((n) => n.start - i * seg)
    expect(onsets(1)).toEqual(onsets(0))
    expect(onsets(3)).toEqual(onsets(0))
  })

  it('walks one note per beat', () => {
    const s = settingsFor({ genre: 'jazz', swing: 0, humanize: 0, bars: 4 })
    s.parts.bass.style = 'walking'
    const bass = generate(s).tracks.find((t) => t.partType === 'bass')!
    expect(bass.notes).toHaveLength(16)
    expect(bass.notes.map((n) => n.start)).toEqual(Array.from({ length: 16 }, (_, i) => i * PPQ))
  })

  it('places crashes on section starts and fills before them', () => {
    const s = settingsFor({ genre: 'rock', bars: 8, swing: 0, humanize: 0 })
    s.parts.drums.fillEvery = 4
    s.parts.drums.crashOnSection = true
    const drums = generate(s).tracks.find((t) => t.partType === 'drums')!
    const bar = ticksPerBar({ numerator: 4, denominator: 4 })
    const crashes = drums.notes.filter((n) => n.pitch === DRUM_NOTES.crash).map((n) => n.start)
    expect(crashes).toContain(0)
    expect(crashes).toContain(4 * bar)
  })

  it('omits ghost notes when disabled', () => {
    const s = settingsFor({ genre: 'funk', humanize: 0 })
    s.parts.drums.ghostNotes = false
    const drums = generate(s).tracks.find((t) => t.partType === 'drums')!
    for (const n of drums.notes) expect(n.velocity).toBeGreaterThan(45)
  })

  it('builds arpeggio shapes', () => {
    const tones = arpTones({ root: 0, quality: 'maj' }, 60, 1)
    expect(tones).toEqual([60, 64, 67, 72])
    const rng = createRng(1)
    expect(arpSequence(tones, 'up', rng)).toEqual([60, 64, 67, 72])
    expect(arpSequence(tones, 'down', rng)).toEqual([72, 67, 64, 60])
    expect(arpSequence(tones, 'upDown', rng)).toEqual([60, 64, 67, 72, 67, 64])
    expect(arpSequence(tones, 'converge', rng)).toEqual([60, 72, 64, 67])
    expect([...arpSequence(tones, 'random', rng)].sort()).toEqual(tones)
  })

  it('plays the arp at the chosen rate', () => {
    const s = settingsFor({ bars: 1, swing: 0, humanize: 0 })
    s.parts.arp.rate = '1/16'
    const arp = generate(s).tracks.find((t) => t.partType === 'arp')!
    expect(arp.notes).toHaveLength(16)
  })

  it('ties shared pad notes across chord changes', () => {
    const s = settingsFor({ progression: 'axis', chordsPerBar: 1, bars: 4 })
    const pad = generate(s).tracks.find((t) => t.partType === 'pad')!
    // At least one note sustains through a chord change.
    expect(pad.notes.some((n) => n.duration > ticksPerBar({ numerator: 4, denominator: 4 }))).toBe(true)
  })
})

describe('post-processing', () => {
  it('swings off-beat sixteenths later, keeps downbeats', () => {
    expect(swingTick(0, 1, 16)).toBe(0)
    expect(swingTick(240, 1, 16)).toBe(240)
    expect(swingTick(120, 1, 16)).toBe(160) // triplet position
    expect(swingTick(120, 0.5, 16)).toBe(140)
    expect(swingTick(240, 1, 8)).toBe(320)
  })

  it('keeps durations positive when swinging', () => {
    const swung = applySwing([{ pitch: 60, start: 120, duration: 120, velocity: 100 }], 1, 16)
    expect(swung[0]).toEqual({ pitch: 60, start: 160, duration: 80, velocity: 100 })
  })

  it('humanizes within limits and keeps tick 0', () => {
    const notes = Array.from({ length: 200 }, (_, i) => ({ pitch: 60, start: i * 120, duration: 60, velocity: 100 }))
    const out = humanize(notes, 1, createRng(3))
    expect(out[0].start).toBe(0)
    for (let i = 0; i < out.length; i++) {
      expect(Math.abs(out[i].start - notes[i].start)).toBeLessThanOrEqual(20)
      expect(Math.abs(out[i].velocity - 100)).toBeLessThanOrEqual(12)
    }
  })

  it('cleans notes: clips, clamps, dedupes and removes same-pitch overlaps', () => {
    const out = finalizeNotes(
      [
        { pitch: 60, start: 0, duration: 500, velocity: 90 },
        { pitch: 60, start: 0, duration: 100, velocity: 120 },
        { pitch: 60, start: 240, duration: 100, velocity: 80 },
        { pitch: 130, start: 900, duration: 500, velocity: 0 },
        { pitch: 62, start: 2000, duration: 10, velocity: 50 },
      ],
      1000,
    )
    expect(out).toEqual([
      { pitch: 60, start: 0, duration: 100, velocity: 120 },
      { pitch: 60, start: 240, duration: 100, velocity: 80 },
      { pitch: 127, start: 900, duration: 100, velocity: 1 },
    ])
  })
})
