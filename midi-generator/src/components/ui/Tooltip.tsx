import { cloneElement, useId, type ReactElement, type ReactNode } from 'react'
import { cx } from './cx'
import styles from './overlay.module.css'

export interface TooltipProps {
  content: ReactNode
  /** A single focusable element; it receives aria-describedby. */
  children: ReactElement<{ 'aria-describedby'?: string }>
  placement?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  className?: string
}

/** Rich hover/focus tooltip for explanations. For icon buttons a native `title` is enough. */
export function Tooltip({
  content,
  children,
  placement = 'top',
  align = 'center',
  className,
}: TooltipProps) {
  const id = useId()
  const alignClass = {
    start: styles.alignStart,
    center: styles.alignCenter,
    end: styles.alignEnd,
  }[align]

  return (
    <span className={cx(styles.tooltipWrap, className)}>
      {cloneElement(children, { 'aria-describedby': id })}
      <span role="tooltip" id={id} className={cx(styles.tooltip, styles[placement], alignClass)}>
        {content}
      </span>
    </span>
  )
}
