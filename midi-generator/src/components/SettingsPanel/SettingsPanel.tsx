import { Layers, Music2, Sparkles } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { PART_TYPES, type GenerationMode, type PartType } from '../../core/types'
import { generate } from '../../store/actions'
import { useSettingsStore } from '../../store/settingsStore'
import { Button, Field, Section, Segmented, Select } from '../ui'
import { GlobalSettings } from './GlobalSettings'
import { HarmonySettings } from './HarmonySettings'
import { PartCard } from './PartCard'
import { SeedControl } from './SeedControl'
import styles from './SettingsPanel.module.css'

export function SettingsPanel() {
  const { t } = useTranslation()
  const mode = useSettingsStore((s) => s.settings.global.mode)
  const singlePart = useSettingsStore((s) => s.settings.global.singlePart)
  const patchGlobal = useSettingsStore((s) => s.patchGlobal)
  const partId = useId()

  return (
    <aside className={styles.panel} aria-label={t('settings.title')}>
      <div className={styles.top}>
        <Segmented<GenerationMode>
          label={t('settings.mode')}
          value={mode}
          onChange={(m) => patchGlobal({ mode: m })}
          options={[
            { value: 'single', label: t('settings.modeSingle'), icon: <Music2 /> },
            { value: 'multi', label: t('settings.modeMulti'), icon: <Layers /> },
          ]}
        />
        {mode === 'single' && (
          <Field label={t('settings.part')} htmlFor={partId}>
            <Select<PartType>
              id={partId}
              value={singlePart}
              onChange={(p) => patchGlobal({ singlePart: p })}
              options={PART_TYPES.map((p) => ({ value: p, label: t(`parts.${p}`) }))}
            />
          </Field>
        )}
      </div>

      <div className={styles.scroll}>
        <Section title={t('settings.global')}>
          <GlobalSettings />
          <SeedControl />
        </Section>
        <Section title={t('settings.harmony')}>
          <HarmonySettings />
        </Section>
        <Section title={mode === 'single' ? t(`parts.${singlePart}`) : t('settings.parts')}>
          {mode === 'single' ? (
            <PartCard key={singlePart} part={singlePart} single />
          ) : (
            <div className={styles.partList}>
              {PART_TYPES.map((p) => (
                <PartCard key={p} part={p} />
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className={styles.footer}>
        <Button variant="primary" size="lg" block icon={<Sparkles />} onClick={generate}>
          {t('settings.generate')}
        </Button>
        <span className={styles.shortcut}>{t('settings.generateHint')}</span>
      </div>
    </aside>
  )
}
