import { Download, GripVertical, ListMusic, RefreshCw } from 'lucide-react'
import type { CSSProperties, DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { downloadTrack, setDragDownload } from '../../core/midi/download'
import { trackFileName, trackToMidi } from '../../core/midi/export'
import type { Track } from '../../core/types'
import { useProjectStore } from '../../store/projectStore'
import { useUiStore } from '../../store/uiStore'
import { programName } from '../SettingsPanel/options'
import { EmptyState, IconButton, Panel, RangeInput, cx } from '../ui'
import styles from './TrackList.module.css'

function TrackRow({ track, selected }: { track: Track; selected: boolean }) {
  const { t } = useTranslation()
  const project = useProjectStore((s) => s.project)!
  const updateMix = useProjectStore((s) => s.updateMix)
  const regenerate = useProjectStore((s) => s.regenerate)
  const selectTrack = useUiStore((s) => s.selectTrack)
  const partName = t(`parts.${track.partType}`)

  const onDragStart = (e: DragEvent) => {
    setDragDownload(e.dataTransfer, trackToMidi(project, track), trackFileName(project, track))
  }

  return (
    <li
      className={cx(styles.row, selected && styles.selected, track.muted && styles.muted)}
      style={{ '--part-color': track.color } as CSSProperties}
      onClick={() => selectTrack(track.id)}
    >
      <span className={styles.grip} draggable onDragStart={onDragStart} title={t('tracks.drag')} aria-label={t('tracks.drag')}>
        <GripVertical />
      </span>
      <button type="button" className={styles.name} aria-pressed={selected} onClick={() => selectTrack(track.id)}>
        <span className={styles.title}>{partName}</span>
        <span className={styles.meta}>
          {track.partType === 'drums' ? 'GM Drums' : programName(track.program)} · {t('tracks.notes', { count: track.notes.length })}
        </span>
      </button>
      {/* Stop clicks on controls from re-selecting the row. */}
      <div className={styles.controls} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cx(styles.ms, track.muted && styles.msOn)}
          aria-pressed={track.muted}
          title={t('tracks.mute')}
          aria-label={`${t('tracks.mute')} ${partName}`}
          onClick={() => updateMix(track.id, { muted: !track.muted })}
        >
          M
        </button>
        <button
          type="button"
          className={cx(styles.ms, track.solo && styles.soloOn)}
          aria-pressed={track.solo}
          title={t('tracks.solo')}
          aria-label={`${t('tracks.solo')} ${partName}`}
          onClick={() => updateMix(track.id, { solo: !track.solo })}
        >
          S
        </button>
        <RangeInput
          className={styles.volume}
          aria-label={`${t('tracks.volume')} ${partName}`}
          valueText={`${Math.round(track.volume * 100)}%`}
          value={track.volume}
          onChange={(volume) => updateMix(track.id, { volume })}
        />
        <IconButton size="sm" label={t('tracks.regenerate')} icon={<RefreshCw />} onClick={() => regenerate(track.partType)} />
        <IconButton
          size="sm"
          label={t('tracks.download')}
          icon={<Download />}
          onClick={() => downloadTrack(project, track)}
        />
      </div>
    </li>
  )
}

export function TrackList({ className }: { className?: string }) {
  const { t } = useTranslation()
  const tracks = useProjectStore((s) => s.project?.tracks)
  const selectedTrackId = useUiStore((s) => s.selectedTrackId)

  return (
    <Panel title={t('tracks.title')} icon={<ListMusic />} className={className} bodyClassName={styles.body}>
      {tracks && tracks.length > 0 ? (
        <ul className={styles.list}>
          {tracks.map((track) => (
            <TrackRow key={track.id} track={track} selected={track.id === selectedTrackId} />
          ))}
        </ul>
      ) : (
        <EmptyState title={t('tracks.empty')} />
      )}
    </Panel>
  )
}
