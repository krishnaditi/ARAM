import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession } from '../state/sessionStore'
import { findCluster, subItems } from '../data/clusters'
import { ROUTES, issuesPath } from '../flow'

/** C02 — having chosen a cluster, the child narrows it to one sub-cluster. */
export default function SubclusterSelection() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { clusterId = '' } = useParams()
  const cluster = findCluster(clusterId)
  const chat = useChatScript()
  const instant = useSession((s) => s.instant)
  const [showOptions, setShowOptions] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    if (!cluster) return
    setShowOptions(false)
    setPicked(null)
    chat.run(async (s) => {
      await s.say(t(`cluster.desc.${cluster.id}`), 700)
      await s.say(`<b>${t(`cluster.pill.${cluster.id}`)}</b>`, 800)
      s.label(t('cluster.ui.c02Label'))
      setShowOptions(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId])

  if (!cluster) return <Navigate to={ROUTES.cluster} replace />

  const dev: DevInfo = {
    screenId: 'C02',
    screenPos: `${t(`cluster.names.${cluster.id}`)} — sub-clusters`,
    branch: [
      { c: 'sub-cluster tapped', a: '→ user echo → issue turn' },
      { c: "'Actually, something else'", a: '→ back to cluster turn' },
    ],
    inputs: [{ k: 'cluster.id', v: `"${cluster.id}" loaded` }],
    outputs: [],
    triggers: [{ c: 'sub-cluster tapped', a: '→ openSub(id)' }],
    note: 'Counts include cross-listed placements; canonical definitions are unchanged.',
  }

  const choose = (subId: string) => {
    if (picked) return
    const sub = cluster.subs.find((s) => s.id === subId)
    setPicked(subId)
    chat.user(`${sub?.emoji} ${t(`cluster.subs.${subId}`)}`)
    setTimeout(() => nav(issuesPath(cluster.id, subId)), instant ? 0 : 480)
  }

  return (
    <SessionFrame progress={38} dev={dev} showBasketBar scrollKey={chat.nodes.length} alignTop={showOptions}>
      <ChatStream nodes={chat.nodes} typing={chat.typing} />
      {showOptions && (
        <div className="rail">
          {cluster.subs.map((sc, i) => (
            <button
              type="button"
              key={sc.id}
              className={`opt${picked === sc.id ? ' picked' : picked ? ' dim' : ''}`}
              style={{ animationDelay: `${i * 0.06}s` }}
              onClick={() => choose(sc.id)}
            >
              <span className="opt-ic opt-ic-soft">{sc.emoji}</span>
              <span className="opt-body">
                <span className="opt-tx">{t(`cluster.subs.${sc.id}`)}</span>
                <span className="opt-sub">
                  {t('cluster.ui.c02Count', { count: subItems(sc).length })}
                </span>
              </span>
              {picked === sc.id ? <span className="opt-tick">✓</span> : <span className="opt-ch">›</span>}
            </button>
          ))}
          <button
            type="button"
            className={`opt opt-other${picked ? ' dim' : ''}`}
            style={{ animationDelay: `${cluster.subs.length * 0.06}s` }}
            onClick={() => nav(ROUTES.cluster)}
          >
            <span className="opt-tx">{t('cluster.ui.c02Back')}</span>
          </button>
        </div>
      )}
    </SessionFrame>
  )
}
