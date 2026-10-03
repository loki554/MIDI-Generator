import { Download, FileArchive } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { downloadProject, downloadZip } from '../../core/midi/download'
import { useProjectStore } from '../../store/projectStore'
import { Button } from '../ui'
import styles from './ExportBar.module.css'

export function ExportBar() {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const disabled = !project || project.tracks.length === 0
  const hint = disabled ? t('export.disabled') : undefined

  return (
    <div className={styles.bar} role="group" aria-label={t('export.title')}>
      <span className={styles.label}>{t('export.title')}</span>
      <Button variant="secondary" icon={<FileArchive />} disabled={disabled} title={hint} onClick={() => project && downloadZip(project)}>
        {t('export.zip')}
      </Button>
      <Button variant="primary" icon={<Download />} disabled={disabled} title={hint} onClick={() => project && downloadProject(project)}>
        {t('export.project')}
      </Button>
    </div>
  )
}
