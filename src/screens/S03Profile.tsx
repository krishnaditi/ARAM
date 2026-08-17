import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import MicButton from '../components/MicButton'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding, deriveAgeGroup } from '../state/onboardingStore'
import { api } from '../lib/api'

export default function S03Profile() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const s = useOnboarding()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // S03 is reached either straight from the EMIS lookup (TN govt school) or straight
  // from the schoolType "No" branch — back should return to wherever they actually came from.
  const backRoute = s.isTNGovtSchool ? ROUTES.emis : ROUTES.schoolType

  const onNext = async () => {
    setError(null)
    if (s.nickname.trim().length === 0) return setError(t('s03.errNickname'))
    const ageGroup = deriveAgeGroup(s.dob)
    if (!ageGroup) return setError(t('s03.errDob'))
    if (s.pin.length !== 4) return setError(t('s03.errPinLength'))
    if (s.pin !== s.pinConfirm) return setError(t('s03.errPinMismatch'))

    setBusy(true)
    try {
      const { childId } = await api.createChild({
        emis: s.emis,
        language: s.language,
        nickname: s.nickname.trim(),
        ageGroup,
        pin: s.pin,
      })
      // Persist childId + ageGroup; wipe DOB/PIN from memory immediately.
      s.commitChild(childId, ageGroup)
      nav(ROUTES.parentConsent)
    } catch {
      setError(t('s03.errDob'))
      setBusy(false)
    }
  }

  const footer = (
    <>
      {error && (
        <div className="note-card pink">
          <span className="note-card-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      <div className="btn-row">
        <button className="btn btn-back" onClick={() => nav(backRoute)}>
          ← {t('common.back')}
        </button>
        <button className="btn btn-next" onClick={onNext} disabled={busy}>
          {t('common.next')} →
        </button>
      </div>
    </>
  )

  return (
    <Screen progress={progressFor(ROUTES.profile)} footer={footer}>
      <div className="bg-white">
        <div className="sc-sm">
          <div className="sc-anim-1" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a18' }}>
              {t('s03.title')} 😊
            </div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>{t('s03.subtitle')}</div>
          </div>

          <div className="sc-anim-2">
            <div className="field-label">{t('s03.nickname')}</div>
            <div className="input-with-mic">
              <input
                className="sc-input"
                placeholder={t('s03.nicknamePlaceholder')}
                value={s.nickname}
                onChange={(e) => s.setNickname(e.target.value)}
              />
              <MicButton onTranscript={(text) => s.setNickname(text.replace(/[.\s]+$/, ''))} />
            </div>
          </div>

          <div className="sc-anim-3">
            <div className="field-label">{t('s03.dob')}</div>
            <div className="dob-row">
              <input
                className="sc-input"
                placeholder={t('s03.day')}
                inputMode="numeric"
                maxLength={2}
                value={s.dob.day}
                onChange={(e) => s.setDob({ day: e.target.value })}
              />
              <input
                className="sc-input"
                placeholder={t('s03.month')}
                inputMode="numeric"
                maxLength={2}
                value={s.dob.month}
                onChange={(e) => s.setDob({ month: e.target.value })}
              />
              <input
                className="sc-input"
                placeholder={t('s03.year')}
                inputMode="numeric"
                maxLength={4}
                value={s.dob.year}
                onChange={(e) => s.setDob({ year: e.target.value })}
              />
            </div>
            <div className="note-card teal" style={{ marginTop: '0.6rem' }}>
              <span className="note-card-icon">💡</span>
              <span>{t('s03.dobNote')}</span>
            </div>
          </div>

          <div className="sc-anim-4">
            <div className="field-label">🔒 {t('s03.createPin')}</div>
            <input
              className="sc-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="● ● ● ●"
              value={s.pin}
              onChange={(e) => s.setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          </div>

          <div className="sc-anim-5">
            <div className="field-label">{t('s03.confirmPin')}</div>
            <input
              className="sc-input"
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="● ● ● ●"
              value={s.pinConfirm}
              onChange={(e) => s.setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <div className="note-card teal" style={{ marginTop: '0.6rem' }}>
              <span className="note-card-icon">🔐</span>
              <span>{t('s03.pinNote')}</span>
            </div>
          </div>
        </div>
      </div>
    </Screen>
  )
}
