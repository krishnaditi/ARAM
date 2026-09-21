import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from '../state/sessionStore'

/**
 * Drives ARAM's side of a conversational screen: typing indicator, then a bubble,
 * then the next line. Replaces the prototype's imperative DOM appends.
 *
 * Every screen runs one script on mount. A script is cancelled when the screen
 * unmounts or another script starts — a cancelled `say()` throws CANCELLED, which
 * `run()` swallows, so the rest of the script simply never executes and no state
 * is touched after the screen has gone.
 */

export type ChatNodeKind = 'bot' | 'user' | 'label' | 'slot'

export interface ChatNode {
  key: number
  kind: ChatNodeKind
  /** Bot lines may carry the small amount of inline HTML the copy uses (<b>, <br>).
   *  For a 'slot' node this is the slot name instead. */
  text: string
  /** Extra class on the bubble, e.g. 'bub-amber'. */
  cls?: string
}

export interface ChatScript {
  /** Types for `ms`, then adds one ARAM bubble. */
  say: (text: string, ms?: number, cls?: string) => Promise<void>
  /** Adds the child's echo bubble immediately. */
  user: (text: string) => void
  /** Adds the small uppercase rail label. */
  label: (text: string) => void
  /** Reserves a position in the stream for the screen to render into — the basket
   *  summary cards sit between two of ARAM's lines, so they need a place in order. */
  slot: (name: string) => void
  pause: (ms: number) => Promise<void>
}

const CANCELLED = Symbol('chat-script-cancelled')

export interface ChatController {
  nodes: ChatNode[]
  typing: boolean
  /** Runs `script` as the screen's conversation, clearing anything before it. */
  run: (script: (s: ChatScript) => Promise<void>) => void
  /** Appends outside a script — for turns driven by a tap rather than by the script. */
  say: (text: string, ms?: number, cls?: string) => Promise<void>
  user: (text: string) => void
  /** Drops the last n nodes — used to retract the emotion prompt once answered. */
  clear: () => void
}

export function useChatScript(): ChatController {
  const instant = useSession((s) => s.instant)
  const [nodes, setNodes] = useState<ChatNode[]>([])
  const [typing, setTyping] = useState(false)
  const seq = useRef(0)
  const nextKey = useRef(0)
  const instantRef = useRef(instant)
  instantRef.current = instant

  // Leaving the screen cancels whatever ARAM was part-way through saying.
  useEffect(() => {
    return () => {
      seq.current += 1
    }
  }, [])

  const sleep = useCallback((ms: number) => {
    return new Promise<void>((r) => setTimeout(r, instantRef.current ? 0 : ms))
  }, [])

  const makeScript = useCallback(
    (token: number): ChatScript => {
      const alive = () => token === seq.current
      const guard = () => {
        if (!alive()) throw CANCELLED
      }
      const push = (node: Omit<ChatNode, 'key'>) => {
        guard()
        setNodes((n) => [...n, { ...node, key: nextKey.current++ }])
      }
      return {
        async say(text, ms = 700, cls) {
          guard()
          setTyping(true)
          await sleep(ms)
          guard()
          setTyping(false)
          push({ kind: 'bot', text, cls })
          await sleep(120)
          guard()
        },
        user(text) {
          push({ kind: 'user', text })
        },
        label(text) {
          push({ kind: 'label', text })
        },
        slot(name) {
          push({ kind: 'slot', text: name })
        },
        async pause(ms) {
          guard()
          await sleep(ms)
          guard()
        },
      }
    },
    [sleep],
  )

  const run = useCallback(
    (script: (s: ChatScript) => Promise<void>) => {
      const token = (seq.current += 1)
      setNodes([])
      setTyping(false)
      void (async () => {
        try {
          await script(makeScript(token))
        } catch (e) {
          if (e !== CANCELLED) throw e
        } finally {
          if (token === seq.current) setTyping(false)
        }
      })()
    },
    [makeScript],
  )

  // Ad-hoc turns (a tap reply) join the CURRENT script's token, so they are
  // cancelled by a navigation exactly like scripted lines are.
  const say = useCallback(
    async (text: string, ms = 650, cls?: string) => {
      const s = makeScript(seq.current)
      try {
        await s.say(text, ms, cls)
      } catch (e) {
        if (e !== CANCELLED) throw e
      }
    },
    [makeScript],
  )

  const user = useCallback(
    (text: string) => {
      try {
        makeScript(seq.current).user(text)
      } catch (e) {
        if (e !== CANCELLED) throw e
      }
    },
    [makeScript],
  )

  const clear = useCallback(() => setNodes([]), [])

  return { nodes, typing, run, say, user, clear }
}
