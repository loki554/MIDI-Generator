import { useEffect } from 'react'
import { togglePlay } from '../audio/transport'
import { generate } from '../store/actions'
import { redo, undo } from '../store/projectStore'

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
        return
      }
      if (isTypingTarget(e.target)) return
      // Undo/redo (text fields keep their own native undo, handled above).
      const key = e.key.toLowerCase()
      if (mod && (key === 'z' || key === 'y')) {
        e.preventDefault()
        if (key === 'y' || e.shiftKey) redo()
        else undo()
        return
      }
      if (e.repeat) return
      // Space toggles playback; on a focused button it would also "click" it, so take it over.
      if (e.key === ' ' && !mod && !e.altKey) {
        e.preventDefault()
        togglePlay()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
