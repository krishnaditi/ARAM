/**
 * A small ring buffer of recent API call timings.
 *
 * Every request goes through backendClient, so recording there catches all of them for
 * free. The point is to answer "was that slow, and whose fault was it" without anyone
 * having to reproduce the problem with DevTools already open — which is exactly the
 * situation you are never in when a teacher reports that the app hung.
 */

export interface ApiTiming {
  method: string
  path: string
  /** 0 when the request never got a response (network failure, timeout). */
  status: number
  /** Round trip as the browser saw it. */
  ms: number
  /** Handler time the server reported via Server-Timing, when it is readable. */
  serverMs?: number
  /**
   * True when the server said its process was only seconds old — the request paid for
   * a container boot. On Render's free plan this is the usual reason for a long wait.
   */
  coldStart?: boolean
  at: number
}

/** Slower than this and it is worth a console warning even in production. */
export const SLOW_REQUEST_MS = 2000

/** A process younger than this served a request that almost certainly cold-started. */
const COLD_START_UPTIME_MS = 15000

const RING_SIZE = 25

let timings: ApiTiming[] = []
const listeners = new Set<() => void>()

/** Parses `app;dur=12.3;desc="handler", uptime;dur=450` into its parts. */
export function parseServerTiming(header: string | null): { appMs?: number; uptimeMs?: number } {
  if (!header) return {}
  const read = (name: string): number | undefined => {
    const match = new RegExp(`(?:^|,)\\s*${name}\\s*;[^,]*?dur=([0-9.]+)`).exec(header)
    return match ? Number(match[1]) : undefined
  }
  return { appMs: read('app'), uptimeMs: read('uptime') }
}

export function recordTiming(entry: Omit<ApiTiming, 'at'> & { uptimeMs?: number }): void {
  const { uptimeMs, ...rest } = entry
  const timing: ApiTiming = {
    ...rest,
    coldStart: uptimeMs !== undefined && uptimeMs < COLD_START_UPTIME_MS,
    at: Date.now(),
  }
  // Replaced rather than mutated: useSyncExternalStore compares snapshots by identity.
  timings = [...timings, timing].slice(-RING_SIZE)
  for (const listener of listeners) listener()

  if (timing.ms >= SLOW_REQUEST_MS) {
    console.warn(
      `[aram] slow API call: ${timing.method} ${timing.path} took ${Math.round(timing.ms)}ms` +
        (timing.serverMs !== undefined ? ` (server ${Math.round(timing.serverMs)}ms)` : '') +
        (timing.coldStart ? ' — server had just cold-started' : ''),
    )
  } else if (import.meta.env.DEV) {
    console.debug(`[aram] ${timing.method} ${timing.path} ${Math.round(timing.ms)}ms`)
  }
}

export function subscribeToTimings(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getTimings(): ApiTiming[] {
  return timings
}
