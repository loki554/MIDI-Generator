import { ChevronDown } from 'lucide-react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cx } from './cx'
import styles from './controls.module.css'

export interface SelectOption<T extends string = string> {
  value: T
  label: string
  disabled?: boolean
}

export interface SelectGroup<T extends string = string> {
  group: string
  options: SelectOption<T>[]
}

export interface SelectProps<T extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'size'> {
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<SelectOption<T> | SelectGroup<T>>
  size?: 'sm' | 'md'
  /** Leading icon inside the control. */
  icon?: ReactNode
}

function renderOption<T extends string>(o: SelectOption<T>) {
  return (
    <option key={o.value} value={o.value} disabled={o.disabled}>
      {o.label}
    </option>
  )
}

/** Styled native select: fully keyboard/screen-reader accessible out of the box. */
export function Select<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  icon,
  className,
  ...rest
}: SelectProps<T>) {
  return (
    <div className={cx(styles.selectWrap, className)}>
      {icon && <span className={styles.selectIcon}>{icon}</span>}
      <select
        className={cx(
          styles.input,
          styles.select,
          size === 'sm' && styles.sm,
          icon != null && styles.selectWithIcon,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        {...rest}
      >
        {options.map((o) =>
          'group' in o ? (
            <optgroup key={o.group} label={o.group}>
              {o.options.map(renderOption)}
            </optgroup>
          ) : (
            renderOption(o)
          ),
        )}
      </select>
      <span className={styles.selectChevron}>
        <ChevronDown />
      </span>
    </div>
  )
}
