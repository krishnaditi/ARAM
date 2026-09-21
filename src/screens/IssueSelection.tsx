import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SessionFrame from '../components/SessionFrame'
import ChatStream from '../components/ChatStream'
import EmotionPrompt from '../components/EmotionPrompt'
import type { DevInfo } from '../components/SessionDevPanel'
import { useChatScript } from '../lib/useChatScript'
import { useSession, type BasketEntry } from '../state/sessionStore'
import {
  BASKET_MAX,
  EMOTIONS,
  ITEM_INDEX,
  canonicalId,
  findCluster,
  findSub,
  subItems,
  type FlagLevel,
} from '../data/clusters'
import { ROUTES, redEmergencyPath, subclusterPath } from '../flow'
import { api } from '../lib/api'

/** The issue awaiting its "how does that feel?" answer before it enters the basket. */
interface Pending {
  issueId: string
  flag: FlagLevel
  /** Set only when the child typed their own words. */
  freeText?: string
}

/** C03 — the item list. Every basket entry, flag and free-text disclosure starts here. */
export default function IssueSelection() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { clusterId = '', subId = '' } = useParams()
  const cluster = findCluster(clusterId)
  const sub = findSub(cluster, subId)
  const chat = useChatScript()

  const basket = useSession((s) => s.basket)
  const addToBasket = useSession((s) => s.addToBasket)
  const removeFromBasket = useSession((s) => s.removeFromBasket)
  const logEvent = useSession((s) => s.logEvent)
  const sessionId = useSession((s) => s.sessionId)
  const staffView = useSession((s) => s.staffView)

  const [showOptions, setShowOptions] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [redIssueId, setRedIssueId] = useState<string | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)

  useEffect(() => {
    if (!sub) return
    setShowOptions(false)
    setPending(null)
    setRedIssueId(null)
    setComposerOpen(false)
    chat.run(async (s) => {
      await s.say(`${sub.emoji} <b>${t(`cluster.subs.${sub.id}`)}</b>`, 600)
      await s.say(t('cluster.ui.c03Intro', { max: BASKET_MAX }), 900)
      setShowOptions(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, subId])

  if (!cluster || !sub) return <Navigate to={ROUTES.cluster} replace />

  const dev: DevInfo = {
    screenId: 'C03',
    screenPos: t(`cluster.subs.${sub.id}`),
    branch: [
      { c: 'item · f = false', a: '→ emotion turn → basket' },
      { c: 'item · f = amber', a: '→ emotion turn → amber reply · session continues' },
      { c: 'item · f = red', a: '→ Red modal → Red Emergency · assessment skipped' },
      { c: "'Something else'", a: '→ composer unlocks → free text → emotion turn' },
      { c: `basket = ${BASKET_MAX}`, a: 'ARAM declines further picks' },
    ],
    inputs: [
      { k: 'basket[]', v: 'Existing selections shown ticked' },
      { k: 'basket.length', v: `${basket.length} · max ${BASKET_MAX}` },
      { k: 'staff_view', v: staffView ? 'ON · flags visible (review only)' : 'OFF · flags hidden from child' },
    ],
    outputs: [
      { k: 'CLUSTER_FLAG', v: 'Written on basket confirm, not per tap' },
      { k: 'SAFEGUARD_FLAG', v: 'Written immediately on amber or red' },
      { k: 'FREE_TEXT_ISSUE', v: 'Written when the composer is used' },
    ],
    triggers: [
      { c: `f = false + basket<${BASKET_MAX}`, a: '→ emotion turn' },
      { c: 'f = amber', a: '→ emotion turn → amber reply · SAFEGUARD_FLAG severity=amber' },
      { c: 'f = red', a: '→ Red modal · reversible once · then mandatory protocol' },
    ],
    note:
      'Borrowed items render identically for the child. On selection the CANONICAL cluster and sub are written; ' +
      'the tapped location is stored as entry_sub for browse-path analysis only. One canonical id = one row = one count.',
  }

  const selectedIds = basket.map((b) => b.issueId)
  const rendered = subItems(sub)
  const itemText = (id: string) => t(`cluster.items.${id}`)

  const tapIssue = async (issueId: string) => {
    const rec = ITEM_INDEX[canonicalId(issueId)]
    if (!rec || pending) return

    if (rec.iss.f === 'red') {
      logEvent('red_flag_tap', `${rec.iss.id} · ${sub.id}`)
      setRedIssueId(rec.iss.id)
      return
    }
    if (basket.length >= BASKET_MAX) {
      chat.user(itemText(rec.iss.id))
      await chat.say(t('cluster.ui.c03Full', { max: BASKET_MAX }), 600)
      return
    }
    chat.user(itemText(rec.iss.id))
    setPending({ issueId: rec.iss.id, flag: rec.iss.f })
  }

  const confirmEmotion = async (emotionIds: string[]) => {
    if (!pending) return
    const rec = ITEM_INDEX[canonicalId(pending.issueId)]
    const entry: Omit<BasketEntry, 'rank'> = {
      issueId: pending.issueId,
      freeText: pending.freeText,
      clusterId: rec?.clusterId ?? cluster.id,
      subId: rec?.subId ?? sub.id,
      entryClusterId: cluster.id,
      entrySubId: sub.id,
      borrowedEntry: Boolean(rec && rec.subId !== sub.id),
      emotions: emotionIds,
      flag: pending.flag,
      free: Boolean(pending.freeText),
    }
    addToBasket(entry)
    setPending(null)
    chat.user(
      emotionIds
        .map((id) => `${EMOTIONS.find((e) => e.id === id)?.em} ${t(`cluster.emotions.${id}`)}`)
        .join('  '),
    )

    if (pending.flag === 'amber') {
      logEvent('amber_flag', `${pending.issueId} · SAFEGUARD_FLAG severity=amber`)
      // Written straight away, not on basket confirm: a disclosure that a child
      // then backs out of still happened, and staff still need to see it.
      void api.raiseSafeguardFlag({
        sessionId,
        issueId: pending.issueId,
        severity: 'amber',
        clusterId: entry.clusterId,
        subId: entry.subId,
      })
      await chat.say(t('cluster.ui.c03Amber'), 850, 'bub-amber')
    } else {
      await chat.say(t('cluster.ui.c03Thanks'), 650)
    }
  }

  const openOther = async () => {
    if (pending) return
    if (basket.length >= BASKET_MAX) {
      await chat.say(t('cluster.ui.c03FullShort', { max: BASKET_MAX }), 500)
      return
    }
    await chat.say(t('cluster.ui.freePrompt'), 650)
    setComposerOpen(true)
  }

  // Numbered by what is actually free in this sub-cluster, not by basket length:
  // add-then-remove-then-add would otherwise reuse an id, and the basket dedupes on
  // id, so the child's second sentence would silently disappear.
  const nextFreeId = () => {
    let n = 1
    while (basket.some((b) => b.issueId === `free_${sub.id}_${n}`)) n += 1
    return `free_${sub.id}_${n}`
  }

  const sendFreeText = (value: string) => {
    setComposerOpen(false)
    chat.user(value)
    logEvent('free_text_issue', `${sub.id} · ${value.length} chars`)
    setPending({ issueId: nextFreeId(), flag: false, freeText: value })
  }

  const confirmRed = () => {
    if (!redIssueId) return
    nav(redEmergencyPath(redIssueId))
  }

  // The revert path exists so a curious or accidental tap is not punished. Without it,
  // children learn to avoid the items you most need them to touch.
  const revertRed = () => {
    if (!redIssueId) return
    logEvent('red_flag_reverted', `${redIssueId} · no protocol triggered · soft signal retained`)
    setRedIssueId(null)
  }

  const railLocked = Boolean(pending)

  return (
    <SessionFrame
      progress={58}
      dev={dev}
      showBasketBar
      composer={composerOpen ? { placeholder: t('cluster.ui.freePlaceholder'), onSend: sendFreeText } : null}
      scrollKey={`${chat.nodes.length}-${pending ? 1 : 0}-${basket.length}`}
      alignTop={showOptions && !pending}
    >
      <ChatStream nodes={chat.nodes} typing={chat.typing} />
      {pending && <EmotionPrompt onConfirm={confirmEmotion} />}

      {showOptions && (
        <div className={`rail${railLocked ? ' rail-locked' : ''}`}>
          {rendered.map((entry, i) => {
            const iss = entry.iss
            const isSel = selectedIds.includes(iss.id)
            const bItem = basket.find((b) => b.issueId === iss.id)
            const staffCls =
              staffView && !isSel && iss.f === 'red'
                ? ' staff-red'
                : staffView && !isSel && iss.f === 'amber'
                  ? ' staff-amber'
                  : ''
            return (
              <button
                type="button"
                key={iss.id}
                className={`opt opt-issue${isSel ? ' sel' : ''}${staffCls}`}
                style={{ animationDelay: `${i * 0.035}s` }}
                aria-pressed={isSel}
                onClick={() => (isSel ? removeFromBasket(iss.id) : void tapIssue(iss.id))}
              >
                <span className={`opt-cb${isSel ? ' on' : ''}`}>{isSel ? '✓' : ''}</span>
                <span className="opt-tx">
                  {itemText(iss.id)}
                  {staffView && iss.f === 'red' && <span className="staff-badge sb-red">RED</span>}
                  {staffView && iss.f === 'amber' && <span className="staff-badge sb-amber">AMB</span>}
                  {staffView && entry.borrowed && (
                    <span className="staff-badge sb-xref">
                      XREF · {t(`cluster.subs.${entry.homeSubId}`)}
                    </span>
                  )}
                  {isSel && bItem && bItem.emotions.length > 0 && (
                    <span className="feeling-tag">
                      {bItem.emotions
                        .map((id) => `${EMOTIONS.find((e) => e.id === id)?.em} ${t(`cluster.emotions.${id}`)}`)
                        .join(' · ')}
                    </span>
                  )}
                </span>
              </button>
            )
          })}

          <button type="button" className="opt opt-other" onClick={() => void openOther()}>
            <span className="opt-tx">{t('cluster.ui.c03Other')}</span>
          </button>
          <button type="button" className="opt opt-other" onClick={() => nav(subclusterPath(cluster.id))}>
            <span className="opt-tx">{t('cluster.ui.c03Back')}</span>
          </button>
        </div>
      )}

      {redIssueId && (
        <div className="flag-bg" role="dialog" aria-modal="true">
          <div className="flag-card">
            <span className="flag-icon">💜</span>
            <div className="flag-title">{t('cluster.ui.redTitle')}</div>
            <div className="flag-body" dangerouslySetInnerHTML={{ __html: t('cluster.ui.redBody') }} />
            <button type="button" className="flag-btn" onClick={confirmRed}>
              {t('cluster.ui.redConfirm')}
            </button>
            <button type="button" className="flag-btn2" onClick={revertRed}>
              {t('cluster.ui.redRevert')}
            </button>
            <div className="flag-note">{t('cluster.ui.redNote')}</div>
          </div>
        </div>
      )}
    </SessionFrame>
  )
}
