import { Midi } from '@tonejs/midi'
import { zipSync } from 'fflate'
import { keyName } from '../theory/scales'
import type { Project, Track } from '../types'

export const MIDI_MIME = 'audio/midi'
export const ZIP_MIME = 'application/zip'

export interface ExportOptions {
  /** Tracks to include; defaults to all tracks of the project. */
  tracks?: readonly Track[]
  /**
   * Display name per track; defaults to the capitalized English part name. MIDI text
   * events are 8-bit, so non-Latin names (e.g. Cyrillic) would arrive garbled in DAWs.
   */
  trackName?: (track: Track) => string
}

const defaultTrackName = (track: Track) => track.name.charAt(0).toUpperCase() + track.name.slice(1)

/**
 * Builds a Standard MIDI File (type 1, PPQ 480): tempo and time signature in the
 * header, one MIDI track per project track with its name, channel (drums on
 * channel 10), GM program and volume (CC7).
 *
 * Key signatures are deliberately not written: @tonejs/midi 2.0.28 encodes them
 * with a wrong offset, and DAWs ignore them for playback anyway.
 */
export function projectToMidi(project: Project, opts: ExportOptions = {}): Uint8Array {
  const midi = new Midi()
  const name = opts.trackName ?? defaultTrackName
  midi.header.name = baseFileName(project)
  midi.header.setTempo(project.bpm)
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [project.timeSignature.numerator, project.timeSignature.denominator],
  })

  for (const track of opts.tracks ?? project.tracks) {
    const t = midi.addTrack()
    t.name = name(track)
    t.channel = track.channel
    t.instrument.number = track.partType === 'drums' ? 0 : track.program
    t.addCC({ number: 7, value: Math.min(1, Math.max(0, track.volume)), ticks: 0 })
    for (const n of track.notes) {
      t.addNote({
        midi: n.pitch,
        ticks: n.start,
        durationTicks: n.duration,
        // The encoder floors velocity × 127; nudge up half a step so values survive exactly.
        velocity: Math.min(1, (n.velocity + 0.5) / 127),
      })
    }
  }
  return midi.toArray()
}

export function trackToMidi(project: Project, track: Track, opts: Omit<ExportOptions, 'tracks'> = {}): Uint8Array {
  return projectToMidi(project, { ...opts, tracks: [track] })
}

/** A ZIP with one .mid file per track. */
export function projectToZip(project: Project, opts: Omit<ExportOptions, 'tracks'> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  for (const track of project.tracks) {
    files[trackFileName(project, track)] = trackToMidi(project, track, opts)
  }
  // MIDI files are tiny and already compact: store without compression.
  return zipSync(files, { level: 0 })
}

/* ---------- File names ---------- */

function sanitize(part: string): string {
  return part.replace(/[^\w#-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

/** e.g. "lofi_chill_A-minor_80bpm_1a2b3c" */
export function baseFileName(project: Project): string {
  const { genre, mood, seed } = project.settings.global
  const key = `${keyName(project.key, project.scale)}-${project.scale}`
  return [genre, mood, key, `${project.bpm}bpm`, (seed >>> 0).toString(36)].map(sanitize).join('_')
}

export function projectFileName(project: Project): string {
  return `${baseFileName(project)}.mid`
}

export function trackFileName(project: Project, track: Track): string {
  return `${baseFileName(project)}_${sanitize(track.name)}.mid`
}

export function zipFileName(project: Project): string {
  return `${baseFileName(project)}.zip`
}
