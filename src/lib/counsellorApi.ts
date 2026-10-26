/**
 * Talks to the backend's /api/chat, which holds the OpenRouter key and the counsellor
 * prompt. VITE_CHAT_API_URL lets the chat use a backend while the rest of the app stays
 * in offline mock mode; otherwise it uses the same backend as everything else.
 */
const baseUrl = (
  (import.meta.env.VITE_CHAT_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined)
)?.replace(/\/$/, '')

export const isChatConfigured = Boolean(baseUrl)

export interface ChatTopic {
  title: string
  area: string
  feelings: string[]
  own_words: boolean
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export type ChatResult =
  | { ok: true; reply: string; crisis: boolean }
  | { ok: false; reason: 'not_configured' | 'busy' | 'unreachable' | 'failed' }

/** The backend accepts at most 40 turns; the newest ones matter most. */
const MAX_TURNS = 40

export async function askCounsellor(
  language: string,
  topics: ChatTopic[],
  messages: ChatTurn[],
  signal?: AbortSignal,
): Promise<ChatResult> {
  if (!baseUrl) return { ok: false, reason: 'not_configured' }
  let recent = messages.slice(-MAX_TURNS)
  // Keep the history starting on the student's side after trimming.
  while (recent.length && recent[0].role === 'assistant' && recent.length !== messages.length) recent = recent.slice(1)
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language, topics, messages: recent }),
      signal,
    })
    if (response.ok) {
      const body = (await response.json()) as { reply: string; crisis: boolean }
      return { ok: true, reply: body.reply, crisis: Boolean(body.crisis) }
    }
    const detail = await response.json().then((b: { detail?: unknown }) => String(b.detail ?? ''), () => '')
    const reason = detail.replace(/^chat_/, '')
    return { ok: false, reason: reason === 'not_configured' || reason === 'busy' || reason === 'unreachable' ? reason : 'failed' }
  } catch (error) {
    if (signal?.aborted) throw error
    return { ok: false, reason: 'unreachable' }
  }
}
