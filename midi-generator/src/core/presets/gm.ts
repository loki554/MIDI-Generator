import type { Genre, PartType } from '../types'

/* ---------- Melodic programs ---------- */

export const GM_FAMILIES = [
  'piano',
  'chromaticPercussion',
  'organ',
  'guitar',
  'bass',
  'strings',
  'ensemble',
  'brass',
  'reed',
  'pipe',
  'synthLead',
  'synthPad',
  'synthEffects',
  'ethnic',
  'percussive',
  'soundEffects',
] as const
export type GmFamily = (typeof GM_FAMILIES)[number]

/** Standard General MIDI Level 1 program names, index = program number (0–127). */
export const GM_PROGRAM_NAMES = [
  // Piano
  'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
  'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
  // Chromatic percussion
  'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
  // Organ
  'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica',
  'Tango Accordion',
  // Guitar
  'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
  'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
  // Bass
  'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass', 'Slap Bass 1', 'Slap Bass 2',
  'Synth Bass 1', 'Synth Bass 2',
  // Strings
  'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
  // Ensemble
  'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2', 'Choir Aahs', 'Voice Oohs',
  'Synth Voice', 'Orchestra Hit',
  // Brass
  'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
  // Reed
  'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
  // Pipe
  'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
  // Synth lead
  'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)',
  'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
  // Synth pad
  'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)',
  'Pad 7 (halo)', 'Pad 8 (sweep)',
  // Synth effects
  'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)',
  'FX 7 (echoes)', 'FX 8 (sci-fi)',
  // Ethnic
  'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
  // Percussive
  'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
  // Sound effects
  'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause',
  'Gunshot',
] as const

export interface GmProgram {
  program: number
  name: string
  family: GmFamily
}

export const GM_PROGRAMS: readonly GmProgram[] = GM_PROGRAM_NAMES.map((name, program) => ({
  program,
  name,
  family: GM_FAMILIES[Math.floor(program / 8)],
}))

/** Programs grouped by family, in GM order; handy for a grouped instrument select. */
export function gmProgramsByFamily(): Array<{ family: GmFamily; programs: GmProgram[] }> {
  return GM_FAMILIES.map((family) => ({ family, programs: GM_PROGRAMS.filter((p) => p.family === family) }))
}

/* ---------- Drums (channel 10) ---------- */

export const DRUM_CHANNEL = 9

/** Drum voices used by the generators, mapped to GM percussion notes. */
export const DRUM_NOTES = {
  kick: 36,
  kick2: 35,
  rim: 37,
  snare: 38,
  clap: 39,
  snare2: 40,
  tomLow: 41,
  closedHat: 42,
  tomLowMid: 43,
  pedalHat: 44,
  tomMid: 45,
  openHat: 46,
  tomHighMid: 47,
  tomHigh: 48,
  crash: 49,
  tomHighest: 50,
  ride: 51,
  china: 52,
  rideBell: 53,
  tambourine: 54,
  splash: 55,
  cowbell: 56,
  crash2: 57,
  shaker: 70,
} as const
export type DrumVoice = keyof typeof DRUM_NOTES

/** GM percussion key map 35–81: names for drum-roll rows. */
export const GM_DRUM_NAMES: Readonly<Record<number, string>> = {
  35: 'Acoustic Bass Drum',
  36: 'Bass Drum 1',
  37: 'Side Stick',
  38: 'Acoustic Snare',
  39: 'Hand Clap',
  40: 'Electric Snare',
  41: 'Low Floor Tom',
  42: 'Closed Hi-Hat',
  43: 'High Floor Tom',
  44: 'Pedal Hi-Hat',
  45: 'Low Tom',
  46: 'Open Hi-Hat',
  47: 'Low-Mid Tom',
  48: 'Hi-Mid Tom',
  49: 'Crash Cymbal 1',
  50: 'High Tom',
  51: 'Ride Cymbal 1',
  52: 'Chinese Cymbal',
  53: 'Ride Bell',
  54: 'Tambourine',
  55: 'Splash Cymbal',
  56: 'Cowbell',
  57: 'Crash Cymbal 2',
  58: 'Vibraslap',
  59: 'Ride Cymbal 2',
  60: 'Hi Bongo',
  61: 'Low Bongo',
  62: 'Mute Hi Conga',
  63: 'Open Hi Conga',
  64: 'Low Conga',
  65: 'High Timbale',
  66: 'Low Timbale',
  67: 'High Agogo',
  68: 'Low Agogo',
  69: 'Cabasa',
  70: 'Maracas',
  71: 'Short Whistle',
  72: 'Long Whistle',
  73: 'Short Guiro',
  74: 'Long Guiro',
  75: 'Claves',
  76: 'Hi Wood Block',
  77: 'Low Wood Block',
  78: 'Mute Cuica',
  79: 'Open Cuica',
  80: 'Mute Triangle',
  81: 'Open Triangle',
}

export const GM_DRUM_MIN = 35
export const GM_DRUM_MAX = 81

export function isGmDrumNote(note: number): boolean {
  return note >= GM_DRUM_MIN && note <= GM_DRUM_MAX
}

/* ---------- Default instruments ---------- */

const P = {
  piano: 0,
  brightPiano: 1,
  ePiano: 4,
  musicBox: 10,
  vibraphone: 11,
  organ: 16,
  steelGuitar: 25,
  cleanGuitar: 27,
  overdrive: 29,
  distortion: 30,
  acousticBass: 32,
  fingerBass: 33,
  pickBass: 34,
  slapBass: 36,
  synthBass1: 38,
  synthBass2: 39,
  strings: 48,
  choir: 52,
  harp: 46,
  brass: 61,
  tenorSax: 66,
  squareLead: 80,
  sawLead: 81,
  newAgePad: 88,
  warmPad: 89,
  polySynth: 90,
  choirPad: 91,
  sweepPad: 95,
  crystal: 98,
} as const

type PartPrograms = Record<Exclude<PartType, 'drums'>, number>

const BASE_PROGRAMS: PartPrograms = {
  bass: P.fingerBass,
  chords: P.piano,
  melody: P.squareLead,
  arp: P.sawLead,
  pad: P.warmPad,
  riff: P.distortion,
}

const METAL: Partial<PartPrograms> = {
  bass: P.pickBass,
  chords: P.distortion,
  melody: P.distortion,
  riff: P.distortion,
  pad: P.strings,
  arp: P.harp,
}

const GENRE_PROGRAMS: Record<Genre, Partial<PartPrograms>> = {
  pop: { bass: P.synthBass1, melody: P.squareLead, pad: P.warmPad, riff: P.overdrive },
  hipHop: { bass: P.synthBass1, chords: P.ePiano, melody: P.vibraphone, arp: P.musicBox },
  lofi: { bass: P.acousticBass, chords: P.ePiano, melody: P.vibraphone, arp: P.musicBox },
  house: { bass: P.synthBass1, chords: P.brightPiano, melody: P.sawLead, pad: P.polySynth },
  techno: { bass: P.synthBass2, chords: P.polySynth, melody: P.sawLead, pad: P.sweepPad },
  dnb: { bass: P.synthBass2, chords: P.newAgePad, melody: P.sawLead, pad: P.newAgePad },
  rock: { bass: P.fingerBass, chords: P.overdrive, melody: P.distortion, riff: P.overdrive, arp: P.steelGuitar, pad: P.strings },
  metal: METAL,
  deathMetal: METAL,
  thrashMetal: METAL,
  doomMetal: { ...METAL, pad: P.choir },
  stonerRock: { ...METAL, chords: P.overdrive },
  jazz: { bass: P.acousticBass, chords: P.piano, melody: P.tenorSax, arp: P.vibraphone, pad: P.strings },
  funk: { bass: P.slapBass, chords: P.cleanGuitar, melody: P.brass, arp: P.cleanGuitar, pad: P.organ },
  ambient: { bass: P.warmPad, chords: P.warmPad, melody: P.crystal, arp: P.harp, pad: P.choirPad },
}

/** Default GM program for a part in a genre (drums always use channel 10, program 0). */
export function defaultProgram(part: PartType, genre: Genre): number {
  if (part === 'drums') return 0
  return GENRE_PROGRAMS[genre][part] ?? BASE_PROGRAMS[part]
}
