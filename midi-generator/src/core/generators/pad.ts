import { extendChord, voiceLead } from '../theory/chords'
import { midiOf } from '../theory/notes'
import type { PadSettings } from '../types'
import { type GenContext, type NoteDraft, velocity } from './context'

/**
 * Long chords in a high register. Notes shared by consecutive chords are tied
 * instead of re-struck, so the pad flows smoothly from chord to chord.
 */
export function generatePad(ctx: GenContext, part: PadSettings): NoteDraft[] {
  const center = midiOf(0, part.octave + ctx.style.register) + 9
  const notes: NoteDraft[] = []
  let previous: number[] | null = null
  let sounding = new Map<number, NoteDraft>()

  for (const event of ctx.harmony) {
    const chord = extendChord(event.chord, ctx.style.padExtension === 'power' ? 'sus2' : ctx.style.padExtension, ctx.key, ctx.scale)
    const voicing = voiceLead(previous, chord, { low: center - 8, high: center + 12, center, maxVoices: 5 })
    const next = new Map<number, NoteDraft>()
    for (const pitch of voicing) {
      const held = sounding.get(pitch)
      if (held && held.start + held.duration === event.start) {
        held.duration += event.duration
        next.set(pitch, held)
      } else {
        const note = { pitch, start: event.start, duration: event.duration, velocity: velocity(ctx, 0.5) }
        notes.push(note)
        next.set(pitch, note)
      }
    }
    sounding = next
    previous = voicing
  }
  return notes
}
