import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import Toggle from '../components/Toggle'
import { ROUTES } from '../flow'
import { useOnboarding, deriveAgeGroup, type DobParts } from '../state/onboardingStore'
import { api } from '../lib/api'

/**
 * Everything the account holds about this child, and the two things they may change
 * themselves: their nickname and their PIN.
 *
 * Rendered entirely from the local store rather than fetched. Every field here is
 * already on the device, and the API this talks to sits behind a free-tier host that
 * can take 40s to wake — making a child wait for a spinner to read their own name
 * would be the wrong trade. Edits go to the server and update the store on success.
 *
 * Two things are deliberately absent because the app does not hold them:
 *   • the captured photo — only a 128-number descriptor is stored, and S06 promises
 *     the child that photos are never saved. The descriptor cannot be made into an image.
 *   • the date of birth — only the derived age band survives signup.
 */

type Panel = 'none' | 'nickname' | 'pin'

const emptyDob: DobParts = { day: '', month: '', year: '' }

export default function MyProfile() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const s = useOnboarding()

  const [panel, setPanel] = useState<Panel>('none')
  const [draftName, setDraftName] = useState(s.nickname)
  const [checkName, setCheckName] = useState('')
  const [checkDob, setCheckDob] = useState<DobParts>({ ...emptyDob })
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const childId = s.childId
  const digits = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max)

  const closePanel = () => {
    setPanel('none')
    setError(null)
    setCheckName('')
    setCheckDob({ ...emptyDob })
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
  }

  const saveNickname = async () => {
    const name = draftName.trim()
    if (!name) return setError(t('profile.nicknameInvalid'))
    if (!childId) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.renameChild(childId, name)
      if (!result.ok) {
        setError(t('profile.nicknameInvalid'))
        return
      }
      s.setNickname(result.nickname ?? name)
      setDone(t('profile.nicknameSaved', { name: result.nickname ?? name }))
      closePanel()
    } catch {
      setError(t('profile.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const savePin = async () => {
    if (!childId) return
    if (newPin.length !== 4) return setError(t('profile.pinMismatch'))
    if (newPin !== confirmPin) return setError(t('profile.pinMismatch'))
    // The DOB never leaves the device: it is reduced to the same age band the server
    // already stores, and only the band is sent — exactly as at signup.
    const ageGroup = deriveAgeGroup(checkDob)
    if (!ageGroup) return setError(t('profile.pinDetailsWrong'))

    setBusy(true)
    setError(null)
    try {
      const result = await api.changePin(childId, {
        nickname: checkName,
        ageGroup,
        currentPin,
        newPin,
      })
      if (result.ok) {
        setDone(t('profile.pinSaved'))
        closePanel()
        return
      }
      setError(
        result.reason === 'wrong_pin'
          ? t('profile.pinWrong', { remaining: result.remainingAttempts ?? 0 })
          : result.reason === 'same_pin'
            ? t('profile.pinSame')
            : result.reason === 'locked'
              ? t('profile.pinLocked')
              : t('profile.pinDetailsWrong'),
      )
      setCurrentPin('')
    } catch {
      setError(t('profile.saveFailed'))
    } finally {
      setBusy(false)
    }
  }

  const setOptIns = async (camera: boolean, voice: boolean) => {
    s.setCameraOptIn(camera)
    s.setVoiceOptIn(voice)
    if (!childId) return
    try {
      await api.updateOptIns(childId, camera, voice)
    } catch {
      // The local choice still holds for this device; the next successful call syncs it.
      setError(t('profile.saveFailed'))
    }
  }

  const hasSchool = Boolean(s.emis || s.schoolName || s.district)

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.home)}>
        {t('profile.back')}
      </button>
    </div>
  )

  return (
    <Screen footer={footer}>
      <div className="bg-gradient">
        <div className="sc-sm">
          <div className="sc-anim-1 prof-head">
            <div className="prof-avatar">{(s.nickname || '?').charAt(0).toUpperCase()}</div>
            <div>
              <div className="prof-title">{t('profile.title')}</div>
              <div className="prof-sub">{t('profile.subtitle')}</div>
            </div>
          </div>

          {done && (
            <div className="note-card green sc-anim-2">
              <span className="note-card-icon">✅</span>
              <span>{done}</span>
            </div>
          )}

          {/* ── About me ───────────────────────────────────────────── */}
          <section className="prof-card sc-anim-2">
            <h2 className="prof-card-title">{t('profile.aboutMe')}</h2>
            <Field label={t('profile.nickname')} value={s.nickname || '—'} />
            <Field label={t('profile.ageGroup')} value={s.ageGroup ?? '—'} />
            <Field label={t('profile.language')} value={s.language.toUpperCase()} />
            <p className="prof-note">{t('profile.dobNote')}</p>

            {panel !== 'nickname' ? (
              <button className="btn btn-outline" onClick={() => { setDone(null); setDraftName(s.nickname); setPanel('nickname') }}>
                {t('profile.editNickname')}
              </button>
            ) : (
              <div className="prof-panel">
                <input
                  className="sc-input"
                  value={draftName}
                  maxLength={80}
                  onChange={(e) => setDraftName(e.target.value)}
                  aria-label={t('profile.nickname')}
                />
                {error && <div className="note-card pink"><span className="note-card-icon">⚠️</span><span>{error}</span></div>}
                <div className="btn-row">
                  <button className="btn btn-back" onClick={closePanel} disabled={busy}>{t('profile.cancel')}</button>
                  <button className="btn btn-primary" onClick={() => void saveNickname()} disabled={busy}>
                    {t('profile.saveNickname')}
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── School ─────────────────────────────────────────────── */}
          <section className="prof-card sc-anim-3">
            <h2 className="prof-card-title">{t('profile.school')}</h2>
            {hasSchool ? (
              <>
                {s.emis && <Field label={t('profile.emis')} value={s.emis} />}
                {s.schoolName && <Field label={t('profile.schoolName')} value={s.schoolName} />}
                {s.district && <Field label={t('profile.district')} value={s.district} />}
                {s.studentFullName && <Field label={t('profile.studentName')} value={s.studentFullName} />}
              </>
            ) : (
              <p className="prof-note">{t('profile.noSchool')}</p>
            )}
          </section>

          {/* ── Face ───────────────────────────────────────────────── */}
          <section className="prof-card sc-anim-4">
            <h2 className="prof-card-title">{t('profile.faceTitle')}</h2>
            <div className={`note-card ${s.faceRegistered ? 'green' : 'gray'}`}>
              <span className="note-card-icon">{s.faceRegistered ? '✅' : 'ℹ️'}</span>
              <span>{s.faceRegistered ? t('profile.faceOn') : t('profile.faceOff')}</span>
            </div>
            <p className="prof-note">{t('profile.faceNoPhoto')}</p>
            <button className="btn btn-outline" onClick={() => nav(ROUTES.faceRegister)}>
              {t('profile.faceRetake')}
            </button>
          </section>

          {/* ── Choices ────────────────────────────────────────────── */}
          <section className="prof-card sc-anim-5">
            <h2 className="prof-card-title">{t('profile.privacyTitle')}</h2>
            <div className="prof-row">
              <span className="prof-row-k">{t('profile.camera')}</span>
              <Toggle
                label={t('profile.camera')}
                on={s.cameraOptIn}
                onChange={(v) => void setOptIns(v, s.voiceOptIn)}
              />
            </div>
            <div className="prof-row">
              <span className="prof-row-k">{t('profile.voice')}</span>
              <Toggle
                label={t('profile.voice')}
                on={s.voiceOptIn}
                onChange={(v) => void setOptIns(s.cameraOptIn, v)}
              />
            </div>
            <Field label={t('profile.parentConsent')} value={s.parentConsent ? '✓' : '—'} />
            <Field label={t('profile.childAssent')} value={s.childAssent ? '✓' : '—'} />
            <p className="prof-note">{t('profile.consentLocked')}</p>
          </section>

          {/* ── PIN ────────────────────────────────────────────────── */}
          <section className="prof-card sc-anim-6">
            <h2 className="prof-card-title">🔒 PIN</h2>
            {panel !== 'pin' ? (
              <button className="btn btn-outline" onClick={() => { setDone(null); setPanel('pin') }}>
                {t('profile.changePin')}
              </button>
            ) : (
              <div className="prof-panel">
                <p className="prof-note">{t('profile.pinIntro')}</p>

                <div className="field-label">{t('profile.nickname')}</div>
                <input className="sc-input" value={checkName} onChange={(e) => setCheckName(e.target.value)} />

                <div className="field-label">{t('s03.dob')}</div>
                <div className="dob-row">
                  <input className="sc-input" placeholder={t('s03.day')} inputMode="numeric" maxLength={2}
                    value={checkDob.day} onChange={(e) => setCheckDob({ ...checkDob, day: digits(e.target.value, 2) })} />
                  <input className="sc-input" placeholder={t('s03.month')} inputMode="numeric" maxLength={2}
                    value={checkDob.month} onChange={(e) => setCheckDob({ ...checkDob, month: digits(e.target.value, 2) })} />
                  <input className="sc-input" placeholder={t('s03.year')} inputMode="numeric" maxLength={4}
                    value={checkDob.year} onChange={(e) => setCheckDob({ ...checkDob, year: digits(e.target.value, 4) })} />
                </div>

                <div className="field-label">{t('profile.currentPin')}</div>
                <input className="sc-input" type="password" inputMode="numeric" maxLength={4} placeholder="● ● ● ●"
                  value={currentPin} onChange={(e) => setCurrentPin(digits(e.target.value, 4))} />

                <div className="field-label">{t('profile.newPin')}</div>
                <input className="sc-input" type="password" inputMode="numeric" maxLength={4} placeholder="● ● ● ●"
                  value={newPin} onChange={(e) => setNewPin(digits(e.target.value, 4))} />

                <div className="field-label">{t('profile.confirmNewPin')}</div>
                <input className="sc-input" type="password" inputMode="numeric" maxLength={4} placeholder="● ● ● ●"
                  value={confirmPin} onChange={(e) => setConfirmPin(digits(e.target.value, 4))} />

                {error && <div className="note-card pink"><span className="note-card-icon">⚠️</span><span>{error}</span></div>}

                <div className="btn-row">
                  <button className="btn btn-back" onClick={closePanel} disabled={busy}>{t('profile.cancel')}</button>
                  <button
                    className="btn btn-primary"
                    disabled={busy || !checkName.trim() || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
                    onClick={() => void savePin()}
                  >
                    {busy ? <span className="btn-spinner" aria-hidden="true" /> : null}
                    {t('profile.savePin')}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </Screen>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="prof-row">
      <span className="prof-row-k">{label}</span>
      <span className="prof-row-v">{value}</span>
    </div>
  )
}
