import { ChevronDown } from 'lucide-react'
import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { PartType } from '../../core/types'
import { useSettingsStore } from '../../store/settingsStore'
import { Toggle } from '../ui'
import { PartParams } from './PartParams'
import styles from './SettingsPanel.module.css'

interface PartCardProps {
  part: PartType
  /** Single-part mode: no enable switch, always expanded. */
  single?: boolean
}

export function PartCard({ part, single }: PartCardProps) {
  const { t } = useTranslation()
  const enabled = useSettingsStore((s) => s.settings.parts[part].enabled)
  const patchPart = useSettingsStore((s) => s.patchPart)
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  const expanded = single || open
  const active = single || enabled

  return (
    <div
      className={styles.partCard}
      data-active={active}
      style={{ '--part-color': `var(--part-${part})` } as CSSProperties}
    >
      <div className={styles.partHeader}>
        {!single && (
          <Toggle
            checked={enabled}
            aria-label={`${t(`parts.${part}`)}: ${t('settings.enabled')}`}
            onChange={(on) => patchPart(part, { enabled: on })}
          />
        )}
        <span className={styles.dot} />
        {single ? (
          <span className={styles.partName}>{t(`parts.${part}`)}</span>
        ) : (
          <button
            type="button"
            className={styles.partToggle}
            aria-expanded={expanded}
            aria-controls={bodyId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className={styles.partName}>{t(`parts.${part}`)}</span>
            <span className={styles.chevron}>
              <ChevronDown />
            </span>
          </button>
        )}
      </div>
      {expanded && (
        <div id={bodyId} className={styles.partBody}>
          <PartParams part={part} />
        </div>
      )}
    </div>
  )
}
