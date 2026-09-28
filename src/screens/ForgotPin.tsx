import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES } from '../flow'
import { api } from '../lib/api'

type Stage = 'email' | 'reset' | 'done'

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export default function ForgotPin() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const [stage, setStage] = useState<Stage>('email')
  const [email, setEmail] = useState('')
  const [account, setAccount] = useState<{ nickname: string; ageGroup: string } | null>(null)
  const [pin, setPin] = useState('')
  const [pinConfirm, setPinConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const normalizedEmail = email.trim().toLowerCase()

  const onCheckEmail = async () => {
    setError(null)
    if (!EMAIL_PATTERN.test(normalizedEmail)) return setError(t('s03.errEmail'))
    setBusy(true)
    try {
      const found = await api.lookupByEmail(normalizedEmail)
      if (!found.ok) return setError(t('forgotPin.errNotFound'))
      setAccount({ nickname: found.nickname, ageGroup: found.ageGroup })
      setStage('reset')
    } catch {
      setError(t('forgotPin.errNetwork'))
    } finally {
      setBusy(false)
    }
  }

  const onReset = async () => {
    setError(null)
    if (pin.length !== 4) return setError(t('s03.errPinLength'))
    if (pin !== pinConfirm) return setError(t('s03.errPinMismatch'))
    setBusy(true)
    try {
      const res = await api.resetPinByEmail(normalizedEmail, pin)
      if (!res.ok) return setError(t('forgotPin.errNotFound'))
      setPin('')
      setPinConfirm('')
      setStage('done')
    } catch {
      setError(t('forgotPin.errNetwork'))
    } finally {
      setBusy(false)
    }
  }

  const onBack = () => {
    setError(null)
    if (stage === 'reset') {
      setPin('')
      setPinConfirm('')
      setStage('email')
      return
    }
    nav(ROUTES.login)
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
        {stage !== 'done' && (
          <button className="btn btn-back" onClick={onBack} disabled={busy}>
            ← {t('common.back')}
          </button>
        )}
        {stage === 'email' && (
          <button className="btn btn-next" onClick={() => void onCheckEmail()} disabled={busy || !normalizedEmail}>
            {t('common.continue')} →
          </button>
        )}
        {stage === 'reset' && (
          <button className="btn btn-next" onClick={() => void onReset()} disabled={busy}>
            {t('forgotPin.save')} →
          </button>
        )}
        {stage === 'done' && (
          <button className="btn btn-primary" onClick={() => nav(ROUTES.login)}>
            {t('forgotPin.goToLogin')} →
          </button>
        )}
      </div>
    </>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-white">
        <div className="sc-sm">
          <div className="sc-anim-1" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#1a1a18' }}>🔑 {t('forgotPin.title')}</div>
            <div style={{ fontSize: '1.1rem', color: '#aaa', marginTop: '0.4rem' }}>
              {stage === 'email' ? t('forgotPin.emailSubtitle') : stage === 'reset' ? t('forgotPin.resetSubtitle') : ''}
            </div>
          </div>

          {stage === 'email' && (
            <div className="sc-anim-2">
              <div className="field-label">✉️ {t('s03.email')}</div>
              <input
                className="sc-input"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                autoFocus
                placeholder={t('s03.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !busy && void onCheckEmail()}
              />
            </div>
          )}

          {stage === 'reset' && account && (
            <>
              <div className="sc-anim-2">
                <div className="field-label">{t('s03.nickname')}</div>
                <input className="sc-input" value={account.nickname} disabled readOnly />
              </div>
              <div className="sc-anim-2">
                <div className="field-label">{t('profile.ageGroup')}</div>
                <input className="sc-input" value={account.ageGroup || '—'} disabled readOnly />
                <div className="note-card teal" style={{ marginTop: '0.6rem' }}>
                  <span className="note-card-icon">💡</span>
                  <span>{t('forgotPin.ageNote')}</span>
                </div>
              </div>
              <div className="sc-anim-3">
                <div className="field-label">✉️ {t('s03.email')}</div>
                <input className="sc-input" value={normalizedEmail} disabled readOnly />
              </div>
              <div className="sc-anim-4">
                <div className="field-label">🔒 {t('forgotPin.newPin')}</div>
                <input
                  className="sc-input"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="● ● ● ●"
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
                  value={pinConfirm}
                  onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              </div>
            </>
          )}

          {stage === 'done' && (
            <div className="note-card green sc-anim-2">
              <span className="note-card-icon">✅</span>
              <span>{t('forgotPin.done', { name: account?.nickname ?? '' })}</span>
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
