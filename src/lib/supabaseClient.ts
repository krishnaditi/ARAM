import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True when a real Supabase backend is configured. When false the app runs in mock mode. */
export const isBackendConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isBackendConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null
