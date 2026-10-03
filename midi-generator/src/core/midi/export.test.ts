import { Midi } from '@tonejs/midi'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../defaults'
import { generateProject } from '../generators'
import { DRUM_CHANNEL } from '../presets/gm'
import { PART_TYPES, PPQ, type Project } from '../types'
import { bytesToBase64, downloadUrlValue, setDragDownload } from './download'
import {
  baseFileName,
  projectFileName,
  projectToMidi,
  projectToZip,
  trackFileName,
  trackToMidi,
  zipFileName,
} from './export'

function project(patch: Partial<Project['settings']['global']> = {}): Project {
  const s = createDefaultSettings(123456)
  s.global = { ...s.global, genre: 'lofi', mood: 'chill', key: 9, scale: 'minor', bpm: 82, ...patch }
  for (const p of PART_TYPES) s.parts[p].enabled = true
  return generateProject(s, { createdAt: 0 })
}

describe('projectToMidi', () => {
  it('round-trips tracks, notes, tempo and meter', () => {
    const p = project({ timeSignature: { numerator: 6, denominator: 8 } })
    const midi = new Midi(projectToMidi(p))

    expect(midi.header.ppq).toBe(PPQ)
    expect(midi.header.tempos[0].bpm).toBeCloseTo(82, 3) // tempo is stored in whole µs per beat
    expect(midi.header.timeSignatures[0].timeSignature).toEqual([6, 8])
    expect(midi.tracks).toHaveLength(p.tracks.length)

    p.tracks.forEach((track, i) => {
      const t = midi.tracks[i]
      expect(t.name).toBe(track.name.charAt(0).toUpperCase() + track.name.slice(1))
      expect(t.channel).toBe(track.channel)
      expect(t.notes).toHaveLength(track.notes.length)
      if (track.partType !== 'drums') expect(t.instrument.number).toBe(track.program)
      const sorted = [...t.notes].sort((a, b) => a.ticks - b.ticks || a.midi - b.midi)
      const expected = [...track.notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch)
      sorted.forEach((n, j) => {
        expect(n.midi).toBe(expected[j].pitch)
        expect(n.ticks).toBe(expected[j].start)
        expect(n.durationTicks).toBe(expected[j].duration)
        expect(Math.round(n.velocity * 127)).toBe(expected[j].velocity)
      })
    })
  })

  it('puts drums on channel 10 as percussion', () => {
    const p = project()
    const midi = new Midi(projectToMidi(p))
    const drums = midi.tracks[p.tracks.findIndex((t) => t.partType === 'drums')]
    expect(drums.channel).toBe(DRUM_CHANNEL)
    expect(drums.instrument.percussion).toBe(true)
  })

  it('writes track volume as CC7', () => {
    const p = project()
    p.tracks[0] = { ...p.tracks[0], volume: 0.5 }
    const midi = new Midi(projectToMidi(p))
    expect(midi.tracks[0].controlChanges[7][0].value).toBeCloseTo(0.5, 1)
  })

  it('uses custom track names', () => {
    const p = project()
    const midi = new Midi(projectToMidi(p, { trackName: (t) => `Spur ${t.partType}` }))
    expect(midi.tracks[0].name).toBe(`Spur ${p.tracks[0].partType}`)
  })

  it('exports a single track', () => {
    const p = project()
    const bass = p.tracks.find((t) => t.partType === 'bass')!
    const midi = new Midi(trackToMidi(p, bass))
    expect(midi.tracks).toHaveLength(1)
    expect(midi.tracks[0].notes).toHaveLength(bass.notes.length)
    expect(midi.header.tempos[0].bpm).toBeCloseTo(82, 3) // tempo is stored in whole µs per beat
  })
})

describe('projectToZip', () => {
  it('contains one valid .mid per track', () => {
    const p = project()
    const files = unzipSync(projectToZip(p))
    const names = Object.keys(files)
    expect(names).toHaveLength(p.tracks.length)
    for (const track of p.tracks) {
      const name = trackFileName(p, track)
      expect(names).toContain(name)
      const midi = new Midi(files[name])
      expect(midi.tracks[0].notes).toHaveLength(track.notes.length)
    }
  })
})

describe('file names', () => {
  it('follow genre_mood_key_bpm_seed', () => {
    const p = project()
    expect(baseFileName(p)).toBe(`lofi_chill_A-minor_82bpm_${(123456).toString(36)}`)
    expect(projectFileName(p)).toMatch(/\.mid$/)
    expect(zipFileName(p)).toMatch(/\.zip$/)
    expect(trackFileName(p, p.tracks[0])).toBe(`${baseFileName(p)}_drums.mid`)
  })

  it('spell keys with sharps or flats', () => {
    expect(baseFileName(project({ key: 3, scale: 'minor' }))).toContain('_Eb-minor_')
    expect(baseFileName(project({ key: 6, scale: 'minor' }))).toContain('_F#-minor_')
  })
})

describe('drag & download helpers', () => {
  it('encodes base64', () => {
    expect(bytesToBase64(new Uint8Array([77, 84, 104, 100]))).toBe('TVRoZA==')
    const big = new Uint8Array(100_000).fill(65)
    expect(atob(bytesToBase64(big))).toHaveLength(100_000)
  })

  it('builds a DownloadURL drag payload', () => {
    const bytes = new Uint8Array([1, 2, 3])
    expect(downloadUrlValue(bytes, 'a.mid')).toBe('audio/midi:a.mid:data:audio/midi;base64,AQID')
    const data = new Map<string, string>()
    const dt = { setData: (k: string, v: string) => void data.set(k, v), effectAllowed: 'none' as DataTransfer['effectAllowed'] }
    setDragDownload(dt, bytes, 'a.mid')
    expect(data.get('DownloadURL')).toBe('audio/midi:a.mid:data:audio/midi;base64,AQID')
    expect(dt.effectAllowed).toBe('copy')
  })

  it('produces a file that starts with the MIDI header', () => {
    const bytes = projectToMidi(project())
    expect(strFromU8(bytes.subarray(0, 4), true)).toBe('MThd')
  })
})
