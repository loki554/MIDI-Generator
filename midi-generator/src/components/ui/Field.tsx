import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cx } from './cx'
import { InfoTip } from './InfoTip'
import styles from './controls.module.css'

export interface FieldProps {
  label: ReactNode
  /** Id of the control, links the label to it. */
  htmlFor?: string
  /** Current value rendered on the right of the label (e.g. "120 BPM"). */
  value?: ReactNode
  hint?: ReactNode
  /** Explanation shown in an (i) tooltip next to the label. */
  info?: string
  className?: string
  children: ReactNode
}

/** Label + control + optional hint, stacked vertically. */
export function Field({ label, htmlFor, value, hint, info, className, children }: FieldProps) {
  const { t } = useTranslation()
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.fieldHeader}>
        <span className={styles.labelRow}>
          <label className={styles.label} htmlFor={htmlFor}>
            {label}
          </label>
          {info && <InfoTip content={info} label={t('common.moreInfo')} />}
        </span>
        {value !== undefined && <span className={styles.fieldValue}>{value}</span>}
      </div>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
