import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EMOTIONS } from '../data/clusters'

/**
 * The "How does that make you feel?" turn. Rendered as an ARAM bubble with the
 * pills inside it, exactly as in the prototype — at least one pill is required
 * before the answer can be sent.
 */
export default function EmotionPrompt({ onConfirm }: { onConfirm: (emotionIds: string[]) => void }) {
  const { t } = useTranslation()
  const [picked, setPicked] = useState<string[]>([])

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <div className="row-bot" data-bot="1">
      <div className="mini-av">💜</div>
      <div className="bub">
        {t('cluster.ui.emotionQ')}
        <div className="pill-wrap">
          {EMOTIONS.map((e) => (
            <button
              type="button"
              key={e.id}
              className={`pill${picked.includes(e.id) ? ' on' : ''}`}
              aria-pressed={picked.includes(e.id)}
              onClick={() => toggle(e.id)}
            >
              <span>{e.em}</span>
              {t(`cluster.emotions.${e.id}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`bub-go${picked.length ? '' : ' wait'}`}
          disabled={!picked.length}
          onClick={() => onConfirm(picked)}
        >
          {picked.length ? t('cluster.ui.emotionGo') : t('cluster.ui.emotionWait')}
        </button>
      </div>
    </div>
  )
}
