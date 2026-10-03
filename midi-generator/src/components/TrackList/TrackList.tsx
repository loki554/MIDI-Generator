import { ListMusic } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Panel } from '../ui'

/** Track list. Filled from projectStore in phase 7. */
export function TrackList({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <Panel title={t('tracks.title')} icon={<ListMusic />} className={className}>
      <EmptyState title={t('tracks.empty')} />
    </Panel>
  )
}
