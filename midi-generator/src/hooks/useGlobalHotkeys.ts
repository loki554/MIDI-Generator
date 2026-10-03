import { useEffect } from 'react'
import { generate } from '../store/actions'

/** True when a keystroke belongs to a text field or other control and must not trigger shortcuts. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag !== 'INPUT') return false
  const type = (target as HTMLInputElement).type
  // Checkboxes and range sliders don't take text, so shortcuts still apply.
  return !['checkbox', 'radio', 'range', 'button'].includes(type)
}

/** App-wide shortcuts. Ctrl/⌘+Enter generates even from inside a field. */
export function useGlobalHotkeys(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        generate()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
