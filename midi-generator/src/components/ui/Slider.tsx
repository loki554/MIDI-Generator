import { useId, type CSSProperties, type ReactNode } from 'react'
import { Field } from './Field'
import styles from './Slider.module.css'

export interface SliderProps {
  label: ReactNode
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  /** Formats the value shown next to the label and announced to screen readers. */
  format?: (value: number) => string
  hint?: ReactNode
  disabled?: boolean
  className?: string
}

export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = String,
  hint,
  disabled,
  className,
}: SliderProps) {
  const id = useId()
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  const text = format(value)

  return (
    <Field label={label} htmlFor={id} value={text} hint={hint} className={className}>
      <input
        id={id}
        type="range"
        className={styles.range}
        style={{ '--fill': `${fill}%` } as CSSProperties}
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-valuetext={text}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </Field>
  )
}
