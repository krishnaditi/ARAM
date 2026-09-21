import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession } from '../state/sessionStore'
import { ITEM_INDEX, canonicalId } from '../data/clusters'
import { ROUTES } from '../flow'
import { api } from '../lib/api'

/**
 * RED — an immediate-risk item was confirmed. The assessment is skipped entirely:
 * red_emergency_flag is set on the SESSION, a red SAFEGUARD_FLAG is written, and the
 * child is taken straight to the helpline screen. No band routing, no questions.
 */
export default function RedEmergency() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { issueId = '' } = useParams()
  const chat = useChatScript()
  const sessionId = useSession((s) => s.sessionId)
  const logEvent = useSession((s) => s.logEvent)
  const [showOptions, setShowOptions] = useState(false)
  // A remount must not raise the same red flag twice.
  const flagged = useRef<string | null>(null)

  useEffect(() => {
    if (flagged.current !== issueId) {
      flagged.current = issueId
      logEvent('red_emergency', `${issueId} · red_emergency_flag=true`)
      const rec = ITEM_INDEX[canonicalId(issueId)]
      void api.raiseSafeguardFlag({
        sessionId,
        issueId,
        severity: 'red',
        clusterId: rec?.clusterId ?? null,
        subId: rec?.subId ?? null,
      })
    }
    chat.run(async (s) => {
      await s.say(t('cluster.ui.redScreen1'), 700)
      await s.say(t('cluster.ui.redScreen2'), 900)
      await s.say(t('cluster.ui.redScreen3'), 900)
      setShowOptions(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId])

  const dev: DevInfo = {
    screenId: 'RED',
    screenPos: 'Red Emergency triggered',
    branch: [{ c: 'red_emergency_flag=true', a: '→ Mandatory stabilisation → helpline → safety plan' }],
    inputs: [{ k: 'red issue', v: issueId }],
    outputs: [
      { k: 'SESSION.red_emergency_flag', v: 'true · written immediately' },
      { k: 'SAFEGUARD_FLAG', v: 'severity=red · issue_id · timestamp · escalation=immediate' },
      { k: 'AUDIT_LOG', v: 'event_type=red_emergency_cluster' },
    ],
    triggers: [{ c: 'always', a: '→ Red Emergency protocol · no assessment · no band routing' }],
    note: 'Red Emergency from cluster selection bypasses the entire assessment.',
  }

  return (
    <SessionFrame progress={100} dev={dev} scrollKey={chat.nodes.length} alignTop={showOptions}>
      <ChatStream nodes={chat.nodes} typing={chat.typing} />
      {showOptions && (
        <div className="rail">
          <button type="button" className="opt opt-red sc-glow" onClick={() => nav(ROUTES.emergency)}>
            <span className="opt-tx">{t('cluster.ui.redScreenGo')}</span>
          </button>
        </div>
      )}
    </SessionFrame>
  )
}
