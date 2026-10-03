import { Piano } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EmptyState, Panel } from '../ui'

/** Host panel for the piano roll editor (phase 9). */
export function PianoRollPanel({ className }: { className?: string }) {
  const { t } = useTranslation()

  return (
    <Panel title={t('pianoRoll.title')} icon={<Piano />} className={className}>
      <EmptyState icon={<Piano />} title={t('pianoRoll.empty')} hint={t('pianoRoll.emptyHint')} />
    </Panel>
  )
}
