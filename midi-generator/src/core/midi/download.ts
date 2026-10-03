/**
 * Browser helpers for getting files out of the app: a regular download, and
 * dragging a file straight into a DAW (Chromium's DownloadURL drag type).
 */
import type { Project, Track } from '../types'
import {
  MIDI_MIME,
  ZIP_MIME,
  type ExportOptions,
  projectFileName,
  projectToMidi,
  trackFileName,
  trackToMidi,
  zipFileName,
} from './export'

/** Saves bytes as a file via a temporary object URL. */
export function downloadBytes(bytes: Uint8Array, fileName: string, mime: string): void {
  const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke after the click has been handled; revoking synchronously can cancel the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/** Value for the `DownloadURL` drag type: "mime:filename:url". */
export function downloadUrlValue(bytes: Uint8Array, fileName: string, mime = MIDI_MIME): string {
  return `${mime}:${fileName}:data:${mime};base64,${bytesToBase64(bytes)}`
}

/**
 * Lets the user drag a file out of the page into a DAW or file manager.
 * Supported by Chromium-based browsers; elsewhere the drag carries nothing.
 */
export function setDragDownload(
  dataTransfer: Pick<DataTransfer, 'setData' | 'effectAllowed'>,
  bytes: Uint8Array,
  fileName: string,
  mime = MIDI_MIME,
): void {
  dataTransfer.setData('DownloadURL', downloadUrlValue(bytes, fileName, mime))
  dataTransfer.setData('text/plain', fileName)
  dataTransfer.effectAllowed = 'copy'
}

export function downloadProject(project: Project, opts?: ExportOptions): void {
  downloadBytes(projectToMidi(project, opts), projectFileName(project), MIDI_MIME)
}

export function downloadTrack(project: Project, track: Track, opts?: Omit<ExportOptions, 'tracks'>): void {
  downloadBytes(trackToMidi(project, track, opts), trackFileName(project, track), MIDI_MIME)
}

export async function downloadZip(project: Project, opts?: Omit<ExportOptions, 'tracks'>): Promise<void> {
  const { projectToZip } = await import('./zip')
  downloadBytes(projectToZip(project, opts), zipFileName(project), ZIP_MIME)
}
