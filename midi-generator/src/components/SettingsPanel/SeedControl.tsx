import { Dices, Lock, LockOpen } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSettingsStore } from '../../store/settingsStore'
import { Field, IconButton } from '../ui'
import controls from '../ui/controls.module.css'
import styles from './SettingsPanel.module.css'

/** Seeds are shown in base 36 to keep them short ("k3x9f1"). */
const format = (seed: number) => (seed >>> 0).toString(36)

export function SeedControl() {
  const { t } = useTranslation()
  const seed = useSettingsStore((s) => s.settings.global.seed)
  const locked = useSettingsStore((s) => s.settings.global.seedLocked)
  const patchGlobal = useSettingsStore((s) => s.patchGlobal)
  const rollSeed = useSettingsStore((s) => s.rollSeed)
  const [draft, setDraft] = useState<string | null>(null)
  const id = useId()

  const commit = () => {
    if (draft === null) return
    const parsed = parseInt(draft.trim().toLowerCase(), 36)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 0xffffffff) patchGlobal({ seed: parsed })
    setDraft(null)
  }

  return (
    <Field label={t('settings.seed')} htmlFor={id} hint={t('settings.seedHint')}>
      <div className={styles.inline}>
        <input
          id={id}
          className={`${controls.input} ${styles.seedInput}`}
          value={draft ?? format(seed)}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') setDraft(null)
          }}
        />
        <IconButton variant="secondary" label={t('settings.seedRandom')} icon={<Dices />} onClick={() => rollSeed()} />
        <IconButton
          variant="secondary"
          label={locked ? t('settings.seedUnlock') : t('settings.seedLock')}
          icon={locked ? <Lock /> : <LockOpen />}
          pressed={locked}
          onClick={() => patchGlobal({ seedLocked: !locked })}
        />
      </div>
    </Field>
  )
}
