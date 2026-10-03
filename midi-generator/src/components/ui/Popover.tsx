import { X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from './Button'
import { cx } from './cx'
import styles from './overlay.module.css'

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>
  onClick: () => void
  'aria-expanded': boolean
  'aria-controls': string
  'aria-haspopup': 'dialog'
}

export interface PopoverProps {
  /** Renders the trigger button; spread the given props onto it. */
  trigger: (props: PopoverTriggerProps) => ReactNode
  title: string
  align?: 'start' | 'end'
  className?: string
  children: ReactNode
}

/** Non-modal dialog anchored to its trigger. Closes on outside click and Escape. */
export function Popover({ trigger, title, align = 'start', className, children }: PopoverProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const id = useId()
  const wrapRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={wrapRef} className={cx(styles.popoverWrap, className)}>
      {trigger({
        ref: triggerRef,
        onClick: () => setOpen((o) => !o),
        'aria-expanded': open,
        'aria-controls': id,
        'aria-haspopup': 'dialog',
      })}
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={title}
          className={cx(styles.popover, align === 'end' ? styles.popoverEnd : styles.popoverStart)}
        >
          <div className={styles.popoverHeader}>
            <h2 className={styles.popoverTitle}>{title}</h2>
            <IconButton
              size="sm"
              label={t('common.close')}
              icon={<X />}
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
            />
          </div>
          {children}
        </div>
      )}
    </div>
  )
}
