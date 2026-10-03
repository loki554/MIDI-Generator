/**
 * Sample packs: a GM soundfont for melodic tracks plus a sampled drum machine.
 * Samples are streamed from public CDNs only when a pack is selected.
 *
 * Licenses (checked at the source, 2026-10):
 * - FluidR3_GM: CC BY 3.0; MusyngKite and FatBoy: CC BY-SA 3.0 — all via
 *   gleitz/midi-js-soundfonts (MIT repository). The app only plays them back
 *   unmodified and credits them in the UI.
 * - Drum machines (smpldsnds/drum-machines): public domain.
 */
import type { SoundSource } from '../../store/prefsStore'

export type PackId = Exclude<SoundSource, 'synth'>
export type SoundfontKit = 'FluidR3_GM' | 'MusyngKite' | 'FatBoy'
export type DrumMachineName = 'LM-2' | 'Casio-RZ1' | 'TR-808'

/** GM note → sample name in the drum machine; unmapped notes use the synth kit. */
export type DrumMap = Readonly<Partial<Record<number, string>>>

export interface PackDef {
  id: PackId
  soundfont: SoundfontKit
  drums: DrumMachineName
  drumMap: DrumMap
  /**
   * Makeup gain (dB) so samples sit near the built-in synth's loudness; measured
   * as the RMS difference over the same notes (samples come out 10–18 dB quieter).
   */
  melodicGainDb: number
  drumGainDb: number
}

export interface Credit {
  name: string
  license: string
  url: string
}

/** midi-js-soundfonts instrument names in General MIDI program order (0–127). */
export const GM_SOUNDFONT_NAMES = [
  'acoustic_grand_piano', 'bright_acoustic_piano', 'electric_grand_piano', 'honkytonk_piano',
  'electric_piano_1', 'electric_piano_2', 'harpsichord', 'clavinet',
  'celesta', 'glockenspiel', 'music_box', 'vibraphone', 'marimba', 'xylophone', 'tubular_bells', 'dulcimer',
  'drawbar_organ', 'percussive_organ', 'rock_organ', 'church_organ', 'reed_organ', 'accordion', 'harmonica', 'tango_accordion',
  'acoustic_guitar_nylon', 'acoustic_guitar_steel', 'electric_guitar_jazz', 'electric_guitar_clean',
  'electric_guitar_muted', 'overdriven_guitar', 'distortion_guitar', 'guitar_harmonics',
  'acoustic_bass', 'electric_bass_finger', 'electric_bass_pick', 'fretless_bass',
  'slap_bass_1', 'slap_bass_2', 'synth_bass_1', 'synth_bass_2',
  'violin', 'viola', 'cello', 'contrabass', 'tremolo_strings', 'pizzicato_strings', 'orchestral_harp', 'timpani',
  'string_ensemble_1', 'string_ensemble_2', 'synth_strings_1', 'synth_strings_2',
  'choir_aahs', 'voice_oohs', 'synth_choir', 'orchestra_hit',
  'trumpet', 'trombone', 'tuba', 'muted_trumpet', 'french_horn', 'brass_section', 'synth_brass_1', 'synth_brass_2',
  'soprano_sax', 'alto_sax', 'tenor_sax', 'baritone_sax', 'oboe', 'english_horn', 'bassoon', 'clarinet',
  'piccolo', 'flute', 'recorder', 'pan_flute', 'blown_bottle', 'shakuhachi', 'whistle', 'ocarina',
  'lead_1_square', 'lead_2_sawtooth', 'lead_3_calliope', 'lead_4_chiff',
  'lead_5_charang', 'lead_6_voice', 'lead_7_fifths', 'lead_8_bass__lead',
  'pad_1_new_age', 'pad_2_warm', 'pad_3_polysynth', 'pad_4_choir',
  'pad_5_bowed', 'pad_6_metallic', 'pad_7_halo', 'pad_8_sweep',
  'fx_1_rain', 'fx_2_soundtrack', 'fx_3_crystal', 'fx_4_atmosphere',
  'fx_5_brightness', 'fx_6_goblins', 'fx_7_echoes', 'fx_8_scifi',
  'sitar', 'banjo', 'shamisen', 'koto', 'kalimba', 'bagpipe', 'fiddle', 'shanai',
  'tinkle_bell', 'agogo', 'steel_drums', 'woodblock', 'taiko_drum', 'melodic_tom', 'synth_drum', 'reverse_cymbal',
  'guitar_fret_noise', 'breath_noise', 'seashore', 'bird_tweet', 'telephone_ring', 'helicopter', 'applause', 'gunshot',
] as const

export function soundfontUrl(kit: SoundfontKit, program: number, format: 'mp3' | 'ogg' = 'mp3'): string {
  const name = GM_SOUNDFONT_NAMES[Math.max(0, Math.min(127, program))]
  return `https://gleitz.github.io/midi-js-soundfonts/${kit}/${name}-${format}.js`
}

export function drumMachineUrl(machine: DrumMachineName): string {
  return `https://smpldsnds.github.io/drum-machines/${machine}/dm.json`
}

/* ---------- Drum maps (GM percussion → kit sample) ---------- */

const LM2: DrumMap = {
  35: 'kick-alt', 36: 'kick', 37: 'stick-m', 38: 'snare-m', 39: 'clap', 40: 'snare-h',
  41: 'tom-ll', 42: 'hhclosed', 43: 'tom-l', 44: 'hhclosed-short', 45: 'tom-m', 46: 'hhopen',
  47: 'tom-m', 48: 'tom-h', 49: 'crash', 50: 'tom-hh', 51: 'ride', 53: 'ride', 54: 'tambourine',
  55: 'crash', 56: 'cowbell', 57: 'crash', 59: 'ride', 62: 'conga-h', 63: 'conga-m', 64: 'conga-l',
  69: 'cabasa', 70: 'cabasa',
}

const RZ1: DrumMap = {
  35: 'kick', 36: 'kick', 37: 'clave', 38: 'snare', 39: 'clap', 40: 'snare',
  41: 'tom-3', 42: 'hihat-closed', 43: 'tom-3', 44: 'hihat-closed', 45: 'tom-2', 46: 'hihat-open',
  47: 'tom-2', 48: 'tom-1', 49: 'crash', 50: 'tom-1', 51: 'ride', 53: 'ride', 55: 'crash',
  56: 'cowbell', 57: 'crash', 59: 'ride', 75: 'clave',
}

const TR808: DrumMap = {
  35: 'kick/bd5075', 36: 'kick/bd2575', 37: 'rimshot', 38: 'snare/sd2550', 39: 'clap', 40: 'snare/sd5050',
  41: 'tom-low/lt50', 42: 'hihat-close', 43: 'tom-low/lt25', 44: 'hihat-close', 45: 'mid-tom/mt50',
  46: 'hihat-open/oh25', 47: 'mid-tom/mt25', 48: 'tom-hi/ht50', 49: 'cymbal/cy5075', 50: 'tom-hi/ht25',
  51: 'cymbal/cy2510', 53: 'cymbal/cy2510', 55: 'cymbal/cy5025', 56: 'cowbell', 57: 'cymbal/cy7575',
  59: 'cymbal/cy2510', 62: 'conga-hi', 63: 'conga-mid', 64: 'conga-low', 69: 'maraca', 70: 'maraca', 75: 'clave',
}

export const PACKS: Readonly<Record<PackId, PackDef>> = {
  gmClassic: { id: 'gmClassic', soundfont: 'FluidR3_GM', drums: 'LM-2', drumMap: LM2, melodicGainDb: 12, drumGainDb: 14 },
  gmRich: { id: 'gmRich', soundfont: 'MusyngKite', drums: 'Casio-RZ1', drumMap: RZ1, melodicGainDb: 11, drumGainDb: 15 },
  electronic: { id: 'electronic', soundfont: 'FatBoy', drums: 'TR-808', drumMap: TR808, melodicGainDb: 15, drumGainDb: 11 },
}

export const SOUNDFONT_CREDITS: Readonly<Record<SoundfontKit, Credit>> = {
  FluidR3_GM: { name: 'FluidR3_GM (Frank Wen)', license: 'CC BY 3.0', url: 'https://github.com/gleitz/midi-js-soundfonts' },
  MusyngKite: { name: 'Musyng Kite', license: 'CC BY-SA 3.0', url: 'https://github.com/gleitz/midi-js-soundfonts' },
  FatBoy: { name: 'FatBoy', license: 'CC BY-SA 3.0', url: 'https://github.com/gleitz/midi-js-soundfonts' },
}

export const DRUM_CREDITS: Readonly<Record<DrumMachineName, Credit>> = {
  'LM-2': { name: 'LinnDrum LM-2', license: 'Public domain', url: 'https://github.com/smpldsnds/drum-machines' },
  'Casio-RZ1': { name: 'Casio RZ-1', license: 'Public domain', url: 'https://github.com/smpldsnds/drum-machines' },
  'TR-808': { name: 'Roland TR-808', license: 'Public domain', url: 'https://github.com/smpldsnds/drum-machines' },
}

export function packCredits(id: PackId): Credit[] {
  const pack = PACKS[id]
  return [SOUNDFONT_CREDITS[pack.soundfont], DRUM_CREDITS[pack.drums]]
}

export const dbToGain = (db: number) => 10 ** (db / 20)

export const isPack = (source: SoundSource): source is PackId => source !== 'synth'
