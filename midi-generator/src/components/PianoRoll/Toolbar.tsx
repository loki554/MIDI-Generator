import { BarChart3, Eraser, Keyboard, Maximize2, MousePointer2, Pencil, Redo2, Undo2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { redo, undo, useProjectStore } from '../../store/projectStore'
import { type EditTool, type SnapValue, useUiStore } from '../../store/uiStore'
import { IconButton, Popover, Select } from '../ui'
import styles from './Toolbar.module.css'

const SNAPS: readonly SnapValue[] = ['1/4', '1/8', '1/16', '1/32', '1/8t', '1/16t', 'off']
const HELP_KEYS = ['draw', 'select', 'erase', 'resize', 'snap', 'zoom', 'ruler', 'keys'] as const

export function Toolbar() {
  const { t } = useTranslation()
  const tool = useUiStore((s) => s.tool)
  const setTool = useUiStore((s) => s.setTool)
  const snap = useUiStore((s) => s.snap)
  const setSnap = useUiStore((s) => s.setSnap)
  const showVelocity = useUiStore((s) => s.showVelocity)
  const toggleVelocity = useUiStore((s) => s.toggleVelocity)
  const requestFit = useUiStore((s) => s.requestFit)
  const canUndo = useStore(useProjectStore.temporal, (s) => s.pastStates.length > 0)
  const canRedo = useStore(useProjectStore.temporal, (s) => s.futureStates.length > 0)

  const tools: Array<{ id: EditTool; icon: ReactNode }> = [
    { id: 'draw', icon: <Pencil /> },
    { id: 'select', icon: <MousePointer2 /> },
    { id: 'delete', icon: <Eraser /> },
  ]

  return (
    <div className={styles.toolbar}>
      <div className={styles.group} role="group" aria-label={t('pianoRoll.tool')}>
        {tools.map(({ id, icon }) => (
          <IconButton
            key={id}
            size="sm"
            pressed={tool === id}
            label={t(`pianoRoll.tools.${id}`)}
            icon={icon}
            onClick={() => setTool(id)}
          />
        ))}
      </div>
      <span className={styles.divider} />
      <Select<SnapValue>
        size="sm"
        className={styles.snap}
        aria-label={t('pianoRoll.snap')}
        title={t('pianoRoll.snap')}
        value={snap}
        onChange={setSnap}
        options={SNAPS.map((s) => ({ value: s, label: s === 'off' ? t('pianoRoll.snapOff') : s }))}
      />
      <IconButton size="sm" label={t('pianoRoll.fit')} icon={<Maximize2 />} onClick={requestFit} />
      <IconButton size="sm" label={t('pianoRoll.velocity')} icon={<BarChart3 />} pressed={showVelocity} onClick={toggleVelocity} />
      <span className={styles.divider} />
      <IconButton size="sm" label={t('pianoRoll.undo')} icon={<Undo2 />} disabled={!canUndo} onClick={undo} />
      <IconButton size="sm" label={t('pianoRoll.redo')} icon={<Redo2 />} disabled={!canRedo} onClick={redo} />
      <Popover
        title={t('pianoRoll.shortcuts')}
        align="end"
        trigger={(props) => <IconButton size="sm" label={t('pianoRoll.shortcuts')} icon={<Keyboard />} {...props} />}
      >
        <ul className={styles.help}>
          {HELP_KEYS.map((k) => (
            <li key={k}>{t(`pianoRoll.help.${k}`)}</li>
          ))}
        </ul>
      </Popover>
    </div>
  )
}
