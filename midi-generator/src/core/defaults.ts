import type { GenSettings } from './types'

export const LIMITS = {
  bpm: { min: 40, max: 240 },
  bars: { min: 1, max: 32 },
  octave: { min: 0, max: 8 },
} as const

export function createDefaultSettings(seed = 1): GenSettings {
  return {
    global: {
      mode: 'multi',
      singlePart: 'chords',
      genre: 'pop',
      mood: 'happy',
      key: 0,
      scale: 'auto',
      bpm: 120,
      timeSignature: { numerator: 4, denominator: 4 },
      bars: 8,
      swing: 0,
      complexity: 0.5,
      humanize: 0.2,
      seed,
      seedLocked: false,
      progression: 'auto',
      chordsPerBar: 'auto',
    },
    parts: {
      drums: {
        enabled: true,
        program: 'auto',
        density: 0.5,
        fillEvery: 4,
        ghostNotes: true,
        hihatRolls: false,
        crashOnSection: true,
      },
      bass: { enabled: true, program: 'auto', style: 'auto', octave: 2, approachNotes: true },
      chords: {
        enabled: true,
        program: 'auto',
        extension: 'auto',
        rhythm: 'auto',
        octave: 4,
        voiceLeading: true,
      },
      melody: {
        enabled: true,
        program: 'auto',
        density: 0.5,
        octave: 5,
        range: 12,
        structure: 'auto',
        repetition: 0.6,
      },
      arp: { enabled: false, program: 'auto', pattern: 'up', rate: '1/16', octaves: 2, octave: 4 },
      pad: { enabled: false, program: 'auto', extension: 'auto', octave: 4 },
      riff: {
        enabled: false,
        program: 'auto',
        style: 'auto',
        palmMute: 0.6,
        chromaticism: 0.2,
        octave: 2,
      },
    },
  }
}
