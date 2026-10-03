import { describe, expect, it } from 'vitest'
import { PACKS } from '../audio/samples/packs'
import { GM_FAMILIES } from '../core/presets/gm'
import { GENRES, MOODS, PART_TYPES, SCALE_IDS } from '../core/types'
import { SOUND_SOURCES } from '../store/prefsStore'
import de from './locales/de.json'
import en from './locales/en.json'
import ru from './locales/ru.json'

type Tree = { [key: string]: string | Tree }
const locales = { en, ru, de } as Record<string, Tree>

const PLURAL = /_(zero|one|two|few|many|other)$/

function flatten(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === 'string') out[prefix + k] = v
    else Object.assign(out, flatten(v, `${prefix}${k}.`))
  }
  return out
}

const flat = Object.fromEntries(Object.entries(locales).map(([lang, tree]) => [lang, flatten(tree)]))
const baseKeys = (lang: string) => [...new Set(Object.keys(flat[lang]).map((k) => k.replace(PLURAL, '')))].sort()
const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort()

describe('locales', () => {
  it('have the same keys in every language', () => {
    expect(baseKeys('ru')).toEqual(baseKeys('en'))
    expect(baseKeys('de')).toEqual(baseKeys('en'))
  })

  it.each(Object.keys(locales))('%s has no empty strings', (lang) => {
    for (const [key, value] of Object.entries(flat[lang])) expect(value.trim(), key).not.toBe('')
  })

  it.each(Object.keys(locales))('%s has every plural form the language needs', (lang) => {
    const categories = new Intl.PluralRules(lang).resolvedOptions().pluralCategories
    const plurals = new Set(Object.keys(flat[lang]).filter((k) => PLURAL.test(k)).map((k) => k.replace(PLURAL, '')))
    for (const base of plurals) {
      for (const cat of categories) expect(flat[lang][`${base}_${cat}`], `${base}_${cat}`).toBeTruthy()
    }
  })

  it('use the same placeholders in every language', () => {
    for (const [key, value] of Object.entries(flat.en)) {
      const base = key.replace(PLURAL, '')
      const expected = placeholders(value)
      for (const lang of ['ru', 'de']) {
        const variants = Object.entries(flat[lang]).filter(([k]) => k.replace(PLURAL, '') === base)
        for (const [k, v] of variants) expect(placeholders(v), `${lang}:${k}`).toEqual(expected)
      }
    }
  })

  it.each(Object.keys(locales))('%s names every value the UI looks up dynamically', (lang) => {
    const f = flat[lang]
    const groups: Array<[string, readonly string[]]> = [
      ['genres', GENRES],
      ['moods', MOODS],
      ['parts', PART_TYPES],
      ['scales', SCALE_IDS],
      ['gm.families', GM_FAMILIES],
      ['sound', [...SOUND_SOURCES, ...Object.keys(PACKS)]],
      ['bassStyles', ['root', 'octave', 'walking', 'sub808', 'offbeat', 'syncopated', 'riff']],
      ['chordRhythms', ['sustain', 'stabs', 'syncopated', 'strum']],
      ['extensions', ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth', 'sus2', 'sus4', 'add9', 'power']],
      ['arpPatterns', ['up', 'down', 'upDown', 'random', 'converge']],
      ['riffStyles', ['chug', 'gallop', 'tremolo', 'groove', 'halfTime']],
      ['pianoRoll.tools', ['draw', 'select', 'delete']],
      ['pianoRoll.help', ['draw', 'select', 'erase', 'resize', 'snap', 'zoom', 'ruler', 'keys']],
    ]
    for (const [ns, values] of groups) {
      for (const v of values) expect(f[`${ns}.${v}`], `${lang}: ${ns}.${v}`).toBeTruthy()
    }
  })
})
