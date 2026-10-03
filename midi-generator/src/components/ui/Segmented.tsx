import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from './cx'
import styles from './controls.module.css'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedProps<T extends string> {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<SegmentedOption<T>>
  /** Accessible name of the group. */
  label: string
  size?: 'sm' | 'md'
  className?: string
}

/** Radio group rendered as a segmented control, with roving focus via arrow keys. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
  className,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!dir) return
    e.preventDefault()
    for (let step = 1; step <= options.length; step++) {
      const next = (index + dir * step + options.length) % options.length
      if (!options[next].disabled) {
        onChange(options[next].value)
        refs.current[next]?.focus()
        return
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(styles.segmented, size === 'sm' && styles.sm, className)}
    >
      {options.map((o, i) => {
        const checked = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            disabled={o.disabled}
            className={styles.segment}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            title={o.label}
          >
            {o.icon}
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
