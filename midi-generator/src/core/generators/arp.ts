import type { Rng } from '../random'
import { chordPitchClasses, extendChord } from '../theory/chords'
import { midiOf, nearestWithPitchClass, pitchClass } from '../theory/notes'
import { PPQ, type ArpPattern, type ArpRate, type ArpSettings, type Chord, type ChordExtension } from '../types'
import { eventAt, type GenContext, type NoteDraft, velocity } from './context'

export const ARP_RATE_TICKS: Record<ArpRate, number> = {
  '1/8': PPQ / 2,
  '1/8t': PPQ / 3,
  '1/16': PPQ / 4,
  '1/16t': PPQ / 6,
  '1/32': PPQ / 8,
}

/** Ascending chord tones from the root nearest `base`, spanning `octaves`. */
export function arpTones(chord: Chord, base: number, octaves: number): number[] {
  const root = nearestWithPitchClass(chord.root, base)
  const pcs = chordPitchClasses(chord)
  const oneOctave: number[] = []
  for (let m = root; m < root + 12; m++) if (pcs.includes(pitchClass(m))) oneOctave.push(m)
  const tones: number[] = []
  for (let o = 0; o < octaves; o++) tones.push(...oneOctave.map((m) => m + 12 * o))
  tones.push(root + 12 * octaves) // top root closes the shape
  return tones
}

/** Orders tones for one arpeggio cycle. */
export function arpSequence(tones: readonly number[], pattern: ArpPattern, rng: Rng): number[] {
  switch (pattern) {
    case 'down':
      return [...tones].reverse()
    case 'upDown':
      return tones.length > 2 ? [...tones, ...tones.slice(1, -1).reverse()] : [...tones]
    case 'random':
      return rng.shuffle(tones)
    case 'converge': {
      const out: number[] = []
      let lo = 0
      let hi = tones.length - 1
      while (lo <= hi) {
        out.push(tones[lo++])
        if (lo <= hi) out.push(tones[hi--])
      }
      return out
    }
    default:
      return [...tones]
  }
}

export function generateArp(ctx: GenContext, part: ArpSettings, rng: Rng): NoteDraft[] {
  const { style } = ctx
  const rate = ARP_RATE_TICKS[part.rate]
  const base = midiOf(ctx.key, part.octave + style.register)
  // Power chords make dull arpeggios; plain triads get a seventh at high complexity.
  const extension: ChordExtension =
    style.extension === 'power'
      ? 'triad'
      : style.extension === 'triad' && ctx.settings.global.complexity > 0.6
        ? 'seventh'
        : style.extension
  const gate = Math.min(0.95, 0.75 * style.legato)
  const notes: NoteDraft[] = []

  let currentEvent = null as ReturnType<typeof eventAt> | null
  let sequence: number[] = []
  let index = 0
  for (let t = 0; t < ctx.totalTicks; t += rate) {
    const event = eventAt(ctx, t)
    if (event !== currentEvent) {
      // Restart the pattern on every chord change so it follows the harmony.
      currentEvent = event
      const chord = extendChord(event.chord, extension, ctx.key, ctx.scale)
      sequence = arpSequence(arpTones(chord, base, part.octaves), part.pattern, rng)
      index = 0
    }
    if (part.pattern === 'random' && index > 0 && index % sequence.length === 0) {
      sequence = rng.shuffle(sequence)
    }
    const onBeat = t % ctx.beatTicks === 0
    notes.push({
      pitch: sequence[index % sequence.length],
      start: t,
      duration: Math.max(20, Math.round(rate * gate)),
      velocity: velocity(ctx, onBeat ? 0.78 : 0.62),
    })
    index++
  }
  return notes
}
