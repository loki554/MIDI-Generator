/**
 * Small subtractive synth voices, one recipe per instrument family. Each note
 * builds its own short-lived node graph; nothing is shared between notes.
 */
import type { Genre, PartType } from '../../core/types'
import { applyEnvelope, type Envelope, makeVoice, midiToFreq, velocityGain, type Voice } from './voice'

export type VoiceKind =
  | 'piano'
  | 'epiano'
  | 'organ'
  | 'bell'
  | 'pluck'
  | 'guitar'
  | 'bass'
  | 'subBass'
  | 'pad'
  | 'strings'
  | 'lead'
  | 'brass'

/** Picks a synth recipe for a track from its GM program (and genre, for the 808). */
export function voiceKindFor(partType: PartType, program: number, genre?: Genre): VoiceKind {
  if (partType === 'bass' && genre === 'hipHop') return 'subBass'
  if (program <= 3) return 'piano'
  if (program <= 5) return 'epiano'
  if (program <= 7) return 'pluck'
  if (program <= 15) return program === 12 ? 'pluck' : 'bell'
  if (program <= 23) return program === 22 ? 'lead' : 'organ'
  if (program <= 28) return 'pluck'
  if (program <= 30) return 'guitar'
  if (program === 31) return 'bell'
  if (program <= 39) return 'bass'
  if (program <= 47) return program === 45 || program === 46 ? 'pluck' : program === 47 ? 'bass' : 'strings'
  if (program <= 55) return program >= 52 && program <= 54 ? 'pad' : program === 55 ? 'brass' : 'strings'
  if (program <= 63) return 'brass'
  if (program <= 87) return 'lead'
  if (program <= 95) return 'pad'
  if (program <= 103) return program === 98 ? 'bell' : 'pad'
  if (program <= 111) return 'pluck'
  if (program <= 119) return 'bell'
  return 'pad'
}

interface Ctx {
  ctx: BaseAudioContext
  out: AudioNode
}

function osc(c: Ctx, type: OscillatorType, freq: number, start: number, detuneCents = 0): OscillatorNode {
  const o = c.ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(freq, start)
  o.detune.setValueAtTime(detuneCents, start)
  o.start(start)
  return o
}

function lowpass(c: Ctx, freq: number, q = 0.7): BiquadFilterNode {
  const f = c.ctx.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = Math.min(18000, freq)
  f.Q.value = q
  return f
}

let distortionCurve: Float32Array<ArrayBuffer> | null = null
function getDistortionCurve(): Float32Array<ArrayBuffer> {
  if (!distortionCurve) {
    const n = 2048
    distortionCurve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      distortionCurve[i] = Math.tanh(x * 5) / Math.tanh(5)
    }
  }
  return distortionCurve
}

interface Recipe {
  env: Envelope
  level: number
  build: (c: Ctx, freq: number, start: number, end: number, amp: GainNode, vel: number) => AudioScheduledSourceNode[]
}

/** Percussive envelopes decay faster for higher notes, like real strings. */
const pitchDecay = (freq: number, base: number) => base * Math.min(1.6, Math.max(0.35, 220 / freq) ** 0.5)

const RECIPES: Record<VoiceKind, Recipe> = {
  piano: {
    env: { attack: 0.003, decay: 0.9, sustain: 0, release: 0.25 },
    level: 0.5,
    build: (c, f, start, _end, amp, vel) => {
      const filter = lowpass(c, f * (3 + vel * 5))
      filter.frequency.setTargetAtTime(f * 2, start + 0.02, 0.4)
      const a = osc(c, 'triangle', f, start)
      const b = osc(c, 'sine', f * 2, start)
      const bGain = c.ctx.createGain()
      bGain.gain.value = 0.25
      a.connect(filter)
      b.connect(bGain).connect(filter)
      filter.connect(amp)
      return [a, b]
    },
  },
  epiano: {
    env: { attack: 0.004, decay: 0.8, sustain: 0.25, release: 0.35 },
    level: 0.5,
    build: (c, f, start, _end, amp) => {
      const a = osc(c, 'sine', f, start)
      const tine = osc(c, 'sine', f * 4, start, 3)
      const tineGain = c.ctx.createGain()
      tineGain.gain.setValueAtTime(0.3, start)
      tineGain.gain.setTargetAtTime(0, start, 0.08)
      a.connect(amp)
      tine.connect(tineGain).connect(amp)
      return [a, tine]
    },
  },
  organ: {
    env: { attack: 0.01, decay: 0.1, sustain: 1, release: 0.08 },
    level: 0.22,
    build: (c, f, start, _end, amp) =>
      [1, 2, 3, 4].map((h, i) => {
        const o = osc(c, 'sine', f * h, start)
        const g = c.ctx.createGain()
        g.gain.value = [1, 0.6, 0.35, 0.2][i]
        o.connect(g).connect(amp)
        return o
      }),
  },
  bell: {
    env: { attack: 0.002, decay: 0.7, sustain: 0, release: 0.6 },
    level: 0.35,
    build: (c, f, start, _end, amp) =>
      [1, 2.76, 5.4].map((ratio, i) => {
        const o = osc(c, 'sine', f * ratio, start)
        const g = c.ctx.createGain()
        g.gain.setValueAtTime([1, 0.4, 0.15][i], start)
        g.gain.setTargetAtTime(0, start, [0.6, 0.25, 0.1][i])
        o.connect(g).connect(amp)
        return o
      }),
  },
  pluck: {
    env: { attack: 0.002, decay: 0.35, sustain: 0, release: 0.15 },
    level: 0.4,
    build: (c, f, start, _end, amp, vel) => {
      const filter = lowpass(c, f * (4 + vel * 8), 1.5)
      filter.frequency.setTargetAtTime(f * 1.5, start + 0.005, 0.12)
      const o = osc(c, 'sawtooth', f, start)
      o.connect(filter).connect(amp)
      return [o]
    },
  },
  guitar: {
    env: { attack: 0.004, decay: 0.6, sustain: 0.75, release: 0.07 },
    level: 0.16,
    build: (c, f, start, _end, amp) => {
      const pre = c.ctx.createGain()
      pre.gain.value = 3
      const shaper = c.ctx.createWaveShaper()
      shaper.curve = getDistortionCurve()
      shaper.oversample = '2x'
      const hp = c.ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 90
      const cab = lowpass(c, 3200, 0.9)
      const a = osc(c, 'sawtooth', f, start, -7)
      const b = osc(c, 'sawtooth', f, start, 7)
      a.connect(pre)
      b.connect(pre)
      pre.connect(shaper).connect(hp).connect(cab).connect(amp)
      return [a, b]
    },
  },
  bass: {
    env: { attack: 0.004, decay: 0.25, sustain: 0.6, release: 0.08 },
    level: 0.5,
    build: (c, f, start, _end, amp, vel) => {
      const filter = lowpass(c, f * (3 + vel * 6), 2)
      filter.frequency.setTargetAtTime(f * 2.5, start + 0.01, 0.12)
      const saw = osc(c, 'sawtooth', f, start)
      const sub = osc(c, 'sine', f, start)
      saw.connect(filter).connect(amp)
      sub.connect(amp)
      return [saw, sub]
    },
  },
  subBass: {
    env: { attack: 0.003, decay: 0.5, sustain: 0.85, release: 0.15 },
    level: 0.7,
    build: (c, f, start, _end, amp) => {
      const o = osc(c, 'sine', f * 2, start)
      o.frequency.setTargetAtTime(f, start, 0.012) // the 808 "punch"
      const drive = c.ctx.createWaveShaper()
      drive.curve = getDistortionCurve()
      const g = c.ctx.createGain()
      g.gain.value = 0.35
      o.connect(g).connect(drive).connect(amp)
      return [o]
    },
  },
  pad: {
    env: { attack: 0.35, decay: 0.8, sustain: 0.85, release: 0.7 },
    level: 0.14,
    build: (c, f, start, _end, amp) => {
      const filter = lowpass(c, Math.min(2200, f * 6), 0.6)
      const oscs = [-9, 0, 9].map((d) => osc(c, 'sawtooth', f, start, d))
      for (const o of oscs) o.connect(filter)
      filter.connect(amp)
      return oscs
    },
  },
  strings: {
    env: { attack: 0.12, decay: 0.6, sustain: 0.9, release: 0.35 },
    level: 0.16,
    build: (c, f, start, _end, amp) => {
      const filter = lowpass(c, Math.min(3000, f * 8), 0.5)
      const oscs = [-6, 6].map((d) => osc(c, 'sawtooth', f, start, d))
      for (const o of oscs) o.connect(filter)
      filter.connect(amp)
      return oscs
    },
  },
  lead: {
    env: { attack: 0.008, decay: 0.3, sustain: 0.75, release: 0.12 },
    level: 0.2,
    build: (c, f, start, _end, amp) => {
      const filter = lowpass(c, Math.min(4500, f * 10), 1)
      const a = osc(c, 'square', f, start)
      const b = osc(c, 'sawtooth', f, start, 5)
      a.connect(filter)
      b.connect(filter)
      filter.connect(amp)
      return [a, b]
    },
  },
  brass: {
    env: { attack: 0.03, decay: 0.4, sustain: 0.8, release: 0.12 },
    level: 0.22,
    build: (c, f, start, _end, amp) => {
      const filter = lowpass(c, f * 1.5, 1)
      filter.frequency.linearRampToValueAtTime(Math.min(5000, f * 8), start + 0.08)
      filter.frequency.setTargetAtTime(f * 4, start + 0.08, 0.3)
      const o = osc(c, 'sawtooth', f, start)
      o.connect(filter).connect(amp)
      return [o]
    },
  },
}

/** Schedules one synth note and returns its voice handle. */
export function playSynthNote(
  ctx: BaseAudioContext,
  out: AudioNode,
  kind: VoiceKind,
  pitch: number,
  velocity: number,
  start: number,
  duration: number,
): Voice {
  const recipe = RECIPES[kind]
  const freq = midiToFreq(pitch)
  const env = recipe.env.sustain === 0 ? { ...recipe.env, decay: pitchDecay(freq, recipe.env.decay) } : recipe.env
  const vel = velocityGain(velocity)

  const amp = ctx.createGain()
  amp.gain.value = 0
  const end = applyEnvelope(amp.gain, start, duration, recipe.level * vel, env)
  const sources = recipe.build({ ctx, out }, freq, start, end, amp, vel)
  const { input, voice } = makeVoice(ctx, out, start, end, sources)
  amp.connect(input)
  return voice
}
