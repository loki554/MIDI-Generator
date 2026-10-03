import { getSoundfontNames } from 'smplr'
import { describe, expect, it } from 'vitest'
import { GM_PROGRAM_NAMES } from '../../core/presets/gm'
import { GM_SOUNDFONT_NAMES, PACKS, packCredits, soundfontUrl } from './packs'

describe('sample packs', () => {
  it('names every GM program with a soundfont instrument smplr knows', () => {
    expect(GM_SOUNDFONT_NAMES).toHaveLength(GM_PROGRAM_NAMES.length)
    expect([...GM_SOUNDFONT_NAMES].sort()).toEqual([...getSoundfontNames()].sort())
    expect(GM_SOUNDFONT_NAMES[30]).toBe('distortion_guitar')
    expect(GM_SOUNDFONT_NAMES[33]).toBe('electric_bass_finger')
  })

  it('builds soundfont URLs', () => {
    expect(soundfontUrl('FatBoy', 0, 'ogg')).toBe('https://gleitz.github.io/midi-js-soundfonts/FatBoy/acoustic_grand_piano-ogg.js')
    expect(soundfontUrl('FluidR3_GM', 200)).toContain('/gunshot-mp3.js')
  })

  it.each(Object.values(PACKS).map((p) => [p.id, p] as const))('%s maps the core kit sounds', (_, pack) => {
    // Kick, snare, clap, closed/open hat, crash, ride and toms come from samples.
    for (const note of [36, 38, 39, 42, 46, 49, 51, 41, 45, 48]) expect(pack.drumMap[note], `note ${note}`).toBeTruthy()
  })

  it('credits each pack with a license', () => {
    for (const id of Object.keys(PACKS) as Array<keyof typeof PACKS>) {
      const credits = packCredits(id)
      expect(credits).toHaveLength(2)
      for (const c of credits) expect(c.license).toMatch(/CC BY|Public domain/)
    }
  })
})
