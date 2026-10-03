import { RotateCcw } from 'lucide-react'
import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { LIMITS } from '../../core/defaults'
import { GENRES_DEF } from '../../core/presets/genres'
import { suggestBpm } from '../../core/presets/style'
import { TIME_SIGNATURES, type Genre, type Mood, type ScaleId } from '../../core/types'
import { setTempo } from '../../store/actions'
import { useSettingsStore } from '../../store/settingsStore'
import { Button, Field, NumberField, Segmented, Select, Slider } from '../ui'
import { genreOptions, keyOptions, moodOptions, percent, scaleOptions } from './options'
import styles from './SettingsPanel.module.css'

const tsKey = (ts: { numerator: number; denominator: number }) => `${ts.numerator}/${ts.denominator}`

export function GlobalSettings() {
  const { t } = useTranslation()
  const g = useSettingsStore((s) => s.settings.global)
  const patchGlobal = useSettingsStore((s) => s.patchGlobal)
  const setGenre = useSettingsStore((s) => s.setGenre)
  const ids = { genre: useId(), mood: useId(), key: useId(), scale: useId(), bpm: useId() }

  const [bpmMin, bpmMax] = GENRES_DEF[g.genre].bpm
  const suggested = suggestBpm(g.genre, g.mood)
  const spellingScale: ScaleId = g.scale === 'auto' ? 'major' : g.scale

  return (
    <>
      <div className={styles.row2}>
        <Field label={t('settings.genre')} htmlFor={ids.genre}>
          <Select<Genre> id={ids.genre} value={g.genre} onChange={setGenre} options={genreOptions(t)} />
        </Field>
        <Field label={t('settings.mood')} htmlFor={ids.mood}>
          <Select<Mood> id={ids.mood} value={g.mood} onChange={(mood) => patchGlobal({ mood })} options={moodOptions(t)} />
        </Field>
      </div>

      <div className={styles.row2}>
        <Field label={t('settings.key')} htmlFor={ids.key}>
          <Select
            id={ids.key}
            value={String(g.key)}
            onChange={(v) => patchGlobal({ key: Number(v) })}
            options={keyOptions(spellingScale)}
          />
        </Field>
        <Field label={t('settings.scale')} htmlFor={ids.scale} info={t('tips.scale')}>
          <Select
            id={ids.scale}
            value={g.scale}
            onChange={(v) => patchGlobal({ scale: v as ScaleId | 'auto' })}
            options={scaleOptions(t)}
          />
        </Field>
      </div>

      <Field
        label={t('settings.bpm')}
        htmlFor={ids.bpm}
        hint={t('settings.bpmRange', { genre: t(`genres.${g.genre}`), min: bpmMin, max: bpmMax })}
      >
        <div className={styles.inline}>
          <NumberField
            id={ids.bpm}
            className={styles.grow}
            value={g.bpm}
            min={LIMITS.bpm.min}
            max={LIMITS.bpm.max}
            suffix="BPM"
            onChange={setTempo}
          />
          <Button
            size="sm"
            variant="ghost"
            icon={<RotateCcw />}
            disabled={g.bpm === suggested}
            title={t('settings.bpmSuggest', { bpm: suggested })}
            onClick={() => setTempo(suggested)}
          >
            {suggested}
          </Button>
        </div>
      </Field>

      <Field label={t('settings.timeSignature')}>
        <Segmented
          label={t('settings.timeSignature')}
          value={tsKey(g.timeSignature)}
          onChange={(v) => patchGlobal({ timeSignature: { ...TIME_SIGNATURES.find((ts) => tsKey(ts) === v)! } })}
          options={TIME_SIGNATURES.map((ts) => ({ value: tsKey(ts), label: tsKey(ts) }))}
        />
      </Field>

      <Slider
        label={t('settings.bars')}
        value={g.bars}
        min={LIMITS.bars.min}
        max={LIMITS.bars.max}
        format={(v) => t('settings.barsValue', { count: v })}
        onChange={(bars) => patchGlobal({ bars })}
      />
      <Slider label={t('settings.swing')} info={t('tips.swing')} value={g.swing} min={0} max={1} step={0.01} format={percent} onChange={(swing) => patchGlobal({ swing })} />
      <Slider
        label={t('settings.complexity')}
        info={t('tips.complexity')}
        value={g.complexity}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(complexity) => patchGlobal({ complexity })}
      />
      <Slider
        label={t('settings.humanize')}
        info={t('tips.humanize')}
        value={g.humanize}
        min={0}
        max={1}
        step={0.01}
        format={percent}
        onChange={(humanize) => patchGlobal({ humanize })}
      />
    </>
  )
}
