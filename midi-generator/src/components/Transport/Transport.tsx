import { Play, Repeat, Square } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton, NumberField } from '../ui'
import styles from './Transport.module.css'

/** Playback controls. Inactive until the audio engine lands (phase 8). */
export function Transport() {
  const { t } = useTranslation()

  return (
    <div className={styles.transport} role="toolbar" aria-label={t('transport.play')}>
      <div className={styles.buttons}>
        <IconButton variant="primary" label={t('transport.play')} icon={<Play />} disabled />
        <IconButton variant="secondary" label={t('transport.stop')} icon={<Square />} disabled />
        <IconButton variant="secondary" label={t('transport.loop')} icon={<Repeat />} pressed disabled />
      </div>
      <div className={styles.position}>
        <span className={styles.positionLabel}>{t('transport.position')}</span>
        <span className={styles.positionValue}>1.1.1</span>
      </div>
      <NumberField
        className={styles.bpm}
        aria-label={t('transport.bpm')}
        suffix={t('transport.bpm')}
        value={120}
        onChange={() => {}}
        disabled
      />
    </div>
  )
}
