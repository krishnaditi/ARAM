import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { amberCount, useSession } from '../state/sessionStore'
import { useOnboarding } from '../state/onboardingStore'
import { ROUTES } from '../flow'
import { api } from '../lib/api'

type Phase = 'review' | 'empty' | 'confirmed'

/**
 * C05 basket review → C06 confirm. Confirming is the only place CLUSTER_FLAG rows
 * are written: one row per canonical issue id, with the priority rank the child set
 * by the order they picked them.
 */
export default function BasketReview() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const chat = useChatScript()
  const basket = useSession((s) => s.basket)
  const sessionId = useSession((s) => s.sessionId)
  const removeFromBasket = useSession((s) => s.removeFromBasket)
  const resetSession = useSession((s) => s.resetSession)
  const logEvent = useSession((s) => s.logEvent)
  const childId = useOnboarding((s) => s.childId)
  const [phase, setPhase] = useState<Phase>('review')
  const [showOptions, setShowOptions] = useState(false)

  const amber = amberCount(basket)

  // Re-runs whenever the basket changes, so removing an item replays the review
  // with the new list — the same behaviour the prototype got from re-rendering.
  useEffect(() => {
    if (phase === 'confirmed') return
    setShowOptions(false)
    chat.run(async (s) => {
      if (basket.length === 0) {
        setPhase('empty')
        await s.say(t('cluster.ui.basketEmpty'), 600)
        setShowOptions(true)
        return
      }
      setPhase('review')
      await s.say(t('cluster.ui.basketHere'), 650)
      s.slot('basket')
      await s.pause(500)
      await s.say(t('cluster.ui.basketReady'), 700)
      setShowOptions(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket.length, phase === 'confirmed'])

  const dev: DevInfo =
    phase === 'confirmed'
      ? {
          screenId: 'C06',
          screenPos: 'Basket confirmed',
          branch: [{ c: 'always', a: '→ Assessment begins · body sensation screen' }],
          inputs: [{ k: 'basket[]', v: 'Final confirmed issues' }],
          outputs: [
            { k: 'CLUSTER_FLAG (all rows)', v: 'written now · one row per canonical issue_id' },
            { k: 'SESSION.status', v: 'assessment_started' },
            { k: 'SESSION.amber_count', v: String(amber) },
          ],
          triggers: [{ c: 'always', a: '→ Assessment screen 1 (body sensation) — NOT BUILT, returns to /home' }],
          note: 'Amber count carried into the assessment so band routing can weight safeguarding load alongside symptom severity.',
        }
      : {
          screenId: 'C05',
          screenPos: 'Basket review',
          branch: [
            { c: 'basket.length > 0 + begin', a: '→ Write CLUSTER_FLAG rows → Assessment' },
            { c: 'basket.length = 0', a: 'Begin not offered' },
            { c: 'Remove item', a: 'Removed from basket · SAFEGUARD_FLAG stays' },
          ],
          inputs: [{ k: 'basket[]', v: 'All selected issues with emotions and ranks' }],
          outputs: [
            {
              k: 'CLUSTER_FLAG (all)',
              v: 'session_id · issue_id (canonical) · cluster · sub · priority_rank · feeling_tags · free_text · entry_sub',
            },
            { k: 'UNIQUE constraint', v: '(session_id, issue_id) · a cross-listed item cannot produce two rows' },
            { k: 'SESSION.amber_count', v: String(amber) },
          ],
          triggers: [{ c: 'begin', a: '→ Assessment screen 1 (body sensation)' }],
          note:
            'Removing an amber item removes it from the basket but does NOT retract the SAFEGUARD_FLAG. ' +
            'A disclosure, once made, is not un-made by a tap.',
        }

  const confirm = () => {
    logEvent('cluster_selection_complete', `n_issues=${basket.length} · amber=${amber}`)
    void api.saveClusterSelection({ sessionId, childId, items: basket })
    setPhase('confirmed')
    setShowOptions(false)
    chat.run(async (s) => {
      await s.say(t('cluster.ui.confirm1'), 700)
      await s.say(t('cluster.ui.confirm2', { count: basket.length }), 900)
      await s.say(t('cluster.ui.confirm3'), 900)
      setShowOptions(true)
    })
  }

  const finish = () => {
    resetSession()
    nav(ROUTES.home)
  }

  const summary = (
    <div className="sum-list">
      {basket.map((item, i) => (
        <div className="sum" key={item.issueId} style={{ animationDelay: `${i * 0.09}s` }}>
          <div className="sum-r">{i + 1}</div>
          <div className="sum-main">
            <div className="sum-t">{item.free ? item.freeText : t(`cluster.items.${item.issueId}`)}</div>
            <div className="sum-m">
              <span>{t(`cluster.names.${item.clusterId}`)}</span>
              {item.free && <span className="sum-chip sum-chip-free">{t('cluster.ui.freeTag')}</span>}
              {item.emotions.map((id) => (
                <span className="sum-chip" key={id}>
                  {t(`cluster.emotions.${id}`)}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            className="sum-x"
            aria-label={t('cluster.ui.basketRemove')}
            onClick={() => removeFromBasket(item.issueId)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )

  return (
    <SessionFrame
      progress={phase === 'confirmed' ? 100 : 78}
      dev={dev}
      warnOnLeave={phase !== 'confirmed'}
      scrollKey={`${chat.nodes.length}-${basket.length}`}
      alignTop={showOptions && phase !== 'review'}
    >
      <ChatStream nodes={chat.nodes} typing={chat.typing} slots={{ basket: summary }} />

      {showOptions && phase === 'empty' && (
        <div className="rail">
          <button type="button" className="opt opt-other" onClick={() => nav(ROUTES.cluster)}>
            <span className="opt-tx">{t('cluster.ui.basketEmptyBack')}</span>
          </button>
        </div>
      )}

      {showOptions && phase === 'review' && (
        <div className="rail">
          <button type="button" className="opt" onClick={confirm}>
            <span className="opt-ic opt-ic-brand">✨</span>
            <span className="opt-tx">{t('cluster.ui.basketGo')}</span>
            <span className="opt-ch">›</span>
          </button>
          <button type="button" className="opt opt-other" onClick={() => nav(ROUTES.cluster)}>
            <span className="opt-tx">{t('cluster.ui.basketMore')}</span>
          </button>
        </div>
      )}

      {showOptions && phase === 'confirmed' && (
        <div className="rail">
          <button type="button" className="opt" onClick={finish}>
            <span className="opt-ic opt-ic-brand">→</span>
            <span className="opt-tx">{t('cluster.ui.confirmGo')}</span>
            <span className="opt-ch">›</span>
          </button>
        </div>
      )}
    </SessionFrame>
  )
}
