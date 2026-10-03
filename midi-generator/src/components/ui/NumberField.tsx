import { Minus, Plus } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { cx } from './cx'
import styles from './controls.module.css'

export interface NumberFieldProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Unit shown after the number, e.g. "BPM". */
  suffix?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
}

/**
 * Numeric input with steppers. Typing is free-form; the value is parsed, clamped
 * and committed on blur or Enter. Arrow keys step by `step` (Shift: ×10).
 */
export function NumberField({
  value,
  onChange,
  min = -Infinity,
  max = Infinity,
  step = 1,
  suffix,
  size = 'md',
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
}: NumberFieldProps) {
  // Text being edited; null when the field shows the committed value.
  const [draft, setDraft] = useState<string | null>(null)

  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  const roundToStep = (n: number) => {
    const decimals = (String(step).split('.')[1] ?? '').length
    return Number((Math.round(n / step) * step).toFixed(decimals))
  }

  const commit = (n: number) => {
    const next = clamp(roundToStep(n))
    if (next !== value) onChange(next)
    setDraft(null)
  }

  const commitDraft = () => {
    if (draft === null) return
    const parsed = Number(draft.replace(',', '.'))
    if (draft.trim() === '' || Number.isNaN(parsed)) setDraft(null)
    else commit(parsed)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitDraft()
    } else if (e.key === 'Escape') {
      setDraft(null)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const delta = (e.key === 'ArrowUp' ? step : -step) * (e.shiftKey ? 10 : 1)
      commit(value + delta)
    }
  }

  return (
    <div className={cx(styles.number, size === 'sm' && styles.sm, className)}>
      <button
        type="button"
        className={styles.stepper}
        tabIndex={-1}
        aria-hidden
        disabled={disabled || value <= min}
        onClick={() => commit(value - step)}
      >
        <Minus />
      </button>
      <input
        id={id}
        className={styles.numberInput}
        type="text"
        inputMode="decimal"
        role="spinbutton"
        aria-label={ariaLabel}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        disabled={disabled}
        value={draft ?? String(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        onFocus={(e) => e.target.select()}
      />
      {suffix && <span className={styles.numberSuffix}>{suffix}</span>}
      <button
        type="button"
        className={styles.stepper}
        tabIndex={-1}
        aria-hidden
        disabled={disabled || value >= max}
        onClick={() => commit(value + step)}
      >
        <Plus />
      </button>
    </div>
  )
}
