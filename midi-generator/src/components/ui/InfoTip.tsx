import { Info } from 'lucide-react'
import { useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import styles from './overlay.module.css'

const WIDTH = 260
const MARGIN = 8

/**
 * Small (i) button with an explanation on hover/focus. The bubble is portalled
 * to <body> with fixed positioning, so scrolling panels never clip it.
 */
export function InfoTip({ content, label }: { content: ReactNode; label: string }) {
  const id = useId()
  const ref = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<CSSProperties | null>(null)

  const show = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.max(MARGIN, Math.min(window.innerWidth - WIDTH - MARGIN, r.left + r.width / 2 - WIDTH / 2))
    const below = r.bottom + 6
    // Flip above when there is no room below.
    const style: CSSProperties =
      below + 120 > window.innerHeight ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: below }
    setPos(style)
  }
  const hide = () => setPos(null)

  return (
    <>
      <button
        ref={ref}
        type="button"
        className={styles.infoButton}
        aria-label={label}
        aria-describedby={pos ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.preventDefault()}
      >
        <Info aria-hidden />
      </button>
      {pos &&
        createPortal(
          <span role="tooltip" id={id} className={styles.infoBubble} style={{ ...pos, width: WIDTH }}>
            {content}
          </span>,
          document.body,
        )}
    </>
  )
}
