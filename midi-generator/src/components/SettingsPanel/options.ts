import type { TFunction } from 'i18next'
import { GM_PROGRAMS, gmProgramsByFamily } from '../../core/presets/gm'
import { PROGRESSION_PRESETS } from '../../core/theory/progressions'
import { keyName } from '../../core/theory/scales'
import { GENRES, MOODS, SCALE_IDS, type ScaleId } from '../../core/types'
import type { SelectGroup, SelectOption } from '../ui'

export const percent = (v: number) => `${Math.round(v * 100)}%`

export const genreOptions = (t: TFunction) => GENRES.map((g) => ({ value: g, label: t(`genres.${g}`) }))

export const moodOptions = (t: TFunction) => MOODS.map((m) => ({ value: m, label: t(`moods.${m}`) }))

export const keyOptions = (scale: ScaleId) =>
  Array.from({ length: 12 }, (_, pc) => ({ value: String(pc), label: keyName(pc, scale) }))

export const scaleOptions = (t: TFunction): SelectOption[] => [
  { value: 'auto', label: t('common.auto') },
  ...SCALE_IDS.map((s) => ({ value: s, label: t(`scales.${s}`) })),
]

export const progressionOptions = (t: TFunction): Array<SelectOption | SelectGroup> => {
  const group = (family: 'major' | 'minor', label: string): SelectGroup => ({
    group: label,
    options: PROGRESSION_PRESETS.filter((p) => p.family === family).map((p) => ({
      value: p.id,
      label: p.numerals.join(' – '),
    })),
  })
  return [
    { value: 'auto', label: t('common.auto') },
    { value: 'markov', label: t('settings.progressionMarkov') },
    group('major', t('settings.progressionMajor')),
    group('minor', t('settings.progressionMinor')),
  ]
}

export const programName = (program: number) => GM_PROGRAMS[program]?.name ?? String(program)

/** "Auto (default)" plus all 128 GM programs grouped by family. */
export const instrumentOptions = (t: TFunction, autoProgram: number): Array<SelectOption | SelectGroup> => [
  { value: 'auto', label: t('settings.instrumentAuto', { name: programName(autoProgram) }) },
  ...gmProgramsByFamily().map(({ family, programs }) => ({
    group: t(`gm.families.${family}`),
    options: programs.map((p) => ({ value: String(p.program), label: `${p.program + 1}. ${p.name}` })),
  })),
]

/** Options for an enum setting with 'auto', labels from an i18n namespace. */
export function enumOptions<T extends string>(t: TFunction, values: readonly T[], ns: string, withAuto = true): SelectOption[] {
  const opts = values.map((v) => ({ value: v, label: t(`${ns}.${v}` as never) as string }))
  return withAuto ? [{ value: 'auto', label: t('common.auto') }, ...opts] : opts
}
