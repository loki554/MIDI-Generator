/** Synthesized drum kit addressed by General MIDI percussion note numbers. */
import { makeVoice, velocityGain, type Voice } from './voice'

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>()

function noise(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseBuffers.get(ctx)
  if (!buf) {
    buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const data = buf.getChannelData(0)
    // Deterministic noise so renders are reproducible.
    let seed = 12345
    for (let i = 0; i < data.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0
      data[i] = seed / 2147483648 - 1
    }
    noiseBuffers.set(ctx, buf)
  }
  return buf
}

type Kind = 'kick' | 'snare' | 'clap' | 'rim' | 'closedHat' | 'pedalHat' | 'openHat' | 'ride' | 'rideBell' | 'crash' | 'china' | 'tom' | 'shaker' | 'cowbell' | 'perc'

function kindFor(note: number): Kind {
  switch (note) {
    case 35:
    case 36:
      return 'kick'
    case 38:
    case 40:
      return 'snare'
    case 39:
      return 'clap'
    case 37:
      return 'rim'
    case 42:
      return 'closedHat'
    case 44:
      return 'pedalHat'
    case 46:
      return 'openHat'
    case 51:
    case 59:
      return 'ride'
    case 53:
      return 'rideBell'
    case 49:
    case 55:
    case 57:
      return 'crash'
    case 52:
      return 'china'
    case 41:
    case 43:
    case 45:
    case 47:
    case 48:
    case 50:
      return 'tom'
    case 54:
    case 69:
    case 70:
      return 'shaker'
    case 56:
      return 'cowbell'
    default:
      return 'perc'
  }
}

/** Open hi-hats are choked by the next closed or pedal hat, per output bus. */
const openHats = new WeakMap<AudioNode, Voice>()

interface Built {
  sources: AudioScheduledSourceNode[]
  length: number
}

function noiseHit(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  opts: { type: BiquadFilterType; freq: number; q?: number; decay: number; level: number },
): Built {
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const filter = ctx.createBiquadFilter()
  filter.type = opts.type
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q ?? 0.7
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(opts.level, t + 0.001)
  g.gain.setTargetAtTime(0, t + 0.001, opts.decay)
  src.connect(filter).connect(g).connect(dest)
  // Vary the read position by start time so repeated hits don't sound identical, deterministically.
  src.start(t, (t * 7.31) % 1.5)
  return { sources: [src], length: opts.decay * 6 }
}

function toneHit(
  ctx: BaseAudioContext,
  dest: AudioNode,
  t: number,
  opts: { type?: OscillatorType; from: number; to: number; sweep: number; decay: number; level: number },
): Built {
  const o = ctx.createOscillator()
  o.type = opts.type ?? 'sine'
  o.frequency.setValueAtTime(opts.from, t)
  o.frequency.exponentialRampToValueAtTime(opts.to, t + opts.sweep)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(opts.level, t + 0.002)
  g.gain.setTargetAtTime(0, t + 0.002, opts.decay)
  o.connect(g).connect(dest)
  o.start(t)
  return { sources: [o], length: opts.decay * 6 }
}

function merge(...parts: Built[]): Built {
  return { sources: parts.flatMap((p) => p.sources), length: Math.max(...parts.map((p) => p.length)) }
}

const TOM_FREQ: Record<number, number> = { 41: 82, 43: 98, 45: 110, 47: 131, 48: 147, 50: 175 }

/** Schedules a drum hit for GM percussion note `note`. */
export function playDrum(ctx: BaseAudioContext, out: AudioNode, note: number, velocity: number, t: number): Voice {
  const kind = kindFor(note)
  const level = velocityGain(velocity)
  const bus = ctx.createGain()
  let built: Built

  switch (kind) {
    case 'kick':
      built = merge(
        toneHit(ctx, bus, t, { from: 160, to: 45, sweep: 0.08, decay: 0.12, level: level * 0.9 }),
        noiseHit(ctx, bus, t, { type: 'lowpass', freq: 3000, decay: 0.004, level: level * 0.25 }),
      )
      break
    case 'snare':
      built = merge(
        toneHit(ctx, bus, t, { type: 'triangle', from: 240, to: 170, sweep: 0.03, decay: 0.05, level: level * 0.45 }),
        noiseHit(ctx, bus, t, { type: 'highpass', freq: 1400, decay: 0.06, level: level * 0.6 }),
      )
      break
    case 'clap':
      built = merge(
        ...[0, 0.011, 0.022].map((d) => noiseHit(ctx, bus, t + d, { type: 'bandpass', freq: 1200, q: 1.2, decay: 0.012, level: level * 0.7 })),
        noiseHit(ctx, bus, t + 0.03, { type: 'bandpass', freq: 1100, q: 1, decay: 0.08, level: level * 0.55 }),
      )
      break
    case 'rim':
      built = toneHit(ctx, bus, t, { type: 'square', from: 1700, to: 1600, sweep: 0.01, decay: 0.012, level: level * 0.25 })
      break
    case 'closedHat':
    case 'pedalHat':
      openHats.get(out)?.stop(t)
      openHats.delete(out)
      built = noiseHit(ctx, bus, t, { type: 'highpass', freq: 7500, decay: kind === 'pedalHat' ? 0.018 : 0.03, level: level * 0.35 })
      break
    case 'openHat':
      built = noiseHit(ctx, bus, t, { type: 'highpass', freq: 7000, decay: 0.18, level: level * 0.3 })
      break
    case 'ride':
      built = merge(
        noiseHit(ctx, bus, t, { type: 'highpass', freq: 6000, decay: 0.35, level: level * 0.12 }),
        toneHit(ctx, bus, t, { type: 'square', from: 3200, to: 3150, sweep: 0.2, decay: 0.25, level: level * 0.03 }),
      )
      break
    case 'rideBell':
      built = toneHit(ctx, bus, t, { type: 'square', from: 2400, to: 2380, sweep: 0.2, decay: 0.3, level: level * 0.08 })
      break
    case 'crash':
      built = noiseHit(ctx, bus, t, { type: 'highpass', freq: 4500, decay: 0.55, level: level * 0.28 })
      break
    case 'china':
      built = noiseHit(ctx, bus, t, { type: 'bandpass', freq: 3500, q: 0.8, decay: 0.45, level: level * 0.4 })
      break
    case 'tom': {
      const f = TOM_FREQ[note] ?? 120
      built = toneHit(ctx, bus, t, { from: f * 1.6, to: f, sweep: 0.06, decay: 0.12, level: level * 0.8 })
      break
    }
    case 'shaker':
      built = noiseHit(ctx, bus, t, { type: 'highpass', freq: 5500, decay: 0.03, level: level * 0.2 })
      break
    case 'cowbell':
      built = merge(
        toneHit(ctx, bus, t, { type: 'square', from: 540, to: 540, sweep: 0.01, decay: 0.08, level: level * 0.12 }),
        toneHit(ctx, bus, t, { type: 'square', from: 800, to: 800, sweep: 0.01, decay: 0.08, level: level * 0.12 }),
      )
      break
    default:
      built = toneHit(ctx, bus, t, { from: 900, to: 700, sweep: 0.02, decay: 0.03, level: level * 0.3 })
  }

  const end = t + built.length + 0.05
  const { input, voice } = makeVoice(ctx, out, t, end, built.sources)
  bus.connect(input)
  if (kind === 'openHat') openHats.set(out, voice)
  return voice
}
