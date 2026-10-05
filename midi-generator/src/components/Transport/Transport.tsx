import { Play, Repeat, Square, Timer, Volume, Volume1, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { engine, stop, togglePlay } from '../../audio/transport'
import { LIMITS } from '../../core/defaults'
import { formatPosition } from '../../core/time'
import { setTempo } from '../../store/actions'
import { usePlaybackStore } from '../../store/playbackStore'
import { useProjectStore } from '../../store/projectStore'
import { usePrefsStore } from '../../store/prefsStore'
import { useSettingsStore } from '../../store/settingsStore'
import { IconButton, NumberField, RangeInput } from '../ui'
import styles from './Transport.module.css'

export function Transport() {
  const { t } = useTranslation()
  const playing = usePlaybackStore((s) => s.playing)
  const loop = usePlaybackStore((s) => s.loop)
  const metronome = usePlaybackStore((s) => s.metronome)
  const setLoop = usePlaybackStore((s) => s.setLoop)
  const setMetronome = usePlaybackStore((s) => s.setMetronome)
  const hasProject = useProjectStore((s) => s.project !== null)
  const projectBpm = useProjectStore((s) => s.project?.bpm)
  const settingsBpm = useSettingsStore((s) => s.settings.global.bpm)
  const masterVolume = usePrefsStore((s) => s.masterVolume)
  const setMasterVolume = usePrefsStore((s) => s.setMasterVolume)
  const positionRef = useRef<HTMLSpanElement>(null)
  const VolumeIcon = masterVolume === 0 ? VolumeX : masterVolume < 0.34 ? Volume : masterVolume < 0.67 ? Volume1 : Volume2

  // Position readout: animated while playing, the cursor otherwise. Written to the
  // DOM directly so the transport doesn't re-render every frame.
  useEffect(() => {
    let raf = 0
    const update = () => {
      const project = useProjectStore.getState().project
      const ts = project?.timeSignature ?? useSettingsStore.getState().settings.global.timeSignature
      const tick = engine.position() ?? usePlaybackStore.getState().cursor
      if (positionRef.current) positionRef.current.textContent = formatPosition(Math.floor(tick), ts)
      raf = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className={styles.transport} role="toolbar" aria-label={t('transport.title')}>
      <div className={styles.buttons}>
        <IconButton
          variant="primary"
          label={`${playing ? t('transport.stop') : t('transport.play')} (${t('transport.playHint')})`}
          icon={playing ? <Square /> : <Play />}
          disabled={!hasProject}
          onClick={togglePlay}
        />
        <IconButton variant="secondary" label={t('transport.stop')} icon={<Square />} disabled={!playing} onClick={stop} />
        <IconButton variant="secondary" label={t('transport.loop')} icon={<Repeat />} pressed={loop} onClick={() => setLoop(!loop)} />
        <IconButton
          variant="secondary"
          label={t('transport.metronome')}
          icon={<Timer />}
          pressed={metronome}
          onClick={() => setMetronome(!metronome)}
        />
      </div>
      <div className={styles.position}>
        <span className={styles.positionLabel}>{t('transport.position')}</span>
        <span ref={positionRef} className={styles.positionValue} aria-live="off">
          1.1.1
        </span>
      </div>
      <div className={styles.master}>
        <VolumeIcon className={styles.masterIcon} aria-hidden />
        <RangeInput
          className={styles.masterRange}
          aria-label={t('transport.volume')}
          valueText={`${t('transport.volume')}: ${Math.round(masterVolume * 100)}%`}
          value={masterVolume}
          onChange={setMasterVolume}
        />
      </div>
      <NumberField
        className={styles.bpm}
        aria-label={t('transport.bpm')}
        suffix="BPM"
        value={projectBpm ?? settingsBpm}
        min={LIMITS.bpm.min}
        max={LIMITS.bpm.max}
        onChange={setTempo}
      />
    </div>
  )
}
