import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './controls.module.css'

export interface FieldProps {
  label: ReactNode
  /** Id of the control, links the label to it. */
  htmlFor?: string
  /** Current value rendered on the right of the label (e.g. "120 BPM"). */
  value?: ReactNode
  hint?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + optional hint, stacked vertically. */
export function Field({ label, htmlFor, value, hint, className, children }: FieldProps) {
  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.fieldHeader}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {value !== undefined && <span className={styles.fieldValue}>{value}</span>}
      </div>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
