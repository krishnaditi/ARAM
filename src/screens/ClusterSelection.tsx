import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession } from '../state/sessionStore'
import { useOnboarding } from '../state/onboardingStore'
import { CLUSTERS } from '../data/clusters'
import { subclusterPath } from '../flow'
import { api } from '../lib/api'

const DEV: DevInfo = {
  screenId: 'C01',
  screenPos: 'Conversational cluster browse',
  branch: [
    { c: 'cluster tapped', a: '→ user echo bubble → 480ms → sub-cluster turn' },
    { c: 'basket.length = 3', a: 'ARAM says the basket is full' },
    { c: 'red item selected', a: '→ Red modal → Red Emergency' },
    { c: 'amber item selected', a: '→ emotion turn → amber reply in-line' },
  ],
  inputs: [{ k: 'CHILD.id', v: 'Current session' }],
  outputs: [],
  triggers: [{ c: 'any cluster tapped', a: '→ sub-cluster conversational turn' }],
  note: 'Conversational shell. Same 8 clusters, same items, same flag tiers as the v4 prototype.',
}

/** C01 — ARAM opens the session and offers the eight clusters. */
export default function ClusterSelection() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const chat = useChatScript()
  const childId = useOnboarding((s) => s.childId)
  const sessionId = useSession((s) => s.sessionId)
  const setSessionId = useSession((s) => s.setSessionId)
  const instant = useSession((s) => s.instant)
  const [showOptions, setShowOptions] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  // Opens the SESSION row once per sitting. C01 is also where the child lands when
  // they back out of a sub-cluster or tap "I want to look at more first", so this must
  // NOT reset anything: the basket they have already built has to survive coming back.
  // The session is cleared when it ends (confirm, leave, logout), not when C01 renders.
  useEffect(() => {
    if (!childId || sessionId) return
    let alive = true
    void api.startSession(childId).then((r) => {
      if (alive) setSessionId(r.sessionId)
    })
    return () => {
      alive = false
    }
  }, [childId, sessionId, setSessionId])

  useEffect(() => {
    setShowOptions(false)
    setPicked(null)
    chat.run(async (s) => {
      await s.say(t('cluster.ui.c01Greet1'), 650)
      await s.say(t('cluster.ui.c01Greet2'), 950)
      await s.say(t('cluster.ui.c01Greet3'), 950)
      s.label(t('cluster.ui.c01Label'))
      setShowOptions(true)
    })
    // chat.run is stable; re-running on t would restart the conversation mid-sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (clusterId: string) => {
    if (picked) return
    setPicked(clusterId)
    chat.user(`${CLUSTERS.find((c) => c.id === clusterId)?.icon} ${t(`cluster.names.${clusterId}`)}`)
    setTimeout(() => nav(subclusterPath(clusterId)), instant ? 0 : 480)
  }

  return (
    <SessionFrame
      progress={18}
      dev={{ ...DEV, inputs: [...DEV.inputs, { k: 'SESSION.id', v: sessionId ?? 'starting…' }] }}
      showBasketBar
      scrollKey={chat.nodes.length}
      alignTop={showOptions}
    >
      <ChatStream nodes={chat.nodes} typing={chat.typing} />
      {showOptions && (
        <div className="rail">
          {CLUSTERS.map((cl, i) => (
            <button
              type="button"
              key={cl.id}
              className={`opt${picked === cl.id ? ' picked' : picked ? ' dim' : ''}`}
              style={{ animationDelay: `${i * 0.07}s` }}
              onClick={() => choose(cl.id)}
            >
              <span className="opt-ic" style={{ background: cl.iconBg }}>
                {cl.icon}
              </span>
              <span className="opt-tx">{t(`cluster.names.${cl.id}`)}</span>
              {picked === cl.id ? <span className="opt-tick">✓</span> : <span className="opt-ch">›</span>}
            </button>
          ))}
        </div>
      )}
    </SessionFrame>
  )
}
