import { isBackendConfigured } from './backendClient'

/**
 * Review tooling (the session dev drawer: branch logic, DB reads/writes, taxonomy
 * integrity, audit log, staff-flag reveal) is available in dev builds and against the
 * local mock. It is never reachable in a real deployment with the PostgreSQL API
 * configured — a child must not be able to see which items are flagged.
 */
export const DEV_TOOLS_AVAILABLE = import.meta.env.DEV || !isBackendConfigured
