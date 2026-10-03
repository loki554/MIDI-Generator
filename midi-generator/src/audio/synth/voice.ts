/** A sounding note: can be cut early (e.g. on transport stop) without clicks. */
export interface Voice {
  /** Audio time the voice starts. */
  start: number
  /** Audio time after which the voice is silent and can be forgotten. */
  end: number
  /** Fades out quickly from `time` and frees the nodes. */
  stop: (time: number) => void
}

export const midiToFreq = (pitch: number) => 440 * 2 ** ((pitch - 69) / 12)

/** Perceptual velocity curve 0–127 → gain 0–1. */
export const velocityGain = (velocity: number) => (Math.max(1, Math.min(127, velocity)) / 127) ** 1.6

/**
 * Wraps a voice's output in a "kill" gain so it can be faded out at any moment
 * without fighting the envelope automation, then stops its sources.
 */
export function makeVoice(
  ctx: BaseAudioContext,
  out: AudioNode,
  start: number,
  end: number,
  sources: AudioScheduledSourceNode[],
): { input: GainNode; voice: Voice } {
  const kill = ctx.createGain()
  kill.connect(out)
  for (const s of sources) s.stop(end)
  sources[0]?.addEventListener('ended', () => kill.disconnect())
  const voice: Voice = {
    start,
    end,
    stop(time) {
      const t = Math.max(time, ctx.currentTime)
      kill.gain.cancelScheduledValues(t)
      kill.gain.setValueAtTime(kill.gain.value, t)
      kill.gain.setTargetAtTime(0, t, 0.008)
      for (const s of sources) {
        try {
          s.stop(t + 0.06)
        } catch {
          // already stopped
        }
      }
      voice.end = Math.min(voice.end, t + 0.06)
    },
  }
  return { input: kill, voice }
}

export interface Envelope {
  attack: number
  /** Time constant of the decay towards the sustain level. */
  decay: number
  sustain: number
  release: number
}

/**
 * Schedules an ADSR on a gain param for a note held `duration` seconds.
 * Starts from silence and ends at silence, so there are no clicks.
 * Returns the time at which the release has died away.
 */
export function applyEnvelope(param: AudioParam, start: number, duration: number, peak: number, env: Envelope): number {
  const attackEnd = start + Math.max(0.002, env.attack)
  const releaseStart = Math.max(attackEnd, start + duration)
  param.setValueAtTime(0, start)
  param.linearRampToValueAtTime(peak, attackEnd)
  param.setTargetAtTime(peak * env.sustain, attackEnd, Math.max(0.005, env.decay))
  param.setTargetAtTime(0, releaseStart, Math.max(0.005, env.release / 4))
  return releaseStart + env.release * 1.5
}
