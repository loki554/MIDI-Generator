import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { defaultProgram } from '../../core/presets/gm'
import type {
  ArpPattern,
  ArpRate,
  BassStyle,
  ChordExtension,
  ChordRhythm,
  PartSettingsMap,
  PartType,
  PhraseStructure,
  RiffStyle,
} from '../../core/types'
import { setPartProgram } from '../../store/actions'
import { useSettingsStore } from '../../store/settingsStore'
import { Checkbox, Field, Segmented, Select, Slider, type SelectGroup, type SelectOption } from '../ui'
import { enumOptions, instrumentOptions, percent } from './options'
import styles from './SettingsPanel.module.css'

const BASS_STYLES: readonly BassStyle[] = ['root', 'octave', 'walking', 'sub808', 'offbeat', 'syncopated', 'riff']
const CHORD_RHYTHMS: readonly ChordRhythm[] = ['sustain', 'stabs', 'syncopated', 'strum']
const EXTENSIONS: readonly ChordExtension[] = ['triad', 'seventh', 'ninth', 'eleventh', 'thirteenth', 'sus2', 'sus4', 'add9', 'power']
const ARP_PATTERNS: readonly ArpPattern[] = ['up', 'down', 'upDown', 'random', 'converge']
const ARP_RATES: readonly ArpRate[] = ['1/8', '1/8t', '1/16', '1/16t', '1/32']
const RIFF_STYLES: readonly RiffStyle[] = ['chug', 'gallop', 'tremolo', 'groove', 'halfTime']
const STRUCTURES: readonly PhraseStructure[] = ['AABA', 'ABAC', 'AAAB', 'ABAB']

/** Hook returning one part's settings and a typed patch function. */
function usePart<P extends PartType>(part: P) {
  const settings = useSettingsStore((s) => s.settings.parts[part]) as PartSettingsMap[P]
  const patchPart = useSettingsStore((s) => s.patchPart)
  return [settings, (patch: Partial<PartSettingsMap[P]>) => patchPart(part, patch)] as const
}

function SelectField<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<SelectOption | SelectGroup>
  onChange: (v: T) => void
}) {
  const id = useId()
  return (
    <Field label={props.label} htmlFor={id}>
      <Select id={id} value={props.value} onChange={(v) => props.onChange(v as T)} options={props.options} />
    </Field>
  )
}

function OctaveField({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }) {
  const { t } = useTranslation()
  const options = Array.from({ length: max - min + 1 }, (_, i) => ({ value: String(min + i), label: String(min + i) }))
  return (
    <Field label={t('settings.octave')}>
      <Segmented label={t('settings.octave')} size="sm" value={String(value)} onChange={(v) => onChange(Number(v))} options={options} />
    </Field>
  )
}

function InstrumentField({ part }: { part: Exclude<PartType, 'drums'> }) {
  const { t } = useTranslation()
  const program = useSettingsStore((s) => s.settings.parts[part].program)
  const genre = useSettingsStore((s) => s.settings.global.genre)
  return (
    <SelectField
      label={t('settings.instrument')}
      value={String(program)}
      options={instrumentOptions(t, defaultProgram(part, genre))}
      onChange={(v) => setPartProgram(part, v === 'auto' ? 'auto' : Number(v))}
    />
  )
}

function DrumParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('drums')
  return (
    <>
      <Slider label={t('settings.density')} value={p.density} min={0} max={1} step={0.01} format={percent} onChange={(density) => patch({ density })} />
      <Field label={t('settings.fillEvery')}>
        <Segmented
          label={t('settings.fillEvery')}
          size="sm"
          value={String(p.fillEvery)}
          onChange={(v) => patch({ fillEvery: Number(v) as 0 | 2 | 4 | 8 })}
          options={[
            { value: '0', label: t('common.off') },
            { value: '2', label: '2' },
            { value: '4', label: '4' },
            { value: '8', label: '8' },
          ]}
        />
      </Field>
      <div className={styles.checks}>
        <Checkbox label={t('settings.ghostNotes')} checked={p.ghostNotes} onChange={(ghostNotes) => patch({ ghostNotes })} />
        <Checkbox label={t('settings.hihatRolls')} checked={p.hihatRolls} onChange={(hihatRolls) => patch({ hihatRolls })} />
        <Checkbox label={t('settings.crashOnSection')} checked={p.crashOnSection} onChange={(crashOnSection) => patch({ crashOnSection })} />
      </div>
    </>
  )
}

function BassParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('bass')
  return (
    <>
      <InstrumentField part="bass" />
      <SelectField label={t('settings.style')} value={p.style} options={enumOptions(t, BASS_STYLES, 'bassStyles')} onChange={(style) => patch({ style })} />
      <OctaveField value={p.octave} min={1} max={3} onChange={(octave) => patch({ octave })} />
      <Checkbox label={t('settings.approachNotes')} checked={p.approachNotes} onChange={(approachNotes) => patch({ approachNotes })} />
    </>
  )
}

function ChordParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('chords')
  return (
    <>
      <InstrumentField part="chords" />
      <div className={styles.row2}>
        <SelectField label={t('settings.extension')} value={p.extension} options={enumOptions(t, EXTENSIONS, 'extensions')} onChange={(extension) => patch({ extension })} />
        <SelectField label={t('settings.rhythm')} value={p.rhythm} options={enumOptions(t, CHORD_RHYTHMS, 'chordRhythms')} onChange={(rhythm) => patch({ rhythm })} />
      </div>
      <OctaveField value={p.octave} min={2} max={6} onChange={(octave) => patch({ octave })} />
      <Checkbox label={t('settings.voiceLeading')} checked={p.voiceLeading} onChange={(voiceLeading) => patch({ voiceLeading })} />
    </>
  )
}

function MelodyParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('melody')
  return (
    <>
      <InstrumentField part="melody" />
      <Slider label={t('settings.density')} value={p.density} min={0} max={1} step={0.01} format={percent} onChange={(density) => patch({ density })} />
      <Slider
        label={t('settings.range')}
        value={p.range}
        min={7}
        max={24}
        format={(v) => t('settings.rangeValue', { count: v })}
        onChange={(range) => patch({ range })}
      />
      <Slider label={t('settings.repetition')} value={p.repetition} min={0} max={1} step={0.01} format={percent} onChange={(repetition) => patch({ repetition })} />
      <SelectField
        label={t('settings.structure')}
        value={p.structure}
        options={[{ value: 'auto', label: t('common.auto') }, ...STRUCTURES.map((s) => ({ value: s, label: s }))]}
        onChange={(structure) => patch({ structure })}
      />
      <OctaveField value={p.octave} min={3} max={7} onChange={(octave) => patch({ octave })} />
    </>
  )
}

function ArpParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('arp')
  return (
    <>
      <InstrumentField part="arp" />
      <div className={styles.row2}>
        <SelectField label={t('settings.pattern')} value={p.pattern} options={enumOptions(t, ARP_PATTERNS, 'arpPatterns', false)} onChange={(pattern) => patch({ pattern })} />
        <SelectField label={t('settings.rate')} value={p.rate} options={ARP_RATES.map((r) => ({ value: r, label: r }))} onChange={(rate) => patch({ rate })} />
      </div>
      <Field label={t('settings.octaves')}>
        <Segmented
          label={t('settings.octaves')}
          size="sm"
          value={String(p.octaves)}
          onChange={(v) => patch({ octaves: Number(v) as 1 | 2 | 3 })}
          options={['1', '2', '3'].map((v) => ({ value: v, label: v }))}
        />
      </Field>
      <OctaveField value={p.octave} min={2} max={6} onChange={(octave) => patch({ octave })} />
    </>
  )
}

function PadParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('pad')
  return (
    <>
      <InstrumentField part="pad" />
      <SelectField label={t('settings.extension')} value={p.extension} options={enumOptions(t, EXTENSIONS, 'extensions')} onChange={(extension) => patch({ extension })} />
      <OctaveField value={p.octave} min={3} max={6} onChange={(octave) => patch({ octave })} />
    </>
  )
}

function RiffParams() {
  const { t } = useTranslation()
  const [p, patch] = usePart('riff')
  return (
    <>
      <InstrumentField part="riff" />
      <SelectField label={t('settings.style')} value={p.style} options={enumOptions(t, RIFF_STYLES, 'riffStyles')} onChange={(style) => patch({ style })} />
      <Slider label={t('settings.palmMute')} value={p.palmMute} min={0} max={1} step={0.01} format={percent} onChange={(palmMute) => patch({ palmMute })} />
      <Slider label={t('settings.chromaticism')} value={p.chromaticism} min={0} max={1} step={0.01} format={percent} onChange={(chromaticism) => patch({ chromaticism })} />
      <OctaveField value={p.octave} min={1} max={3} onChange={(octave) => patch({ octave })} />
    </>
  )
}

export function PartParams({ part }: { part: PartType }) {
  switch (part) {
    case 'drums':
      return <DrumParams />
    case 'bass':
      return <BassParams />
    case 'chords':
      return <ChordParams />
    case 'melody':
      return <MelodyParams />
    case 'arp':
      return <ArpParams />
    case 'pad':
      return <PadParams />
    case 'riff':
      return <RiffParams />
  }
}
