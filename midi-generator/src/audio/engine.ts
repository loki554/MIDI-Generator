/**
 * Playback engine: a lookahead scheduler on the Web Audio clock.
 *
 * Every ~25 ms it reads the *current* project (so edits made during playback
 * are heard on the next pass) and schedules notes starting within the next
 * ~120 ms. Time runs on an ever-growing "unwrapped" tick line that maps back
 * into the loop region (see timeline.ts).
 */
import { ticksPerBar, ticksPerBeat, totalTicks } from '../core/time'
import { PPQ, type Project, type Tick, type Track } from '../core/types'
import { playDrum } from './synth/drums'
import type { Voice } from './synth/voice'
import { playSynthNote, voiceKindFor } from './synth/voices'
import { gridInWindow, notesInWindow, type LoopRange, wrapTick } from './timeline'

const LOOKAHEAD = 0.12
const INTERVAL_MS = 25
const START_DELAY = 0.05
const MAX_VOICES = 160

export interface EngineState {
  project: Project | null
  loop: boolean
  loopRegion: LoopRange | null
  metronome: boolean
}

const sameLoop = (a: LoopRange | null, b: LoopRange | null) =>
  a === b || (a !== null && b !== null && a.start === b.start && a.end === b.end)

export class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private buses = new Map<string, GainNode>()
  private voices = new Set<Voice>()
  private timer: number | null = null

  private playing = false
  /** Audio time at which `anchorTick` (unwrapped) sounds. */
  private anchorTime = 0
  private anchorTick: Tick = 0
  /** Tempo (ticks per second) and loop the anchor was computed with; a change re-anchors. */
  private anchorTps = (120 * PPQ) / 60
  private anchorLoop: LoopRange | null = null
  /** Unwrapped tick up to which notes are scheduled. */
  private scheduledTo: Tick = 0

  private readonly getState: () => EngineState
  private readonly onEnded: () => void

  constructor(getState: () => EngineState, onEnded: () => void) {
    this.getState = getState
    this.onEnded = onEnded
  }

  /** Creates (on first use) and resumes the AudioContext. Call from a user gesture. */
  async ensure(): Promise<AudioContext> {
    if (!this.ctx) {
      const ctx = new AudioContext({ latencyHint: 'interactive' })
      const master = ctx.createGain()
      master.gain.value = 0.8
      // Gentle limiter so dense arrangements don't clip.
      const limiter = ctx.createDynamicsCompressor()
      limiter.threshold.value = -6
      limiter.knee.value = 4
      limiter.ratio.value = 12
      limiter.attack.value = 0.003
      limiter.release.value = 0.2
      master.connect(limiter).connect(ctx.destination)
      this.ctx = ctx
      this.master = master
    }
    if (this.ctx.state !== 'running') await this.ctx.resume()
    return this.ctx
  }

  get isPlaying(): boolean {
    return this.playing
  }

  get context(): AudioContext | null {
    return this.ctx
  }

  get activeVoices(): number {
    return this.voices.size
  }

  async play(fromTick: Tick): Promise<void> {
    const ctx = await this.ensure()
    this.stopVoices(ctx.currentTime)
    const loop = this.loopRange()
    const start = loop && (fromTick < loop.start || fromTick >= loop.end) ? loop.start : fromTick
    this.anchor(ctx.currentTime + START_DELAY, start)
    this.playing = true
    this.tick()
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), INTERVAL_MS)
  }

  stop(): void {
    this.playing = false
    if (this.timer !== null) {
      window.clearInterval(this.timer)
      this.timer = null
    }
    if (this.ctx) this.stopVoices(this.ctx.currentTime)
  }

  /** Current playback position as a pattern tick, or null when stopped. */
  position(): Tick | null {
    if (!this.playing || !this.ctx) return null
    // What is heard now was scheduled `outputLatency` ago.
    const heard = this.ctx.currentTime - (this.ctx.outputLatency || 0)
    const unwrapped = Math.max(this.anchorTick, this.unwrappedAt(heard))
    return wrapTick(unwrapped, this.anchorLoop)
  }

  /** Plays a single note right away, e.g. when drawing in the piano roll. */
  async preview(track: Track, pitch: number, velocity = 100, seconds = 0.35): Promise<void> {
    const ctx = await this.ensure()
    this.updateBus(track, true)
    const project = this.getState().project
    this.addVoice(this.voiceFor(ctx, this.busFor(track.id), track, pitch, velocity, ctx.currentTime + 0.005, seconds, project))
  }

  /* ---------- timing ---------- */

  private loopRange(): LoopRange | null {
    const { project, loop, loopRegion } = this.getState()
    if (!loop || !project) return null
    const total = totalTicks(project.timeSignature, project.bars)
    if (loopRegion && loopRegion.end > loopRegion.start && loopRegion.start < total) {
      return { start: Math.max(0, loopRegion.start), end: Math.min(total, loopRegion.end) }
    }
    return { start: 0, end: total }
  }

  private ticksPerSecond(): number {
    return ((this.getState().project?.bpm ?? 120) * PPQ) / 60
  }

  private unwrappedAt(time: number): Tick {
    return this.anchorTick + (time - this.anchorTime) * this.anchorTps
  }

  private timeAt(unwrapped: Tick): number {
    return this.anchorTime + (unwrapped - this.anchorTick) / this.anchorTps
  }

  private anchor(time: number, unwrapped: Tick): void {
    this.anchorTime = time
    this.anchorTick = unwrapped
    this.scheduledTo = unwrapped
    this.anchorTps = this.ticksPerSecond()
    this.anchorLoop = this.loopRange()
  }

  private anchorIsStale(): boolean {
    return !sameLoop(this.loopRange(), this.anchorLoop) || this.ticksPerSecond() !== this.anchorTps
  }

  /** Tempo or loop changed while playing: continue from the current position. */
  private reanchor(now: number): void {
    // Current position under the old tempo and loop.
    let pos = wrapTick(this.unwrappedAt(now), this.anchorLoop)
    const loop = this.loopRange()
    if (loop && (pos < loop.start || pos >= loop.end)) pos = loop.start
    // Drop notes queued with the old timing; they get rescheduled.
    for (const v of this.voices) if (v.start > now + 0.005) v.stop(now)
    this.anchor(now, pos)
  }

  /* ---------- scheduling ---------- */

  private tick(): void {
    const ctx = this.ctx
    const state = this.getState()
    if (!ctx || !this.playing || !state.project) return
    const project = state.project
    const now = ctx.currentTime

    if (this.anchorIsStale()) this.reanchor(now)

    const loop = this.anchorLoop
    const end = totalTicks(project.timeSignature, project.bars)

    // Without looping, stop once the pattern has finished.
    if (!loop && this.unwrappedAt(now) >= end) {
      this.stop()
      this.onEnded()
      return
    }

    const anySolo = project.tracks.some((t) => t.solo)
    for (const track of project.tracks) this.updateBus(track, anySolo ? track.solo : !track.muted)

    const from = this.scheduledTo
    const horizon = this.unwrappedAt(now + LOOKAHEAD)
    const to = loop ? horizon : Math.min(horizon, end)
    if (to > from) {
      for (const track of project.tracks) {
        const out = this.busFor(track.id)
        for (const s of notesInWindow(track.notes, from, to, loop)) {
          const t = this.timeAt(s.at)
          if (t < now) continue
          this.addVoice(this.voiceFor(ctx, out, track, s.note.pitch, s.note.velocity, t, s.duration / this.anchorTps, project))
        }
      }
      if (state.metronome) this.scheduleClicks(ctx, project, from, to, loop)
      this.scheduledTo = to
    }
    this.pruneVoices(now)
  }

  private scheduleClicks(ctx: AudioContext, project: Project, from: Tick, to: Tick, loop: LoopRange | null): void {
    const beat = ticksPerBeat(project.timeSignature)
    const bar = ticksPerBar(project.timeSignature)
    for (const g of gridInWindow(beat, from, to, loop)) {
      const t = this.timeAt(g.at)
      if (t < ctx.currentTime) continue
      const accent = g.tick % bar === 0
      const o = ctx.createOscillator()
      const amp = ctx.createGain()
      o.frequency.value = accent ? 1600 : 1100
      amp.gain.setValueAtTime(0, t)
      amp.gain.linearRampToValueAtTime(accent ? 0.35 : 0.22, t + 0.001)
      amp.gain.setTargetAtTime(0, t + 0.001, 0.015)
      o.connect(amp).connect(this.master!)
      o.start(t)
      o.stop(t + 0.1)
    }
  }

  /* ---------- voices & buses ---------- */

  private voiceFor(
    ctx: AudioContext,
    out: AudioNode,
    track: Track,
    pitch: number,
    velocity: number,
    time: number,
    seconds: number,
    project: Project | null,
  ): Voice {
    if (track.partType === 'drums') return playDrum(ctx, out, pitch, velocity, time)
    const kind = voiceKindFor(track.partType, track.program, project?.settings.global.genre)
    return playSynthNote(ctx, out, kind, pitch, velocity, time, Math.max(0.03, seconds))
  }

  private addVoice(voice: Voice): void {
    this.voices.add(voice)
    if (this.voices.size > MAX_VOICES) {
      // Steal the oldest voice.
      const oldest = this.voices.values().next().value
      if (oldest) {
        oldest.stop(this.ctx?.currentTime ?? 0)
        this.voices.delete(oldest)
      }
    }
  }

  private pruneVoices(now: number): void {
    for (const v of this.voices) if (v.end < now) this.voices.delete(v)
  }

  private stopVoices(now: number): void {
    for (const v of this.voices) v.stop(now)
    this.voices.clear()
  }

  private busFor(trackId: string): GainNode {
    let bus = this.buses.get(trackId)
    if (!bus) {
      bus = this.ctx!.createGain()
      bus.connect(this.master!)
      this.buses.set(trackId, bus)
    }
    return bus
  }

  private updateBus(track: Track, audible: boolean): void {
    const bus = this.busFor(track.id)
    const target = audible ? track.volume ** 1.5 : 0
    if (Math.abs(bus.gain.value - target) > 1e-4) bus.gain.setTargetAtTime(target, this.ctx!.currentTime, 0.01)
  }
}
