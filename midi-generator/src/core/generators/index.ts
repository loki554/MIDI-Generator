/**
 * Orchestrator: settings → style → shared harmony → one track per part.
 * Every step is seeded, so the same settings always yield the same project.
 */
import { DRUM_CHANNEL, defaultProgram } from '../presets/gm'
import { resolveStyle } from '../presets/style'
import { createRng, deriveSeed, type Rng } from '../random'
import { PART_TYPES, PROJECT_VERSION, type GenSettings, type Note, type PartType, type Project, type Track } from '../types'
import { generateArp } from './arp'
import { generateBass } from './bass'
import { generateChords } from './chords'
import { createContext, type GenContext, type NoteDraft } from './context'
import { generateDrums } from './drums'
import { buildHarmony } from './harmony'
import { applySwing, finalizeNotes, humanize } from './humanize'
import { generateMelody } from './melody'
import { generatePad } from './pad'
import { generateRiff } from './riff'

export type { GenContext, NoteDraft } from './context'

/** Parts to generate: the chosen one in single mode, the enabled ones in multitrack mode. */
export function partsToGenerate(settings: GenSettings): PartType[] {
  if (settings.global.mode === 'single') return [settings.global.singlePart]
  return PART_TYPES.filter((p) => settings.parts[p].enabled)
}

/** Seed of a part's track; `variant` > 0 for regenerations. */
export function partSeed(seed: number, part: PartType, variant = 0): number {
  return deriveSeed(seed, part, variant)
}

/** Raw notes of one part, before swing/humanize/cleanup. */
function generatePartNotes(ctx: GenContext, part: PartType, rng: Rng, riff?: readonly NoteDraft[]): NoteDraft[] {
  const parts = ctx.settings.parts
  switch (part) {
    case 'drums':
      return generateDrums(ctx, parts.drums, rng)
    case 'bass': {
      // A riff-doubling bass needs a riff; make one if the riff part is off.
      const source =
        ctx.style.bassStyle === 'riff' && !riff ? generateRiff(ctx, parts.riff, rng.fork('riffSource')) : riff
      return generateBass(ctx, parts.bass, rng, source)
    }
    case 'chords':
      return generateChords(ctx, parts.chords, rng)
    case 'melody':
      return generateMelody(ctx, parts.melody, rng)
    case 'arp':
      return generateArp(ctx, parts.arp, rng)
    case 'pad':
      return generatePad(ctx, parts.pad)
    case 'riff':
      return generateRiff(ctx, parts.riff, rng)
  }
}

/** Swing, humanize and cleanup. Pads are left unhumanized to keep their ties. */
function postProcess(ctx: GenContext, part: PartType, notes: NoteDraft[], rng: Rng): NoteDraft[] {
  const g = ctx.settings.global
  let out = applySwing(notes, g.swing, ctx.style.swingGrid)
  if (part !== 'pad') out = humanize(out, g.humanize, rng.fork('humanize'))
  return finalizeNotes(out, ctx.totalTicks)
}

function toNotes(drafts: readonly NoteDraft[], part: PartType, seed: number): Note[] {
  const prefix = `${part}-${seed.toString(36)}`
  return drafts.map((d, i) => ({ id: `${prefix}-${i}`, ...d }))
}

function channelFor(part: PartType): number {
  if (part === 'drums') return DRUM_CHANNEL
  // Melodic parts take channels in PART_TYPES order, skipping channel 10.
  const index = PART_TYPES.filter((p) => p !== 'drums').indexOf(part)
  return index >= DRUM_CHANNEL ? index + 1 : index
}

function makeTrack(ctx: GenContext, part: PartType, notes: Note[], seed: number): Track {
  const { program } = ctx.settings.parts[part]
  return {
    id: part,
    partType: part,
    name: part,
    program: program === 'auto' ? defaultProgram(part, ctx.settings.global.genre) : program,
    channel: channelFor(part),
    color: `var(--part-${part})`,
    muted: false,
    solo: false,
    volume: 0.8,
    notes,
    seed,
  }
}

/** Order that lets the bass double an already generated riff. */
const GENERATION_ORDER: readonly PartType[] = ['drums', 'riff', 'chords', 'pad', 'arp', 'melody', 'bass']

function buildContext(settings: GenSettings): GenContext {
  const rng = createRng(settings.global.seed)
  const style = resolveStyle(settings, rng.fork('style'))
  const g = settings.global
  const harmony = buildHarmony({ key: g.key, ts: g.timeSignature, bars: g.bars, style }, rng.fork('harmony'))
  return createContext(settings, style, harmony)
}

export interface GenerateOptions {
  id?: string
  /** Defaults to Date.now(); pass a value for reproducible output. */
  createdAt?: number
}

export function generateProject(settings: GenSettings, opts: GenerateOptions = {}): Project {
  const ctx = buildContext(settings)
  const seed = settings.global.seed
  const wanted = new Set(partsToGenerate(settings))
  const raw = new Map<PartType, NoteDraft[]>()

  for (const part of GENERATION_ORDER) {
    if (!wanted.has(part)) continue
    raw.set(part, generatePartNotes(ctx, part, createRng(partSeed(seed, part)), raw.get('riff')))
  }

  const tracks = PART_TYPES.filter((p) => wanted.has(p)).map((part) => {
    const trackSeed = partSeed(seed, part)
    const notes = postProcess(ctx, part, raw.get(part)!, createRng(trackSeed))
    return makeTrack(ctx, part, toNotes(notes, part, trackSeed), trackSeed)
  })

  const createdAt = opts.createdAt ?? Date.now()
  return {
    version: PROJECT_VERSION,
    id: opts.id ?? `p-${seed.toString(36)}-${createdAt.toString(36)}`,
    createdAt,
    bpm: settings.global.bpm,
    timeSignature: { ...settings.global.timeSignature },
    bars: settings.global.bars,
    key: settings.global.key,
    scale: ctx.style.scale,
    harmony: ctx.harmony,
    tracks,
    settings: structuredClone(settings),
  }
}

/**
 * Regenerates one part with a new seed over the project's existing harmony;
 * every other track is left untouched. Mixer state (mute, solo, volume,
 * program) of the replaced track is kept. Adds the track if it didn't exist.
 */
export function regeneratePart(project: Project, part: PartType, seed: number): Project {
  const settings = project.settings
  const rng = createRng(settings.global.seed)
  const style = resolveStyle(settings, rng.fork('style'))
  const ctx = createContext(settings, style, project.harmony)

  // A riff-doubling bass follows the riff's raw (unswung) notes, rebuilt from its seed.
  const riffTrack = project.tracks.find((t) => t.partType === 'riff')
  const riff =
    part === 'bass' && riffTrack ? generatePartNotes(ctx, 'riff', createRng(riffTrack.seed)) : undefined
  const raw = generatePartNotes(ctx, part, createRng(seed), riff)
  const notes = toNotes(postProcess(ctx, part, raw, createRng(seed)), part, seed)

  const existing = project.tracks.find((t) => t.partType === part)
  const track: Track = existing ? { ...existing, notes, seed } : makeTrack(ctx, part, notes, seed)
  const tracks = existing
    ? project.tracks.map((t) => (t === existing ? track : t))
    : PART_TYPES.flatMap((p) => (p === part ? [track] : project.tracks.filter((t) => t.partType === p)))
  return { ...project, tracks }
}
