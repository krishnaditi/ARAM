# ARAM

**Automated Resilience & Assessment Module** — a private, gentle wellbeing companion
for students. Responsive PWA (phone / tablet / laptop), English + Tamil, voice + text.

This repo currently implements the **onboarding section** (prototype screens S01–S11)
pixel-matched to the approved design, plus the returning-user home and an always-available
emergency helpline.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI | React 19 + TypeScript + Vite | Fast, tiny builds, industry standard |
| Routing | react-router-dom v7 | Screen flow + consent guards |
| State | Zustand (persisted) | Onboarding state machine; secrets never persisted |
| i18n | react-i18next | English + Tamil, all copy externalised |
| PWA | vite-plugin-pwa | Installable, offline shell, runs on any device |
| Voice | Web Speech API behind `ISpeech` | Free; swappable for Whisper/cloud later |
| Data | Supabase (Postgres + RLS), **ap-south-1 Mumbai** | Low cost, India data residency |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173  (also exposed on your LAN for phone testing)
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
npm run lint       # oxlint
```

Without Supabase env vars the app runs in **mock mode** — the full UI works end-to-end
using local storage, so seniors/owner can review on a preview URL before any backend
exists. Mock mode is dev-only and clearly not secure; it must never touch real data.

## Backend (Supabase)

1. Create a Supabase project in the **ap-south-1 (Mumbai)** region.
2. Run `supabase/migrations/0001_init.sql` (SQL editor or `supabase db push`).
3. Copy `.env.example` → `.env.local` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
   (the **public anon key** only — never the service_role key).

All sensitive logic (PIN hashing/verification via `pgcrypto`, consent writes, session
creation) runs **inside the Mumbai database** through `SECURITY DEFINER` RPCs, so no
personal data is processed outside India. Base tables have RLS enabled with no client
policies — the browser can only call the granted RPCs, never read tables directly.

### Data model (matches the prototype)
- `child` — nickname (no legal name), `age_group` (no DOB), `pin_hash` (bcrypt), consent
  flags + timestamps, camera/voice opt-ins, PIN lockout counters.
- `session` — per-child session number, status, band, red flag.
- `audit_log` — `clinician_alert`, `clinician_alert_reoffer_shown`, etc.

## Deploying for review / approval

Frontend → **Cloudflare Pages** (or Netlify / Vercel), all free tier:
- Build command: `npm run build` · Output directory: `dist`
- `public/_redirects` gives SPA fallback; `public/_headers` sets CSP + security headers.
- Every push/branch gets a unique HTTPS URL — send it to seniors/owner; it opens on any
  phone, tablet, or laptop and is installable as a PWA. Static assets hold no PII, so a
  global CDN is fine; personal data lives only in Supabase Mumbai.

## Security & privacy (built in)

- PIN hashed with bcrypt in-DB; verified server-side; 3 wrong tries locks the account.
- Data minimisation: no full name, no DOB (coarse age band only), biometrics never stored.
- Camera/mic OS permission is only ever requested when the child opts in.
- Both parent consent **and** child assent are required before a session is created
  (enforced by the `finalize_onboarding` RPC and by a client route guard).
- CSP, HSTS, `X-Frame-Options: DENY`, and a locked-down `Permissions-Policy` via `_headers`.
- Reduced-motion and keyboard focus styles for accessibility.

### Confirm before launch (compliance)
- DPDP-compliant **verifiable** parental consent mechanism + retention policy + breach process.
- Signed Supabase DPA / India-region guarantee for the government-school contract.
- **Native Tamil review** of `src/i18n/ta.json` — current strings are a first pass.
- Harden `create_child` / `verify_pin` against anonymous abuse (e.g. EMIS allow-list,
  per-device rate limiting) before public rollout.

## Project structure

```
src/
  screens/    S01Welcome … S11Reoffer, Emergency  (one per prototype screen)
  components/  Screen, BrandLogo, Toggle, PinEntry, MicButton
  styles/      tokens.css, globals.css, screens.css  (ported from the prototype)
  i18n/        en.json, ta.json, index.ts
  state/       onboardingStore.ts  (Zustand; secrets excluded from persistence)
  speech/      ISpeech.ts, webSpeech.ts  (pluggable voice)
  lib/         supabaseClient.ts, api.ts (mock + Supabase), greeting.ts
  flow.ts      route map + progress
  App.tsx      routes + consent guards
supabase/migrations/0001_init.sql   schema + RLS + RPCs
```
