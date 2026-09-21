import type { ReactNode } from 'react'
import type { ChatNode } from '../lib/useChatScript'

/**
 * Renders the conversation. ARAM's lines come from our own i18n bundle and carry a
 * little inline markup (<b>, <br>, <strong>), so they are set as HTML; the child's
 * own words NEVER are — they go in as text nodes.
 */
export default function ChatStream({
  nodes,
  typing,
  slots,
}: {
  nodes: ChatNode[]
  typing: boolean
  /** Content for `slot` nodes, rendered live so it tracks state changes. */
  slots?: Record<string, ReactNode>
}) {
  return (
    <>
      {nodes.map((n) => {
        if (n.kind === 'user') {
          return (
            <div className="row-user" key={n.key}>
              <div className="bub-user">{n.text}</div>
            </div>
          )
        }
        if (n.kind === 'slot') {
          return <div key={n.key}>{slots?.[n.text] ?? null}</div>
        }
        if (n.kind === 'label') {
          return (
            <div className="rail-label" key={n.key}>
              {n.text}
            </div>
          )
        }
        return (
          <div className="row-bot" key={n.key} data-bot="1">
            <div className="mini-av">💜</div>
            <div
              className={`bub${n.cls ? ' ' + n.cls : ''}`}
              dangerouslySetInnerHTML={{ __html: n.text }}
            />
          </div>
        )
      })}
      {typing && (
        <div className="row-bot typing" data-bot="1">
          <div className="mini-av">💜</div>
          <div className="typing-bub">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </>
  )
}
