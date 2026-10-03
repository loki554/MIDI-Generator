/** ZIP export lives in its own module so fflate is only loaded when needed. */
import { zipSync } from 'fflate'
import type { Project } from '../types'
import { type ExportOptions, trackFileName, trackToMidi } from './export'

/** A ZIP with one .mid file per track. */
export function projectToZip(project: Project, opts: Omit<ExportOptions, 'tracks'> = {}): Uint8Array {
  const files: Record<string, Uint8Array> = {}
  for (const track of project.tracks) {
    files[trackFileName(project, track)] = trackToMidi(project, track, opts)
  }
  // MIDI files are tiny and already compact: store without compression.
  return zipSync(files, { level: 0 })
}
