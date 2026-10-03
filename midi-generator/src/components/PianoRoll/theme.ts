/** Canvas can't read CSS variables, so resolve the design tokens to concrete colors. */

export interface RollTheme {
  bg: string
  rowWhite: string
  rowBlack: string
  line: string
  lineStrong: string
  surface: string
  surface3: string
  text: string
  textMuted: string
  textFaint: string
  accent: string
  keyWhite: string
  keyBlack: string
  dark: boolean
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim()

/** Resolves `var(--x)` (or returns the color as is). */
export function resolveColor(color: string): string {
  const m = /^var\((--[\w-]+)\)$/.exec(color.trim())
  return m ? cssVar(m[1]) || '#888' : color
}

export function readTheme(): RollTheme {
  const dark = document.documentElement.dataset.theme !== 'light'
  return {
    bg: cssVar('--bg'),
    rowWhite: cssVar('--surface'),
    rowBlack: cssVar('--surface-2'),
    line: cssVar('--border'),
    lineStrong: cssVar('--border-strong'),
    surface: cssVar('--surface'),
    surface3: cssVar('--surface-3'),
    text: cssVar('--text'),
    textMuted: cssVar('--text-muted'),
    textFaint: cssVar('--text-faint'),
    accent: cssVar('--accent'),
    keyWhite: dark ? '#d8dbe3' : '#ffffff',
    keyBlack: dark ? '#1a1d24' : '#2a2e37',
    dark,
  }
}
