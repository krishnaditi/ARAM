export interface EmisRecord {
  schoolName: string
  district: string
  studentFullName: string
}

/**
 * Hardcoded stand-in for the real Tamil Nadu EMIS registry lookup (no database yet — see
 * api.ts for the same mock-vs-Supabase pattern used elsewhere). EMIS 1234 is the only
 * code that resolves, for demoing S02c before the real integration exists.
 */
const MOCK_EMIS_DB: Record<string, EmisRecord> = {
  '1234': {
    schoolName: 'Govt Higher Secondary School, Adyar',
    district: 'Chennai',
    studentFullName: 'Krishna Mitra',
  },
}

export function lookupEmis(code: string): EmisRecord | null {
  return MOCK_EMIS_DB[code.trim()] ?? null
}
