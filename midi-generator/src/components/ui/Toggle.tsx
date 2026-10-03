import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { InfoTip } from './InfoTip'
import type { ReactNode } from 'react'
import { cx } from './cx'
import styles from './Toggle.module.css'

export interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Visible label. If omitted, pass `aria-label`. */
  label?: ReactNode
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

/** On/off switch (role="switch"). */
export function Toggle({ checked, onChange, label, disabled, className, ...aria }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={aria['aria-label']}
      disabled={disabled}
      className={cx(styles.toggle, className)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.track}>
        <span className={styles.thumb} />
      </span>
      {label}
    </button>
  )
}

export interface CheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: ReactNode
  /** Explanation shown in an (i) tooltip after the label. */
  info?: string
  disabled?: boolean
  className?: string
}

export function Checkbox({ checked, onChange, label, info, disabled, className }: CheckboxProps) {
  const { t } = useTranslation()
  const box = (
    <label className={cx(styles.checkbox, className)}>
      <span className={styles.box}>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.check}>
          <Check />
        </span>
      </span>
      {label}
    </label>
  )
  if (!info) return box
  // The tip sits outside the <label> so clicking it doesn't toggle the checkbox.
  return (
    <span className={styles.checkboxRow}>
      {box}
      <InfoTip content={info} label={t('common.moreInfo')} />
    </span>
  )
}
