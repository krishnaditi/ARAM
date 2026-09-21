import { parseServerTiming, recordTiming } from './apiTiming'

const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isBackendConfigured = Boolean(baseUrl)

/** The URL the app is talking to. Shown in the debug overlay; never used for requests. */
export const backendBaseUrl = baseUrl ?? ''

export async function backendRequest<T>(path: string, options?: RequestInit): Promise<T> {
  if (!baseUrl) throw new Error('API is not configured')
  // Single choke point for every call in the app, so timing every request costs one
  // wrapper here rather than a change at each call site.
  const method = options?.method ?? 'GET'
  const startedAt = performance.now()
  let response: Response
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    })
  } catch (error) {
    // status 0: the request never reached a server. Recorded too — a request that dies
    // after 40 seconds is the single most useful data point for a cold-start problem.
    recordTiming({ method, path, status: 0, ms: performance.now() - startedAt })
    throw error
  }

  const { appMs, uptimeMs } = parseServerTiming(response.headers.get('Server-Timing'))
  recordTiming({
    method,
    path,
    status: response.status,
    ms: performance.now() - startedAt,
    serverMs: appMs,
    uptimeMs,
  })

  if (!response.ok) {
    // FastAPI sends {"detail": "..."} — unwrap it so screens can show the server's own
    // sentence instead of a blob of JSON. Anything else is passed through as-is.
    const body = await response.text()
    let detail = body
    try {
      const parsed = JSON.parse(body) as { detail?: unknown }
      if (typeof parsed.detail === 'string') detail = parsed.detail
    } catch {
      // Not JSON. The raw body is the best message available.
    }
    throw new Error(detail || `API request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return backendRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}
