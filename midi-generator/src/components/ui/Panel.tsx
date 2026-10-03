import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { cx } from './cx'
import styles from './Panel.module.css'

export interface PanelProps {
  title: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  className?: string
  bodyClassName?: string
  children: ReactNode
}

/** Titled card used for the main work areas. */
export function Panel({ title, icon, actions, className, bodyClassName, children }: PanelProps) {
  return (
    <section className={cx(styles.panel, className)}>
      <header className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          {icon}
          {title}
        </h2>
        {actions && <div className={styles.panelActions}>{actions}</div>}
      </header>
      <div className={cx(styles.panelBody, bodyClassName)}>{children}</div>
    </section>
  )
}

export interface SectionProps {
  title: ReactNode
  defaultOpen?: boolean
  className?: string
  children: ReactNode
}

/** Collapsible group of settings. */
export function Section({ title, defaultOpen = true, className, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()

  return (
    <section className={cx(styles.section, className)}>
      <button
        type="button"
        className={styles.sectionHeader}
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span className={styles.chevron}>
          <ChevronDown />
        </span>
      </button>
      <div id={bodyId} className={styles.sectionBody} hidden={!open}>
        {children}
      </div>
    </section>
  )
}

export interface EmptyStateProps {
  icon?: ReactNode
  title: ReactNode
  hint?: ReactNode
  /** Call to action, e.g. a button. */
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      {icon && <div className={styles.emptyIcon}>{icon}</div>}
      <p className={styles.emptyTitle}>{title}</p>
      {hint && <p className={styles.emptyHint}>{hint}</p>}
      {action && <div className={styles.emptyAction}>{action}</div>}
    </div>
  )
}
