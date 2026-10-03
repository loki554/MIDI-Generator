import { useEffect } from 'react'
import styles from './App.module.css'
import { ExportBar } from './components/ExportMenu/ExportBar'
import { Header } from './components/Header/Header'
import { PianoRollPanel } from './components/PianoRoll/PianoRollPanel'
import { SettingsPanel } from './components/SettingsPanel/SettingsPanel'
import { TrackList } from './components/TrackList/TrackList'
import { Transport } from './components/Transport/Transport'
import { useGlobalHotkeys } from './hooks/useGlobalHotkeys'
import { usePrefsStore } from './store/prefsStore'

function App() {
  const theme = usePrefsStore((s) => s.theme)
  useGlobalHotkeys()

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div className={styles.app}>
      <Header />
      <div className={styles.body}>
        <SettingsPanel />
        <main className={styles.main}>
          <Transport />
          <TrackList className={styles.tracks} />
          <PianoRollPanel />
          <ExportBar />
        </main>
      </div>
    </div>
  )
}

export default App
