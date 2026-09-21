const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isBackendConfigured = Boolean(baseUrl)

export async function backendRequest<T>(path: string, options?: RequestInit): Promise<T> {
  if (!baseUrl) throw new Error('API is not configured')
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
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
