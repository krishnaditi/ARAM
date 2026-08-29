const baseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')

export const isBackendConfigured = Boolean(baseUrl)

export async function backendRequest<T>(path: string, options?: RequestInit): Promise<T> {
  if (!baseUrl) throw new Error('API is not configured')
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || `API request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function post<T>(path: string, body: unknown): Promise<T> {
  return backendRequest<T>(path, { method: 'POST', body: JSON.stringify(body) })
}
