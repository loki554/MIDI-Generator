import type { DrumVoice } from './gm'

/**
 * Drum lanes are written as one character per sixteenth step:
 *   X  hit, accented          x  hit, normal
 *   g  ghost note (only when ghost notes are enabled)
 *   1–9  optional hit with probability n/10, scaled by density
 *   .  rest
 * 4/4 patterns have 16 steps; 3/4 and 6/8 patterns have 12.
 */
export type Lane = string

export interface DrumPattern {
  steps: 16 | 12
  lanes: Partial<Record<DrumVoice, Lane>>
}

export interface StepHit {
  /** Probability 0–1 before density scaling; 1 = always. */
  probability: number
  /** Relative velocity 0–1. */
  velocity: number
  kind: 'fixed' | 'optional' | 'ghost'
}

export const VELOCITY = { accent: 1, normal: 0.8, optional: 0.7, ghost: 0.32 } as const

/** Decodes one lane character; null for a rest. */
export function parseStep(ch: string): StepHit | null {
  if (ch === 'X') return { probability: 1, velocity: VELOCITY.accent, kind: 'fixed' }
  if (ch === 'x') return { probability: 1, velocity: VELOCITY.normal, kind: 'fixed' }
  if (ch === 'g') return { probability: 0.8, velocity: VELOCITY.ghost, kind: 'ghost' }
  if (ch >= '1' && ch <= '9') return { probability: Number(ch) / 10, velocity: VELOCITY.optional, kind: 'optional' }
  return null
}

/**
 * Metric accent for a step: strongest on the downbeat, then beats, then
 * eighths, then sixteenths. `stepsPerBeat` is 4 for x/4 meters, 2 for 6/8 eighths.
 */
export function metricAccent(step: number, stepsPerBeat: number, stepsPerBar: number): number {
  if (step === 0) return 1
  if (stepsPerBar === 12 && stepsPerBeat === 2 && step === 6) return 0.95 // 6/8 secondary downbeat
  if (step % stepsPerBeat === 0) return 0.92
  if (step % 2 === 0) return 0.84
  return 0.76
}

/* ---------- 4/4 grooves ---------- */

export const DRUM_PATTERNS = {
  pop: {
    steps: 16,
    lanes: {
      kick: 'X.....3.X.3...2.',
      snare: 'g...X..g....X..2',
      closedHat: 'X.x.x.x.X.x.x.x.',
      openHat: '..............2.',
      tambourine: '....3.......3...',
    },
  },
  boomBap: {
    steps: 16,
    lanes: {
      kick: 'X......x..X..3..',
      snare: '....X..g.g..X..g',
      closedHat: 'x.x.x.x.x.x.x.x.',
      openHat: '..............3.',
    },
  },
  lofi: {
    steps: 16,
    lanes: {
      kick: 'X......3..x.....',
      rim: '....x.......x...',
      snare: '.......g......g.',
      closedHat: 'x.3.x.3.x.3.x.3.',
      shaker: '..2...2...2...2.',
    },
  },
  house: {
    steps: 16,
    lanes: {
      kick: 'X...X...X...X...',
      clap: '....X.......X...',
      openHat: '..x...x...x...x.',
      closedHat: '.3.2.3.2.3.2.3.2',
      shaker: '3.3.3.3.3.3.3.3.',
    },
  },
  techno: {
    steps: 16,
    lanes: {
      kick: 'X...X...X...X...',
      clap: '....3.......x...',
      closedHat: 'x5x5x5x5x5x5x5x5',
      openHat: '..x...x...x...x.',
      rim: '...3......3..3..',
    },
  },
  dnb: {
    steps: 16,
    lanes: {
      kick: 'X.........x..3..',
      snare: '....X..g.g..X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      ride: '3...3...3...3...',
      openHat: '.......2.......2',
    },
  },
  rock: {
    steps: 16,
    lanes: {
      kick: 'X.....x.X.3...3.',
      snare: '....X......g.X..',
      closedHat: 'X.x.x.x.X.x.x.x.',
      openHat: '..............2.',
    },
  },
  /** Metal: 8th-note double kick with optional 16ths, china on the beat. */
  doubleKick: {
    steps: 16,
    lanes: {
      kick: 'X7x7X7x7X7x7X7x7',
      snare: '....X.......X...',
      ride: 'x.x.x.x.x.x.x.x.',
      china: '3...3...3...3...',
    },
  },
  metalBasic: {
    steps: 16,
    lanes: {
      kick: 'X.x.x.x.X.x.x.x.',
      snare: '....X.......X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      china: '............3...',
    },
  },
  /** Death metal blast beat: kick and snare alternate on 16ths, cymbal on 8ths. */
  blast: {
    steps: 16,
    lanes: {
      kick: 'x.x.x.x.x.x.x.x.',
      snare: '.x.x.x.x.x.x.x.x',
      ride: 'x.x.x.x.x.x.x.x.',
      crash: 'X...............',
    },
  },
  /** Thrash skank beat: kick on the beat, snare on the "and". */
  skank: {
    steps: 16,
    lanes: {
      kick: 'X...x...x...x...',
      snare: '..x...x...x...x.',
      ride: 'x.x.x.x.x.x.x.x.',
      crash: 'X...............',
    },
  },
  /** Gallop: 8th + two 16ths on the kick. */
  gallop: {
    steps: 16,
    lanes: {
      kick: 'X.xxx.xxx.xxx.xx',
      snare: '....X.......X...',
      closedHat: 'x.x.x.x.x.x.x.x.',
      china: '3.......3.......',
    },
  },
  stoner: {
    steps: 16,
    lanes: {
      kick: 'X.....x...x..3..',
      snare: '....X.......X..g',
      ride: 'x.x.x.x.x.x.x.x.',
      rideBell: '3.......3.......',
    },
  },
  /** Doom: half-time feel, snare on 3, heavy crashes. */
  doom: {
    steps: 16,
    lanes: {
      kick: 'X.......3.....3.',
      snare: '........X.......',
      crash: 'x.......3.......',
      ride: '..3...3...3...3.',
      tomLow: '..............3.',
    },
  },
  jazzSwing: {
    steps: 16,
    lanes: {
      ride: 'X...x.x.X...x.x.',
      pedalHat: '....x.......x...',
      kick: 'g...g...g...g...',
      snare: '......2...3...2.',
    },
  },
  funk: {
    steps: 16,
    lanes: {
      kick: 'X..x..x...X..3..',
      snare: '....X..g.g..X..g',
      closedHat: 'x3x3x3x3x3x3x3x3',
      openHat: '.......3........',
    },
  },
  ambient: {
    steps: 16,
    lanes: {
      kick: 'X.......3.......',
      rim: '........3.......',
      shaker: '..3...3...3...3.',
      ride: '3...............',
    },
  },

  /* ---------- 3/4 and 6/8 ---------- */

  waltz: {
    steps: 12,
    lanes: {
      kick: 'X.......3...',
      snare: '....x...x...',
      closedHat: 'x.x.x.x.x.x.',
    },
  },
  jazzWaltz: {
    steps: 12,
    lanes: {
      ride: 'X...x.x.x...',
      pedalHat: '....x...x...',
      kick: 'g...........',
      snare: '......2...2.',
    },
  },
  sixEight: {
    steps: 12,
    lanes: {
      kick: 'X.....3...3.',
      snare: '......X.....',
      closedHat: 'x.x.x.x.x.x.',
    },
  },
  sixEightElectronic: {
    steps: 12,
    lanes: {
      kick: 'X.....X.....',
      clap: '......X.....',
      closedHat: '..x.x...x.x.',
      shaker: 'x3x3x3x3x3x3',
    },
  },
  sixEightMetal: {
    steps: 12,
    lanes: {
      kick: 'x7x7x7x7x7x7',
      snare: '......X.....',
      china: 'x.....x.....',
      ride: '..x.x...x.x.',
    },
  },
} as const satisfies Record<string, DrumPattern>

export type DrumPatternId = keyof typeof DRUM_PATTERNS

/* ---------- Fills ---------- */

export interface DrumFill {
  /** Length in sixteenth steps, placed at the end of the bar. */
  length: number
  /** [voice, step offset inside the fill, relative velocity] */
  hits: ReadonlyArray<readonly [DrumVoice, number, number]>
  /** Keep the kick lane under the fill (e.g. metal double kick). */
  keepKick?: boolean
}

export const DRUM_FILLS = {
  snareRoll: {
    length: 4,
    hits: [
      ['snare', 0, 0.6],
      ['snare', 1, 0.7],
      ['snare', 2, 0.8],
      ['snare', 3, 0.95],
    ],
  },
  snareBuild: {
    length: 8,
    hits: [0, 1, 2, 3, 4, 5, 6, 7].map((s) => ['snare', s, 0.45 + s * 0.07] as const),
  },
  tomsDown: {
    length: 8,
    hits: [
      ['snare', 0, 0.85],
      ['snare', 1, 0.6],
      ['tomHigh', 2, 0.85],
      ['tomHigh', 3, 0.7],
      ['tomMid', 4, 0.85],
      ['tomMid', 5, 0.7],
      ['tomLow', 6, 0.9],
      ['tomLow', 7, 0.95],
    ],
  },
  tomsShort: {
    length: 4,
    hits: [
      ['tomHigh', 0, 0.85],
      ['tomMid', 1, 0.8],
      ['tomLow', 2, 0.9],
      ['kick', 3, 0.9],
    ],
  },
  metalTriplets: {
    length: 8,
    keepKick: true,
    hits: [
      ['snare', 0, 0.9],
      ['tomHigh', 1, 0.8],
      ['tomHigh', 2, 0.8],
      ['tomMid', 3, 0.85],
      ['tomMid', 4, 0.85],
      ['tomLow', 5, 0.9],
      ['tomLow', 6, 0.9],
      ['snare', 7, 1],
    ],
  },
  jazzFill: {
    length: 4,
    hits: [
      ['snare', 0, 0.55],
      ['snare', 2, 0.7],
      ['tomLow', 3, 0.75],
    ],
  },
  electronicRiser: {
    length: 8,
    hits: [
      ['clap', 4, 0.6],
      ['clap', 5, 0.7],
      ['clap', 6, 0.85],
      ['clap', 7, 1],
      ['snare', 0, 0.5],
      ['snare', 2, 0.6],
      ['snare', 4, 0.7],
      ['snare', 6, 0.8],
    ],
  },
} as const satisfies Record<string, DrumFill>

export type DrumFillId = keyof typeof DRUM_FILLS
