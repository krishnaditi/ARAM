# ARAM

**Automated Resilience & Assessment Module** — a private, gentle wellbeing companion
for students. Responsive PWA (phone / tablet / laptop), English + Tamil, voice + text.

This repo currently implements the **onboarding section** (prototype screens S01–S11)
pixel-matched to the approved design, plus the returning-user home and an always-available
emergency helpline. The login page also includes prototype role entry for students, parents,
headmasters, psychologists/counsellors, and admins. Staff registration and face sign-in use
local browser storage for UI review; staff dashboards are static until a staff backend is added.

---

## Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI | React 19 + TypeScript + Vite | Fast, tiny builds, industry standard |
| Routing | react-router-dom v7 | Screen flow + consent guards |
| State | Zustand (persisted) | Onboarding state machine; secrets never persisted |
| i18n | react-i18next | English + Tamil, all copy externalised |
| PWA | vite-plugin-pwa | Installable, offline shell, runs on any device |
| Voice in | Web Speech API behind `ISpeech` | Free; swappable for Whisper/cloud later |
| Voice out | Pre-rendered clips (AI4Bharat **Indic Parler-TTS**, Apache 2.0) | Covers English *and* Tamil; identical on every browser; no runtime cost |
| Data/API | PostgreSQL + FastAPI + Pydantic | Local or self-hosted deployment |

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173  (also exposed on your LAN for phone testing)
npm run build      # production build -> dist/
npm run preview    # serve the production build locally
npm run lint       # oxlint
```

Without `VITE_API_URL` the app runs in **mock mode** for UI review. With the local stack
running, registrations and student onboarding data are stored in PostgreSQL through the
FastAPI/Pydantic API.

### Role login prototype

Selecting **Student** opens the existing PIN/face login and onboarding flow. Parent,
headmaster, and psychologist/counsellor users register a name and face, then are signed in
automatically to a basic role dashboard. Admin uses the prototype credentials `admin` /
`aram-admin`. These staff accounts and face descriptors are local demo data only and must be
replaced with authenticated backend records before deployment.

## Local PostgreSQL backend

1. Start PostgreSQL and the API with `sudo docker compose up -d --build`.
2. Copy `.env.example` to `.env.local`.
3. Run the frontend with `npm run dev`.
4. Apply `supabase/migrations/0002_user_roles_and_student_details.sql` manually only if
  the database volume already existed before that migration was added.

The API is the only browser-facing database boundary. PIN hashing/verification and consent
logic run through PostgreSQL functions; the browser never receives database credentials.

### Data model (matches the prototype)
- `app_user` — one identity for every student, parent, headmaster, counsellor, and admin,
  including role and preferred language.
- `staff_profile`, `user_school`, `parent_student` — staff metadata, school access, and
  parent-child relationships.
- `student_profile`, `student_consent`, `student_preference` — detailed student data with
  coarse age group and privacy/consent controls; no DOB is stored.
- `student_assessment`, `student_support_event` — structured wellbeing responses and
  audited support/referral events.
- `child` — nickname (no legal name), `age_group` (no DOB), `pin_hash` (bcrypt), consent
  flags + timestamps, camera/voice opt-ins, PIN lockout counters.
- `session` — per-child session number, status, band, red flag.
- `audit_log` — `clinician_alert`, `clinician_alert_reoffer_shown`, etc.

The API source is in `backend/main.py`, with Pydantic request validation in the same service.
The local connection details and ERD are documented in `docs/ERD.md`.

## ARAM's voice (text-to-speech)

ARAM reads its own words aloud so a child who reads slowly — or not at all — can still use
it. Which lines are spoken is declared in `src/speech/spokenKeys.ts`; `<Screen>` speaks a
route's lines on entry, so voice follows the route map instead of being wired per screen.

Clips are **pre-rendered offline** and shipped as static MP3s, not synthesised at runtime:

- Browser TTS has no Tamil voice on most devices and none at all on Firefox, so a Tamil
  child would hear silence. Files behave identically in every browser.
- The ~27 spoken lines are the same for all 15,000 users, so runtime synthesis would
  regenerate identical sentences thousands of times, and Vercel has no GPU to do it on.
- Files can be **listened to and signed off** by a native Tamil reviewer before release.
  No on-device engine allows that.

```bash
pip install git+https://github.com/AI4Bharat/IndicF5.git soundfile numpy
python scripts/render_tts.py --dry-run          # review exactly what will be spoken
python scripts/render_tts.py --ref-en ref_en.wav --ref-en-text "…" \
                             --ref-ta ref_ta.wav --ref-ta-text "…"
```

Run it once on a free GPU (Kaggle/Colab) and commit `public/audio/`. IndicF5 is
prompt-based, so it needs one clean 5–10s reference recording per language plus its exact
transcript — record your own, both for a consistent ARAM voice and because IndicF5's terms
require permission for any cloned voice. Until clips exist the app is simply silent.

**Privacy rules built into the feature.** ARAM never speaks the nickname or the PIN — lines
containing `{{name}}` have name-free `*Spoken` variants, and the render script refuses any
string with interpolation in it. The Emergency and S11 re-offer screens are **tap-to-play
only**: that copy names self-harm, ARAM is used in classrooms, and the children it helps
most are the ones for whom being overheard does the most harm. A mute control sits in the
app frame on every speaking screen and its setting persists.

## Deploying for review / approval

Frontend → **Cloudflare Pages** (or Netlify / Vercel), all free tier:
- Build command: `npm run build` · Output directory: `dist`
- `public/_redirects` gives SPA fallback; `public/_headers` sets CSP + security headers.
- Every push/branch gets a unique HTTPS URL — send it to seniors/owner; it opens on any
  phone, tablet, or laptop and is installable as a PWA. Static assets hold no PII, so a
  global CDN is fine; personal data stays in the PostgreSQL deployment.

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
- Hosting DPA / India-region guarantee for the government-school contract.
- **Native Tamil review** of `src/i18n/ta.json` — current strings are a first pass. This now
  covers the rendered Tamil **audio** too: listen to every clip in `public/audio/ta/`.
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
  speech/      ISpeech.ts, webSpeech.ts (voice in)
               spokenKeys.ts, audioTts.ts, useSpeak.ts (voice out)
  lib/         backendClient.ts, api.ts (mock + PostgreSQL API), greeting.ts
  flow.ts      route map + progress
  App.tsx      routes + consent guards
public/audio/{en,ta}/*.mp3          rendered voice clips (see "ARAM's voice")
scripts/render_tts.py               one-time IndicF5 render
supabase/migrations/*.sql           PostgreSQL schema + RLS + RPCs
backend/main.py                     FastAPI + Pydantic API
vercel.json                         SPA rewrite + security headers (Vercel ignores _headers)
```
