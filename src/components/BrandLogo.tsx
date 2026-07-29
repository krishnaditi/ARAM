import { useTranslation } from 'react-i18next'

interface BrandLogoProps {
  animation?: 'bounce' | 'float'
  showTagline?: boolean
  taglineKey?: 'tagline' | 'welcomeBack'
}

/** The ARAM logo lockup used across onboarding screens. */
export default function BrandLogo({
  animation = 'bounce',
  showTagline = true,
  taglineKey = 'tagline',
}: BrandLogoProps) {
  const { t } = useTranslation()
  return (
    <div className="aram-logo-wrap sc-anim-1">
      <div className={`aram-logo-circle sc-${animation}`}>🤲</div>
      <div className="aram-title">{t('brand.name')}</div>
      {showTagline && <div className="aram-subtitle">{t(`brand.${taglineKey}`)}</div>}
    </div>
  )
}
