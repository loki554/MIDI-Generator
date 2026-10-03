import { AudioLines, Globe, Info, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, type LanguageCode } from '../../i18n'
import { SOUND_SOURCES, usePrefsStore } from '../../store/prefsStore'
import { IconButton, Popover, Select } from '../ui'
import styles from './Header.module.css'

export function Header() {
  const { t, i18n } = useTranslation()
  const theme = usePrefsStore((s) => s.theme)
  const toggleTheme = usePrefsStore((s) => s.toggleTheme)
  const soundSource = usePrefsStore((s) => s.soundSource)
  const setSoundSource = usePrefsStore((s) => s.setSoundSource)

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
        <Select
          className={styles.soundSelect}
          size="sm"
          icon={<AudioLines />}
          aria-label={t('header.soundSource')}
          title={t('header.soundSource')}
          value={soundSource}
          onChange={setSoundSource}
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
            <p>{t('header.creditsSamples')}</p>
            <p>{t('header.creditsPrivacy')}</p>
          </div>
        </Popover>
      </div>
    </header>
  )
}
