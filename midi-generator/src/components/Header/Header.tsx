import { AlertTriangle, AudioLines, Globe, Info, Loader2, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { packCredits, PACKS, type PackId } from '../../audio/samples/packs'
import { ensureAudio } from '../../audio/transport'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import { SOUND_SOURCES, usePrefsStore, type SoundSource } from '../../store/prefsStore'
import { useSamplesStore } from '../../store/samplesStore'
import { IconButton, Popover, Select } from '../ui'
import styles from './Header.module.css'

function SampleStatus() {
  const { t } = useTranslation()
  const status = useSamplesStore((s) => s.status)
  const loaded = useSamplesStore((s) => s.loaded)
  const total = useSamplesStore((s) => s.total)
  if (status === 'loading') {
    const text = t('sound.loading', { loaded, total })
    return (
      <span className={styles.status} role="status" title={text}>
        <Loader2 className={styles.spin} aria-hidden />
        <span className={styles.statusText}>
          {loaded}/{total}
        </span>
        <span className="visually-hidden">{text}</span>
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className={`${styles.status} ${styles.statusError}`} role="status" title={t('sound.error')}>
        <AlertTriangle aria-hidden />
        <span className="visually-hidden">{t('sound.error')}</span>
      </span>
    )
  }
  return null
}

export function Header() {
  const { t, i18n } = useTranslation()
  const theme = usePrefsStore((s) => s.theme)
  const toggleTheme = usePrefsStore((s) => s.toggleTheme)
  const soundSource = usePrefsStore((s) => s.soundSource)
  const setSoundSource = usePrefsStore((s) => s.setSoundSource)

  const changeSound = (source: SoundSource) => {
    setSoundSource(source)
    // Choosing a pack is a user gesture: start audio so the samples can load right away.
    if (source !== 'synth') void ensureAudio()
  }

  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <img className={styles.logo} src="/favicon.svg" alt="" />
        <div className={styles.brandText}>
          <h1 className={styles.title}>{t('common.appName')}</h1>
          <span className={styles.tagline}>{t('common.tagline')}</span>
        </div>
      </div>

      <div className={styles.controls}>
        <SampleStatus />
        <Select<SoundSource>
          className={styles.soundSelect}
          size="sm"
          icon={<AudioLines />}
          aria-label={t('header.soundSource')}
          title={t('header.soundSource')}
          value={soundSource}
          onChange={changeSound}
          options={SOUND_SOURCES.map((s) => ({ value: s, label: t(`sound.${s}`) }))}
        />
        <Select<LanguageCode>
          className={styles.langSelect}
          size="sm"
          icon={<Globe />}
          aria-label={t('header.language')}
          title={t('header.language')}
          value={i18n.resolvedLanguage as LanguageCode}
          onChange={(lng) => void i18n.changeLanguage(lng)}
          options={LANGUAGES.map((l) => ({ value: l.code, label: l.short }))}
        />
        <span className={styles.divider} />
        <IconButton
          label={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
          icon={theme === 'dark' ? <Sun /> : <Moon />}
          onClick={toggleTheme}
        />
        <Popover
          title={t('header.creditsTitle')}
          align="end"
          trigger={(props) => <IconButton label={t('header.credits')} icon={<Info />} {...props} />}
        >
          <div className={styles.credits}>
            <p>{t('header.creditsAlgorithms')}</p>
            <p>{t('header.creditsSynth')}</p>
            <p>{t('header.creditsSamples')}</p>
            <dl className={styles.packList}>
              {(Object.keys(PACKS) as PackId[]).map((pack) => (
                <div key={pack}>
                  <dt>{t(`sound.${pack}`)}</dt>
                  {packCredits(pack).map((c) => (
                    <dd key={c.name}>
                      <a href={c.url} target="_blank" rel="noreferrer">
                        {c.name}
                      </a>{' '}
                      · {c.license}
                    </dd>
                  ))}
                </div>
              ))}
            </dl>
            <p>{t('header.creditsPrivacy')}</p>
          </div>
        </Popover>
      </div>
    </header>
  )
}
