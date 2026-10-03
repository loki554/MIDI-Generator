import { Layers, Music2, Sparkles } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Section, Segmented } from '../ui'
import styles from './SettingsPanel.module.css'

// Placeholder lists until the core model (phase 3) defines them.
const PART_TYPES = ['drums', 'bass', 'chords', 'melody', 'arp', 'pad', 'riff'] as const
type GenerationMode = 'single' | 'multi'

export function SettingsPanel() {
  const { t } = useTranslation()
  // Moves to settingsStore in phase 7.
  const [mode, setMode] = useState<GenerationMode>('multi')

  return (
    <aside className={styles.panel} aria-label={t('settings.title')}>
      <div className={styles.top}>
        <h2 className={styles.heading}>{t('settings.mode')}</h2>
        <Segmented
          label={t('settings.mode')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'single', label: t('settings.modeSingle'), icon: <Music2 /> },
            { value: 'multi', label: t('settings.modeMulti'), icon: <Layers /> },
          ]}
        />
      </div>

      <div className={styles.scroll}>
        <Section title={t('settings.global')}>
          <p className={styles.placeholder}>{t('settings.placeholder')}</p>
        </Section>
        <Section title={t('settings.parts')}>
          <ul className={styles.parts}>
            {PART_TYPES.map((part) => (
              <li
                key={part}
                className={styles.part}
                style={{ '--part-color': `var(--part-${part})` } as CSSProperties}
              >
                <span className={styles.dot} />
                {t(`parts.${part}`)}
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className={styles.footer}>
        <Button variant="primary" size="lg" block icon={<Sparkles />} disabled title={t('common.comingSoon')}>
          {t('settings.generate')}
        </Button>
        <span className={styles.shortcut}>{t('settings.generateHint')}</span>
      </div>
    </aside>
  )
}
