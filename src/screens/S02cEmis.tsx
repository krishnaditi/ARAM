import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Screen from '../components/Screen'
import { ROUTES, progressFor } from '../flow'
import { useOnboarding } from '../state/onboardingStore'
import { lookupEmis } from '../lib/emisLookup'

export default function S02cEmis() {
  const nav = useNavigate()
  const { t } = useTranslation()
  const emis = useOnboarding((s) => s.emis)
  const setEmis = useOnboarding((s) => s.setEmis)
  const schoolName = useOnboarding((s) => s.schoolName)
  const district = useOnboarding((s) => s.district)
  const studentFullName = useOnboarding((s) => s.studentFullName)
  const setSchoolLookup = useOnboarding((s) => s.setSchoolLookup)

  const found = Boolean(schoolName)
  const notFound = emis.trim().length > 0 && !found

  const onChange = (value: string) => {
    setEmis(value)
    const record = lookupEmis(value)
    setSchoolLookup(
      record ?? { schoolName: '', district: '', studentFullName: '' },
    )
  }

  const footer = (
    <div className="btn-row">
      <button className="btn btn-back" onClick={() => nav(ROUTES.schoolType)}>
        ← {t('common.back')}
      </button>
      <button className="btn btn-next" disabled={!found} onClick={() => nav(ROUTES.profile)}>
        {t('common.continue')} →
      </button>
    </div>
  )

  return (
    <Screen progress={progressFor(ROUTES.emis)} footer={footer}>
      <div className="bg-gradient">
        <div className="sc-sm">
          <div className="sc-anim-1">
            <div className="field-label">🏫 {t('s02.schoolCode')}</div>
            <input
              className="sc-input"
              placeholder={t('s02.schoolCodePlaceholder')}
              value={emis}
              inputMode="numeric"
              onChange={(e) => onChange(e.target.value)}
            />
            <div className="emis-note" style={{ marginTop: '0.6rem' }}>
              🔒 {t('s02.emisNote')}
            </div>
          </div>

          {found && (
            <div className="summary-card sc-anim-2">
              <div className="summary-row">
                <span className="summary-key">{t('s02c.school')}</span>
                <span className="summary-val yes">{schoolName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-key">{t('s02c.district')}</span>
                <span className="summary-val yes">{district}</span>
              </div>
              <div className="summary-row">
                <span className="summary-key">{t('s02c.studentName')}</span>
                <span className="summary-val yes">{studentFullName}</span>
              </div>
            </div>
          )}

          {notFound && (
            <div className="note-card pink sc-anim-2">
              <span className="note-card-icon">⚠️</span>
              <span>{t('s02c.notFound')}</span>
            </div>
          )}
        </div>
      </div>
    </Screen>
  )
}
