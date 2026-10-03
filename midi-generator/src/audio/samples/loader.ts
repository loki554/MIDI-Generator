/**
 * Loads sample instruments on demand. `smplr` itself is imported dynamically,
 * so it (and every sample request) stays out of the app until a pack is chosen.
 */
import type { DrumMachine, Soundfont } from 'smplr'
import type { Project, Track } from '../../core/types'
import type { Voice } from '../synth/voice'
import { dbToGain, drumMachineUrl, PACKS, type PackId, soundfontUrl } from './packs'

type SmplrModule = typeof import('smplr')
let smplrModule: Promise<SmplrModule> | null = null
const loadSmplr = () => (smplrModule ??= import('smplr'))

/** Release tail after a sampled note's end that we keep tracking the voice for. */
const TAIL = 1.2
/** One-shot drum samples: how long a hit may ring. */
const DRUM_RING = 2.5

interface Entry {
  key: string
  inst: Soundfont | DrumMachine | null
  /** Makeup gain between the instrument and the track bus. */
  makeup: GainNode
  ready: boolean
  failed: boolean
  promise: Promise<void>
}

const prefersOgg = () => {
  try {
    return new Audio().canPlayType('audio/ogg; codecs="vorbis"') !== ''
  } catch {
    return false
  }
}

export interface PrepareProgress {
  loaded: number
  total: number
  failed: number
  /** True when new instruments had to be requested (not all cached). */
  fetching: boolean
}

export class SampleBank {
  private entries = new Map<string, Entry>()
  private readonly ctx: AudioContext

  constructor(ctx: AudioContext) {
    this.ctx = ctx
  }

  /**
   * Drum kits are shared across projects; melodic instruments are per project,
   * because each decodes only the pitches its notes use.
   */
  private keyFor(pack: PackId, track: Track, projectId: string): string {
    return track.partType === 'drums'
      ? `${pack}|${track.id}|drums`
      : `${pack}|${projectId}|${track.id}|${track.program}`
  }

  /**
   * Requests the instruments the project needs from `pack` and frees ones that
   * are no longer used. Resolves when all requested instruments have loaded or failed.
   */
  async prepare(
    pack: PackId,
    project: Project,
    busFor: (trackId: string) => AudioNode,
    onProgress: (p: PrepareProgress) => void,
  ): Promise<PrepareProgress> {
    const wanted = new Map(project.tracks.map((t) => [this.keyFor(pack, t, project.id), t]))
    for (const [key, entry] of this.entries) {
      if (!wanted.has(key)) {
        entry.inst?.dispose()
        entry.makeup.disconnect()
        this.entries.delete(key)
      }
    }

    let fetching = false
    for (const [key, track] of wanted) {
      if (this.entries.has(key)) continue
      fetching = true
      this.entries.set(key, this.create(key, pack, track, busFor(track.id)))
    }

    const entries = [...wanted.keys()].map((k) => this.entries.get(k)!)
    const progress = (): PrepareProgress => ({
      loaded: entries.filter((e) => e.ready).length,
      total: entries.length,
      failed: entries.filter((e) => e.failed).length,
      fetching,
    })
    onProgress(progress())
    await Promise.all(entries.map((e) => e.promise.then(() => onProgress(progress()))))
    return progress()
  }

  private create(key: string, pack: PackId, track: Track, bus: AudioNode): Entry {
    const def = PACKS[pack]
    const makeup = this.ctx.createGain()
    makeup.gain.value = dbToGain(track.partType === 'drums' ? def.drumGainDb : def.melodicGainDb)
    makeup.connect(bus)
    const destination = makeup
    const entry: Entry = { key, inst: null, makeup, ready: false, failed: false, promise: Promise.resolve() }
    entry.promise = loadSmplr()
      .then(async ({ DrumMachine, Soundfont }) => {
        if (!this.entries.has(key)) return
        if (track.partType === 'drums') {
          entry.inst = DrumMachine(this.ctx, { instrument: def.drums, url: drumMachineUrl(def.drums), destination })
        } else {
          const pitches = [...new Set(track.notes.map((n) => n.pitch))]
          entry.inst = Soundfont(this.ctx, {
            instrumentUrl: soundfontUrl(def.soundfont, track.program, prefersOgg() ? 'ogg' : 'mp3'),
            destination,
            // Decode only the notes in use; notes added later borrow the nearest sample.
            notesToLoad: { notes: pitches.length ? pitches : [60], fallback: 'nearest' },
          })
        }
        await entry.inst.ready
        entry.ready = true
      })
      .catch((err: unknown) => {
        entry.failed = true
        console.warn(`Sample instrument failed to load (${key}); using the synth instead.`, err)
      })
    return entry
  }

  /**
   * Plays a note with the track's sample instrument. Returns null when the
   * instrument isn't ready (still loading or failed) or the drum kit has no
   * sample for that note — the caller then uses the synth.
   */
  play(
    pack: PackId,
    projectId: string,
    track: Track,
    pitch: number,
    velocity: number,
    time: number,
    seconds: number,
  ): Voice | null {
    const entry = this.entries.get(this.keyFor(pack, track, projectId))
    if (!entry?.ready || !entry.inst) return null
    let stopFn: (time?: number) => void
    let end: number
    if (track.partType === 'drums') {
      const sample = PACKS[pack].drumMap[pitch]
      if (!sample) return null
      stopFn = entry.inst.start({ note: sample, velocity, time })
      end = time + DRUM_RING
    } else {
      stopFn = entry.inst.start({ note: pitch, velocity, time, duration: Math.max(0.03, seconds) })
      end = time + seconds + TAIL
    }
    const voice: Voice = {
      start: time,
      end,
      stop: (t) => {
        stopFn(Math.max(t, this.ctx.currentTime))
        voice.end = Math.min(voice.end, t + 0.3)
      },
    }
    return voice
  }

  /** Frees every instrument (e.g. when switching back to the synth). */
  clear(): void {
    for (const entry of this.entries.values()) {
      entry.inst?.dispose()
      entry.makeup.disconnect()
    }
    this.entries.clear()
  }
}
