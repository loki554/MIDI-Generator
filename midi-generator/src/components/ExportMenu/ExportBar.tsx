import { Download, FileArchive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '../ui'
import styles from './ExportBar.module.css'

/** Export actions. Wired to core/midi in phase 6–7. */
export function ExportBar() {
  const { t } = useTranslation()

  return (
    <div className={styles.bar} role="group" aria-label={t('export.title')}>
      <span className={styles.label}>{t('export.title')}</span>
      <Button variant="secondary" icon={<FileArchive />} disabled>
        {t('export.zip')}
      </Button>
      <Button variant="primary" icon={<Download />} disabled>
        {t('export.project')}
      </Button>
    </div>
  )
}
