import { isBackendConfigured } from './backendClient'

/**
 * Review tooling (the session dev drawer: branch logic, DB reads/writes, taxonomy
 * integrity, audit log, staff-flag reveal) is available in dev builds and against the
 * local mock. It is never reachable in a real deployment with the PostgreSQL API
 * configured — a child must not be able to see which items are flagged.
 */
export const DEV_TOOLS_AVAILABLE = import.meta.env.DEV || !isBackendConfigured

const DEBUG_KEY = 'aram.debug'

/**
 * Gate for the debug state overlay, which is a SEPARATE and much weaker thing than
 * DEV_TOOLS_AVAILABLE above. The overlay shows only this device's own state and its own
 * API timings — nothing about any other child, and nothing about which taxonomy items
 * are flagged — so it is safe to switch on in a real deployment, which is precisely
 * where a latency or "why is this screen different" problem has to be diagnosed.
 *
 * Turn it on from the browser console on the affected device:
 *     localStorage.setItem('aram.debug', '1')
 * and off again with localStorage.removeItem('aram.debug').
 */
export function isDebugOverlayEnabled(): boolean {
  if (DEV_TOOLS_AVAILABLE) return true
  try {
    return localStorage.getItem(DEBUG_KEY) === '1'
  } catch {
    // Storage blocked (managed Chromebooks, strict privacy modes). No overlay, no crash.
    return false
  }
}
