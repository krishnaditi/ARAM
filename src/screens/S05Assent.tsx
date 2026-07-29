import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'

export default function S05Assent() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const name = useOnboarding((s) => s.nickname) || t('common.friend')
  const setChildAssent = useOnboarding((s) => s.setChildAssent)

  const onYes = () => {
    setChildAssent(true)
    nav(ROUTES.camera)
  }

  const onNotNow = () => {
    setChildAssent(false)
    alert(t('s05.notNowMessage'))
  }

  const footer = (
    <>
      <div className="btn-row">
        <button className="btn btn-back" onClick={() => nav(ROUTES.parentConsent)}>
          ← {t('common.back')}
        </button>
        <button className="btn btn-outline" onClick={onNotNow}>
          {t('s05.notNow')}
        </button>
        <button className="btn btn-green" onClick={onYes}>
          {t('s05.yesContinue')}
        </button>
      </div>
      <div className="privacy-note">🔒 {t('s05.privacyNote')}</div>
    </>
  )

  return (
    <Screen progress={progressFor(ROUTES.assent)} footer={footer}>
      <div className="bg-soft">
        <div className="sc">
          <div
            className="sc-anim-1"
            style={{
              textAlign: 'center',
              fontSize: '1.6rem',
              fontWeight: 800,
              color: '#1a1a18',
              lineHeight: 1.3,
            }}
          >
            {t('s05.title', { name })} 💜
          </div>

          <div className="cap-card green sc-anim-2">
            <div className="cap-card-header green">💚 {t('s05.canTitle')}</div>
            <div className="cap-bullet">{t('s05.can1')}</div>
            <div className="cap-bullet">{t('s05.can2')}</div>
            <div className="cap-bullet">{t('s05.can3')}</div>
          </div>

          <div className="cap-card amber sc-anim-3">
            <div className="cap-card-header amber">🛡️ {t('s05.cannotTitle')}</div>
            <div className="cap-bullet">{t('s05.cannot1')}</div>
            <div className="cap-bullet">{t('s05.cannot2')}</div>
            <div className="cap-bullet">{t('s05.cannot3')}</div>
          </div>

          <div className="warm-card sc-anim-4">{t('s05.warm')}</div>
          <div className="sc-question sc-anim-5">{t('s05.question')}</div>
        </div>
      </div>
    </Screen>
  )
}
