import { DRUM_FILLS, DRUM_PATTERNS, type DrumFillId, metricAccent, parseStep } from '../presets/drumPatterns'
import { DRUM_NOTES, type DrumVoice } from '../presets/gm'
import type { Rng } from '../random'
import type { DrumSettings } from '../types'
import { type GenContext, type NoteDraft } from './context'

interface DrumHit {
  voice: DrumVoice
  step: number
  /** Relative velocity 0–1. */
  level: number
  /** Optional hits can be re-rolled in variation bars. */
  optional: boolean
  ghost?: boolean
}

const CYMBALS: ReadonlySet<DrumVoice> = new Set(['closedHat', 'openHat', 'pedalHat', 'ride', 'rideBell', 'china'])

/** Rolls one bar of the pattern: fixed hits always, optional/ghost hits by probability. */
function sampleBar(ctx: GenContext, part: DrumSettings, rng: Rng): DrumHit[] {
  const pattern = DRUM_PATTERNS[ctx.style.drumPattern]
  const hits: DrumHit[] = []
  const densityScale = 0.4 + 1.2 * part.density
  for (const [voice, lane] of Object.entries(pattern.lanes) as Array<[DrumVoice, string]>) {
    for (let step = 0; step < ctx.stepsPerBar; step++) {
      const hit = parseStep(lane[step % lane.length])
      if (!hit) continue
      let p = hit.probability
      if (hit.kind === 'optional') p = Math.min(1, p * densityScale)
      if (hit.kind === 'ghost') {
        if (!part.ghostNotes) continue
        p = Math.min(1, p * (0.5 + part.density))
      }
      if (hit.kind !== 'fixed' && !rng.chance(p)) continue
      hits.push({ voice, step, level: hit.velocity, optional: hit.kind !== 'fixed', ghost: hit.kind === 'ghost' })
    }
  }
  return hits
}

/** A bar based on `base` with ~15% of optional hits re-rolled. */
function varyBar(ctx: GenContext, part: DrumSettings, base: DrumHit[], rng: Rng): DrumHit[] {
  const fresh = sampleBar(ctx, part, rng)
  const kept = base.filter((h) => !h.optional || !rng.chance(0.15))
  const added = fresh.filter((h) => h.optional && rng.chance(0.15) && !kept.some((k) => k.voice === h.voice && k.step === h.step))
  return [...kept, ...added]
}

function applyFill(ctx: GenContext, hits: DrumHit[], fillId: DrumFillId): DrumHit[] {
  const fill = DRUM_FILLS[fillId]
  const length = Math.min(fill.length, Math.floor(ctx.stepsPerBar / 2))
  const from = ctx.stepsPerBar - length
  const kept = hits.filter((h) => h.step < from || (h.voice === 'kick' && 'keepKick' in fill && fill.keepKick))
  const offset = fill.length - length
  for (const [voice, step, level] of fill.hits) {
    if (step < offset) continue
    kept.push({ voice, step: from + step - offset, level, optional: false })
  }
  return kept
}

export function generateDrums(ctx: GenContext, part: DrumSettings, rng: Rng): NoteDraft[] {
  const groove = sampleBar(ctx, part, rng.fork('A'))
  const turnaround = varyBar(ctx, part, groove, rng.fork('B'))
  const stepsPerBeat = ctx.pulseSteps === 6 ? 2 : ctx.pulseSteps
  const complexity = ctx.settings.global.complexity
  const [velLo, velHi] = ctx.style.velocity
  const lo = Math.max(30, velLo - 10)
  const notes: NoteDraft[] = []

  for (let bar = 0; bar < ctx.bars; bar++) {
    const barRng = rng.fork('bar', bar)
    let hits = bar % 4 === 3 ? turnaround : bar === 0 ? groove : varyBar(ctx, part, groove, barRng)

    const isFillBar = part.fillEvery > 0 && ctx.bars > 1 && (bar + 1) % part.fillEvery === 0
    if (isFillBar) {
      let fillId = barRng.weightedKey(ctx.style.fills)
      if (complexity < 0.35 && DRUM_FILLS[fillId].length > 4) fillId = 'snareRoll'
      hits = applyFill(ctx, hits, fillId)
    }

    const sectionStart = bar === 0 || (part.fillEvery > 0 && bar % part.fillEvery === 0)
    if (part.crashOnSection && sectionStart) {
      hits = hits.filter((h) => !(h.step === 0 && (h.voice === 'closedHat' || h.voice === 'crash')))
      hits.push({ voice: 'crash', step: 0, level: 1, optional: false })
    }

    const barStart = bar * ctx.barTicks
    for (const hit of hits) {
      const accent = metricAccent(hit.step, stepsPerBeat, ctx.stepsPerBar)
      const level = hit.level * accent
      const start = barStart + hit.step * ctx.stepTicks
      // Ghost notes stay quiet whatever the mood's dynamics are.
      const vel = hit.ghost ? Math.round(22 + 20 * accent) : Math.round(lo + (velHi - lo) * level)

      // Hi-hat rolls: split a closed-hat eighth into a 32nd or triplet burst.
      if (part.hihatRolls && hit.voice === 'closedHat' && hit.step % 4 === 2 && barRng.chance(0.18)) {
        const count = barRng.pick([3, 4])
        const span = ctx.stepTicks * 2
        for (let k = 0; k < count; k++) {
          notes.push({
            pitch: DRUM_NOTES.closedHat,
            start: start + Math.round((k * span) / count),
            duration: Math.round(span / count / 2),
            velocity: Math.min(127, Math.round(vel * (0.65 + (0.35 * k) / count))),
          })
        }
        continue
      }

      notes.push({
        pitch: DRUM_NOTES[hit.voice],
        start,
        duration: CYMBALS.has(hit.voice) && hit.voice !== 'closedHat' ? ctx.stepTicks : ctx.stepTicks / 2,
        velocity: Math.min(127, Math.max(1, vel)),
      })
    }
  }
  return notes
}
