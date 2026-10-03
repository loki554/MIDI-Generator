import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../store/settingsStore'
import { Field, Segmented, Select } from '../ui'
import { progressionOptions } from './options'

type ChordsPerBar = 'auto' | '0.5' | '1' | '2'

export function HarmonySettings() {
  const { t } = useTranslation()
  const progression = useSettingsStore((s) => s.settings.global.progression)
  const chordsPerBar = useSettingsStore((s) => s.settings.global.chordsPerBar)
  const patchGlobal = useSettingsStore((s) => s.patchGlobal)
  const id = useId()

  return (
    <>
      <Field label={t('settings.progression')} htmlFor={id}>
        <Select id={id} value={progression} onChange={(v) => patchGlobal({ progression: v })} options={progressionOptions(t)} />
      </Field>
      <Field label={t('settings.chordsPerBar')}>
        <Segmented<ChordsPerBar>
          label={t('settings.chordsPerBar')}
          value={String(chordsPerBar) as ChordsPerBar}
          onChange={(v) => patchGlobal({ chordsPerBar: v === 'auto' ? 'auto' : (Number(v) as 0.5 | 1 | 2) })}
          options={[
            { value: 'auto', label: t('common.auto') },
            { value: '0.5', label: '½' },
            { value: '1', label: '1' },
            { value: '2', label: '2' },
          ]}
        />
      </Field>
    </>
  )
}
