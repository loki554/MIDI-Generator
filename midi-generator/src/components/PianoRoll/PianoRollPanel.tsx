import { Piano, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generate } from '../../store/actions'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { Button, EmptyState, Panel } from '../ui'
import { PianoRoll } from './PianoRoll'
import { Toolbar } from './Toolbar'

/** Piano roll for the selected track. */
export function PianoRollPanel({ className }: { className?: string }) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)
  const selectedTrackId = useUiStore((s) => s.selectedTrackId)
  const track = project?.tracks.find((tr) => tr.id === selectedTrackId) ?? project?.tracks[0]

  const title = track ? `${t('pianoRoll.title')} · ${t(`parts.${track.partType}`)}` : t('pianoRoll.title')

  return (
    <Panel title={title} icon={<Piano />} className={className} actions={track ? <Toolbar /> : undefined}>
      {project && track ? (
        <PianoRoll project={project} track={track} />
      ) : (
        <EmptyState
          icon={<Piano />}
          title={t('pianoRoll.empty')}
          hint={t('pianoRoll.emptyHint')}
          action={
            <Button variant="primary" icon={<Sparkles />} onClick={generate}>
              {t('pianoRoll.emptyAction')}
            </Button>
          }
        />
      )}
    </Panel>
  )
}
