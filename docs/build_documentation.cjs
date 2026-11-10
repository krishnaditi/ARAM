// Regenerates docs/ARAM_Documentation.docx. The counsellor prompt is read live from
// backend/counsellor.py. Run:  npm i --no-save docx@9 && node docs/build_documentation.cjs
const fs = require('fs')
const path = require('path')
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, AlignmentType, LevelFormat, TableOfContents, Header, Footer, PageNumber,
  BorderStyle, PageBreak,
} = require('docx')

const REPO = path.resolve(__dirname, '..')
const OUT = path.join(REPO, 'docs', 'ARAM_Documentation.docx')
const counsellorSrc = fs.readFileSync(path.join(REPO, 'backend/counsellor.py'), 'utf8')
const SYSTEM_PROMPT = counsellorSrc.match(/SYSTEM_PROMPT = """([\s\S]*?)"""/)[1]
const OPENING = counsellorSrc.match(/OPENING_INSTRUCTION = \(\s*([\s\S]*?)\n\)/)[1]
  .split('\n').map((l) => l.trim().replace(/^"|"$/g, '')).join('')
const CRISIS = counsellorSrc.match(/CRISIS_PATTERN = re\.compile\(\s*([\s\S]*?),\s*re\.IGNORECASE/)[1]
  .split('\n').map((l) => l.trim().replace(/^r"|"$/g, '')).join('')
const MODEL = counsellorSrc.match(/DEFAULT_MODEL = "([^"]+)"/)[1]

const PURPLE = '5B3AA8'
const CONTENT_W = 9026 // A4 width minus 1" margins, in DXA
const FONT = 'Calibri'
const MONO = 'Consolas'

// ── inline markup: **bold** and `code` ──────────────────────────────────────
function runs(text, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }))
    const tok = m[0]
    if (tok.startsWith('**')) out.push(new TextRun({ text: tok.slice(2, -2), bold: true, ...base }))
    else out.push(new TextRun({ text: tok.slice(1, -1), font: MONO, size: 19, color: '3A2A6E', ...base }))
    last = m.index + tok.length
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }))
  return out
}

const body = []
const h1 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: true, children: [new TextRun(t)] }))
const h2 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: [new TextRun(t)] }))
const h3 = (t) => body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: [new TextRun(t)] }))
const p = (t, keepNext = false) => body.push(new Paragraph({ spacing: { after: 140 }, keepNext, children: runs(t) }))
const bullets = (items, level = 0) => items.forEach((t) =>
  body.push(new Paragraph({ numbering: { reference: 'bullets', level }, spacing: { after: 60 }, children: runs(t) })))
const steps = (items) => {
  const ref = `steps${body.length}`
  numberingRefs.push(ref)
  items.forEach((t) => body.push(new Paragraph({ numbering: { reference: ref, level: 0 }, spacing: { after: 60 }, children: runs(t) })))
}
const numberingRefs = []

function code(text) {
  text.replace(/\s+$/, '').split('\n').forEach((line, i, all) => body.push(new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: 'F3F0FA', color: 'auto' },
    spacing: { before: i === 0 ? 80 : 0, after: i === all.length - 1 ? 160 : 0 },
    indent: { left: 120, right: 120 },
    children: [new TextRun({ text: line || ' ', font: MONO, size: 17 })],
  })))
}

function note(t) {
  body.push(new Paragraph({
    shading: { type: ShadingType.CLEAR, fill: 'FFF6E0', color: 'auto' },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: 'E0A800', space: 8 } },
    spacing: { before: 80, after: 160 },
    indent: { left: 160 },
    children: runs(t),
  }))
}

function table(headers, rows, widths) {
  const total = widths.reduce((a, b) => a + b, 0)
  const scaled = widths.map((w) => Math.floor((w / total) * CONTENT_W))
  scaled[scaled.length - 1] += CONTENT_W - scaled.reduce((a, b) => a + b, 0)
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'D9D2EC' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cell = (text, i, head) => new TableCell({
    width: { size: scaled[i], type: WidthType.DXA },
    borders,
    shading: head ? { type: ShadingType.CLEAR, fill: 'E9E2F7', color: 'auto' } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: String(text).split('\n').map((line) => new Paragraph({
      keepNext: !headers,
      children: runs(line, head ? { bold: true, size: 19 } : { size: 19 }),
    })),
  })
  body.push(new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: scaled,
    rows: [
      ...(headers ? [new TableRow({ tableHeader: true, cantSplit: true, children: headers.map((h, i) => cell(h, i, true)) })] : []),
      ...rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, i === 0 && !headers)) })),
    ],
  }))
  body.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
}

// ════════════════════════════════════════════════════════════════════════════
// CONTENT
// ════════════════════════════════════════════════════════════════════════════

// ── 1 Overview ──────────────────────────────────────────────────────────────
h1('1. Overview')
p('**ARAM** (Automated Resilience & Assessment Module) is a private, gentle wellbeing companion for school students in India, roughly 10 to 18 years old. Many of them live in school hostels or study in Tamil Nadu government schools. ARAM lets a student say what has been on their mind without needing to write long sentences, talk it through with an AI counsellor, and reach real help immediately when something is serious.')
p('This document describes everything built so far: the architecture, the technology used for each feature, every screen and the order they appear in, every backend endpoint, the database functions, the counsellor prompt, and the safety and privacy rules that shaped the design. It is written for the whole team, so it explains the reasoning behind decisions as well as the decisions themselves.')
h2('1.1 Who uses ARAM')
table(['User', 'What they do'], [
  ['Student', 'Signs up, chooses topics, talks to the AI counsellor, reaches helplines'],
  ['Parent / guardian', 'Gives consent during the student\'s signup (on the student\'s device). Can register with a face for a basic dashboard'],
  ['Headmaster, counsellor', 'Register and sign in with their face; see a basic dashboard of counts. Will review amber/red flags'],
  ['Admin', 'Signs in with a username and password; sees the dashboard'],
], [2, 6])
h2('1.2 Design principles')
bullets([
  '**Privacy first.** No legal name, no date of birth, no photos are stored. The student is known by a nickname; the date of birth is turned into an age band on the device and thrown away.',
  '**Never alone with a crisis.** Every topic item carries a hidden safeguarding level. Serious items take the student straight to helplines; worrying ones are flagged for staff.',
  '**Works for children who read slowly.** Large tap targets, short sentences, five languages, and ARAM reads its own words aloud.',
  '**Free and open source where possible.** The project is for a charity. Hosting is on free tiers, the voice is an open model rendered once, and face recognition runs on the device.',
  '**Sensitive logic lives in the database.** PIN hashing, consent rules, duplicate checks and safeguarding writes run inside PostgreSQL functions, not in the browser.',
])
h2('1.3 What is built today')
table(['Area', 'Status'], [
  ['Onboarding S01–S08 (language, school, profile, consent, assent, face, opt-ins, summary)', 'Built'],
  ['Login S09 (nickname + PIN, face login, Forgot PIN by email), role picker', 'Built'],
  ['Home S10, My details, clinician-alert re-offer S11, Emergency helplines', 'Built'],
  ['Topic selection C01–C06 with feelings, basket of 3, safeguarding flags', 'Built'],
  ['Counsellor chat C07 (AI)', 'Built, on a free OpenRouter model for testing'],
  ['Voice for onboarding, home and session screens in 5 languages', 'Built (one English clip missing)'],
  ['Staff registration, face sign-in, dashboard', 'Prototype'],
  ['Assessment after the chat (body sensations, bands)', 'Not built'],
], [7, 2])

// ── 2 Architecture ──────────────────────────────────────────────────────────
h1('2. System architecture')
p('ARAM has three running parts: a static web app, a small Python API, and a PostgreSQL database. A fourth, external service (OpenRouter) generates counsellor replies.')
code(`STUDENT DEVICE  (phone / tablet / laptop)
  React PWA, served from the Vercel CDN
  - screens, translations, voice clips
  - face -> 128 numbers (face-api.js on TF.js), on the device
  - Zustand state (no secrets persisted)
        |
        |  HTTPS + JSON
        v
RENDER  (FastAPI, backend/main.py)
  - Pydantic validates every request
  - each endpoint calls one database function
  - /api/chat -> backend/counsellor.py ----> OPENROUTER (LLM)
        |                                    key + prompt stay on the server
        |  psycopg
        v
SUPABASE POSTGRESQL  (Mumbai, ap-south-1)
  - SECURITY DEFINER functions: bcrypt PINs, consent,
    face checks, safeguarding flags
  - tables are never exposed to the browser`)
h2('2.1 Components')
table(['Component', 'Location', 'Responsibility'], [
  ['Web app', '`src/`', 'All screens, routing, state, translations, face detection, voice playback, mock backend'],
  ['API', '`backend/main.py`', 'HTTP endpoints, request validation, CORS, timing headers; each endpoint calls one database function'],
  ['Counsellor module', '`backend/counsellor.py`', 'System prompt, crisis keyword check, OpenRouter call and error handling'],
  ['Database', '`supabase/migrations/*.sql`', 'Tables and the functions that enforce every business rule'],
  ['Voice tooling', '`scripts/render_tts.py`, `scripts/aram_colab_render.py`', 'Turns the spoken lines into MP3 clips, run once on a GPU'],
  ['Hosting config', '`vercel.json`, `render.yaml`, `backend/Dockerfile`, `docker-compose.yml`', 'Security headers, deploy settings, local stack'],
], [2, 3, 5])
h2('2.2 Mock mode and backend mode')
p('`src/lib/api.ts` is the single data-access layer. Every function has two implementations:')
bullets([
  '**Backend mode** (when `VITE_API_URL` is set): calls the FastAPI service through `src/lib/backendClient.ts`.',
  '**Mock mode** (when it is empty): keeps one account, its PIN, email, face descriptors and lockout counter in the browser\'s localStorage under `aram.mock.child` and `aram.mock.faces`. This lets designers and reviewers walk the entire app with no server. It follows the same rules as the database (3 wrong PINs lock, one face per account, email must match).',
])
p('The counsellor chat has its own setting, `VITE_CHAT_API_URL`, so the chat can use a real backend while everything else stays in mock mode.')
h2('2.3 Life of a request')
steps([
  'A screen calls a function in `api.ts`, for example `api.createChild(...)`.',
  '`backendClient.ts` sends a JSON POST to the API and records its timing for the debug overlay.',
  'FastAPI validates the body with a Pydantic model (types, lengths, patterns). Invalid input gets a 422 and never reaches the database.',
  'The endpoint opens a connection and calls one `SECURITY DEFINER` function, for example `SELECT create_child(...)`.',
  'The function applies the rules (hash the PIN, check the email is unique, write audit rows) and returns JSON.',
  'The API returns that JSON. Expected outcomes such as "wrong PIN" or "duplicate face" come back as normal 200 responses with `ok: false`, so screens can explain them gently instead of showing an error.',
])
h2('2.4 Where data lives')
table(['Data', 'Where', 'Why'], [
  ['Language, nickname, age band, consent flags, child id, voice setting', 'Device localStorage (`aram.onboarding`)', 'Resume onboarding and greet the child offline'],
  ['DOB, PIN, email typed at signup', 'Device memory only, cleared as soon as the account is created', 'Never persisted on a shared device'],
  ['Topics picked in a session, chat transcript', 'Device memory only (`sessionStore`)', 'The most sensitive data in the app'],
  ['Account, hashed PIN, email, face descriptor, consents', 'PostgreSQL', 'Source of truth'],
  ['Confirmed topics, safeguarding flags, audit events', 'PostgreSQL', 'Staff review and prevalence statistics'],
  ['Counsellor conversation', 'Not stored. Sent to OpenRouter for each reply', 'See privacy notes in section 15'],
], [4, 4, 4])

// ── 3 Tech stack ────────────────────────────────────────────────────────────
h1('3. Technology by feature')
table(['Feature', 'Technology', 'Notes'], [
  ['Screens and UI', 'React 19, TypeScript 5.7, plain CSS', 'Styles ported from the approved prototype (`src/styles`)'],
  ['Build tool', 'Vite 8 (Rolldown), `tsc -b`', 'npm scripts run Node 22 through `npx node@22`'],
  ['Routing and guards', 'react-router-dom 7', '`RequireConsent`, `RequireAccount`, `RequireStaff` in `App.tsx`'],
  ['State', 'Zustand 5', '`onboardingStore` (persisted, secrets excluded), `sessionStore` (memory only)'],
  ['Translations', 'i18next 24, react-i18next 15', '`src/i18n/{en,hi,ta,te,ml}.json`'],
  ['Installable app / offline', 'vite-plugin-pwa (Workbox)', 'App shell and voice clips precached; face models cached on first use; API responses never cached'],
  ['Face registration and login', '@vladmandic/face-api 1.7 on TensorFlow.js', 'WebGL backend, CPU fallback; models in `public/models`'],
  ['Camera', '`navigator.mediaDevices.getUserMedia`', '`src/lib/useCamera.ts`'],
  ['ARAM speaks', 'Pre-rendered MP3 clips', 'Made with AI4Bharat Indic Parler-TTS (Apache 2.0), played by `audioTts.ts`'],
  ['Student dictation', 'Web Speech API', 'Behind `ISpeech` so it can be swapped later (`MicButton`)'],
  ['API', 'Python 3.12, FastAPI 0.116, Pydantic 2.11, Uvicorn 0.35', '`backend/main.py`'],
  ['Database driver', 'psycopg 3.2', 'One connection per request'],
  ['Database', 'PostgreSQL 16 / Supabase, pgcrypto', 'bcrypt PIN hashes; all rules in functions'],
  ['Counsellor chat', 'OpenRouter chat completions', `Model \`${MODEL}\`, called with Python's standard \`urllib\``],
  ['Frontend hosting', 'Vercel', 'Security headers in `vercel.json`'],
  ['API hosting', 'Render free plan, Singapore', '`render.yaml`'],
  ['Database hosting', 'Supabase, Mumbai (ap-south-1)', 'Keeps personal data in India'],
  ['Quality', 'oxlint, TypeScript strict', '`npm run lint`, `npm run build`'],
], [3, 3, 4])

// ── 4 App flow ──────────────────────────────────────────────────────────────
h1('4. App flow')
p('Every screen renders inside `<Screen>` (or `<SessionFrame>` for the chat-style session screens). `<Screen>` provides the top bar, mute button, logout button when signed in, the progress bar, and automatic voice for that route.')
h2('4.1 New student onboarding')
table(['Route', 'Screen', 'What happens', 'Saved / API'], [
  ['`/welcome`', 'S01 Welcome', 'Time-of-day greeting, choose "new" or "I have an account"', '–'],
  ['`/language`', 'S02 Language', 'Pick one of 5 languages; the screen re-speaks itself in the new language', 'Language (device)'],
  ['`/school-type`', 'S02b School type', 'Is this a Tamil Nadu government school?', '–'],
  ['`/emis`', 'S02c EMIS', 'Enter EMIS code; school, district and name are filled in (currently a mock lookup: code `1234`)', 'EMIS (device)'],
  ['`/profile`', 'S03 Profile', 'Nickname, date of birth, **email**, PIN twice. DOB becomes an age band on the device. **The account is created here.**', '`POST /api/students`'],
  ['`/parent-consent`', 'S04 Parent consent', 'Read to the parent: what ARAM does and its privacy promise', 'Consent flag (device)'],
  ['`/assent`', 'S05 Child assent', 'What ARAM can and cannot do; the child agrees', 'Assent flag (device)'],
  ['`/face-register`', 'S05b Face (optional)', 'Capture a face for face login, or skip. Duplicate faces are refused', '`POST …/face`'],
  ['`/camera`', 'S06 Camera opt-in', 'Optional permission for expression reading in future', 'Opt-in (device)'],
  ['`/voice`', 'S07 Voice opt-in', 'Optional permission for voice input', 'Opt-in (device)'],
  ['`/summary`', 'S08 Summary', 'Shows choices; on confirm writes consents and creates session 1', '`POST …/finalize`'],
  ['`/home`', 'S10 Home', 'Greeting, stats, Start session, Emergency, profile', '`GET …/context`'],
], [2, 2, 5, 2])
note('Both parent consent and child assent are required before any session can exist. The `finalize_onboarding` database function enforces this, and a route guard (`RequireConsent`) enforces it in the app.')
h2('4.2 Returning student')
table(['Route', 'Screen', 'What happens'], [
  ['`/login`', 'S09 Login', 'Choose a role. Students always type **nickname + PIN**, or use face login. 3 wrong PINs lock the account'],
  ['`/forgot-pin`', 'Forgot PIN', 'Enter the signup email → nickname, age group and email shown locked → choose a new PIN. Unlocks a locked account'],
  ['`/reoffer`', 'S11 Re-offer', 'If a clinician alert is pending from last time, helplines are offered once before home'],
  ['`/my-details`', 'My details', 'Nickname (editable), age group, language, school, face status, camera/voice toggles, change PIN (nickname, age group and email shown locked; current + new PIN)'],
  ['`/emergency`', 'Emergency', 'Tele-MANAS 14416 and Childline 1098, tap to call; tap-to-listen only'],
], [2, 2, 7])
h2('4.3 A session: choosing topics')
table(['Route', 'Screen', 'What happens'], [
  ['`/session/cluster`', 'C01 Topics', 'ARAM greets and offers 8 topics. A session row is opened (`POST …/sessions`)'],
  ['`/session/cluster/:clusterId`', 'C02 Sub-topics', 'ARAM introduces the topic and asks which part is hardest'],
  ['`/session/cluster/:clusterId/:subId`', 'C03 Items', 'Tick what is happening (or type "something else"). After each pick: "How does that make you feel?" (11 feelings). Max 3 items'],
  ['`/session/basket`', 'C05 Review → C06 Confirm', 'List of picks; remove any; "Yes, let\'s begin" saves them (`POST …/cluster-flags`)'],
  ['`/session/red/:issueId`', 'Red emergency', 'Shown when a red item is tapped; the student can undo once if it was a mistake'],
  ['`/session/chat`', 'C07 Counsellor chat', 'AI counsellor talks the chosen topics through. ✕ ends the session'],
], [3, 2, 6])
h2('4.4 Staff')
bullets([
  '**Parent, headmaster, counsellor:** `/staff-register` captures a name and face. Face sign-in matches against registered staff of that role. They land on `/staff-dashboard` (counts of students, sessions, alerts).',
  '**Admin:** username and password through `POST /api/admin/login`. In mock mode the credentials are `admin` / `aram-admin`.',
])

// ── 5 Topics and safeguarding ───────────────────────────────────────────────
h1('5. Topics and safeguarding')
p('The topic taxonomy is in `src/data/clusters.ts` (structure only: ids, flags, icons, cross-links). All wording lives in the translation files under `cluster.*`.')
table(['Level', 'Count', 'Examples'], [
  ['Topics (clusters)', '8', 'School & Daily Life, Friends & Relationships, Feelings & Mind, Home & Life Changes, Safety & Hurt, Identity & Digital World, Habits & Hard to Stop, Money, Future & Responsibility'],
  ['Sub-topics', '33', 'Academic Pressure & Fear of Failure, Homesickness, Digital Safety & Online Pressure…'],
  ['Items', '251', '"I panic or forget everything during exams."'],
  ['Feelings', '11', 'Sad, Worried, Angry, Guilty, Numb, Confused, Tired, Ashamed, Scared, Sometimes okay, I don\'t know'],
], [2, 1, 7])
h2('5.1 Flag levels')
table(['Flag', 'Items', 'What happens'], [
  ['None', '~145', 'Ordinary item; goes into the basket'],
  ['Amber', '79', 'Session continues. A `safeguard_flag` row (severity amber) is written **immediately**, for counsellor review within 24–48 hours. ARAM tells the child a trusted adult should know'],
  ['Red', '30', 'Immediate risk. Red modal → Red emergency screen with helplines. Flag written immediately. One "I tapped this by mistake" undo so curious taps are not punished'],
], [1, 1, 6])
bullets([
  'Flags are hidden from the child. The dev panel\'s staff view shows them for review.',
  'A flag can never be retracted by the child. Removing an amber item from the basket does not remove its flag.',
  'Some items are cross-listed in more than one sub-topic. The database stores the canonical id once (`unique (session_id, issue_id)`), plus where the child tapped it for analysis.',
  'Up to 3 items per session (`BASKET_MAX`), so a session stays manageable.',
])
h2('5.2 Helplines')
p('Tele-MANAS **14416** (free, 24×7, mental health) and Childline **1098** (free, 24×7, children who are unsafe). The 112 emergency line and KIRAN are deliberately not shown yet. The same two numbers are used in the Emergency screen, the red screen, the chat\'s helpline card and the counsellor prompt.')

// ── 6 Counsellor chat ───────────────────────────────────────────────────────
h1('6. Counsellor chat (AI)')
p('After the student confirms their topics, the C07 chat opens. ARAM speaks first, names the first topic, and then talks with the student like a humble, polite school counsellor: it tries to understand the problem in depth before suggesting anything.')
h2('6.1 How it works')
steps([
  '`CounsellorChat.tsx` converts the basket into topics. Each topic sends the item text **in English** (the model reads it more reliably), its topic and sub-topic, the chosen feelings, and whether the student wrote it in their own words.',
  'It calls `askCounsellor()` in `src/lib/counsellorApi.ts` with the student\'s language, the topics and the conversation so far (an empty list for the opening message).',
  'The API (`POST /api/chat`) validates the input and calls `counsellor.reply()`.',
  '`counsellor.py` fills the system prompt with the topics and the language name, adds the conversation, and calls OpenRouter.',
  'It returns `{reply, crisis}`. The app HTML-escapes the reply, shows it in an ARAM bubble, and adds it to the history.',
  'If `crisis` is true, a pink helpline card with a link to the Emergency screen stays on screen for the rest of the chat.',
])
bullets([
  '**Stateless and unsaved.** The server stores nothing. The transcript lives only in the screen\'s memory and is gone when the student closes the chat.',
  '**Key stays on the server.** The browser never sees the OpenRouter key or the prompt.',
  '**Limits:** max 3 topics, 40 turns per request, 2,000 characters per message, 450 reply tokens, temperature 0.7, 60 s timeout.',
  '**Language:** the student\'s app language is sent on every turn, so changing language mid-chat takes effect on the next reply. If the student writes in another language or mixes them, ARAM follows them.',
  '**Not spoken.** Replies are generated live, so there are no recorded clips for them.',
])
h2('6.2 Model configuration')
table(['Setting', 'Value'], [
  ['Provider', 'OpenRouter, `https://openrouter.ai/api/v1/chat/completions`'],
  ['Model', `\`${MODEL}\` (change with \`OPENROUTER_MODEL\`)`],
  ['Key', '`OPENROUTER_API_KEY`, backend environment only'],
  ['Max reply', '450 tokens'],
  ['Temperature', '0.7'],
], [2, 6])
h2('6.3 The system prompt')
p('This is the exact prompt in `backend/counsellor.py`. `{topics}` is replaced with a numbered list of the student\'s topics and feelings, and `{language}` with the language name (English, Hindi, Tamil, Telugu or Malayalam).')
code(SYSTEM_PROMPT)
h3('Opening message')
p('When the student has not typed anything yet, the conversation starts with this hidden user message so the model writes the greeting:')
code(OPENING)
h3('Example of the filled topics block')
code(`1. I'm scared I'll fail or disappoint people. (area: School & Daily Life / Academic Pressure & Fear of Failure). Feelings: Worried, Scared
2. I miss home or my parents a lot. (area: Home & Life Changes / Missing Home / Homesickness). Feelings: Sad`)
h2('6.4 Safety net')
p('Underneath the prompt\'s own safety rules, the server checks the student\'s latest message against a keyword pattern. A match sets `crisis: true` so the app shows helplines even if the model\'s reply misses the signal. It covers English, romanised Hindi, and Hindi, Tamil, Telugu and Malayalam script:')
code(CRISIS)
note('This is a simple word check, not a classifier. It will miss some phrasings and can trigger on others. A chat crisis signal is not yet written to the database for staff; it only shows helplines. Recording it as a safeguarding flag is a planned next step.')
h2('6.5 Errors')
table(['Code (detail)', 'HTTP', 'Cause', 'What the student sees'], [
  ['`chat_not_configured`', '503', '`OPENROUTER_API_KEY` missing (or app has no chat URL)', '"Chat isn\'t set up on this device yet. Please ask a teacher."'],
  ['`chat_busy`', '503', 'OpenRouter 429 / 502 / 503 or an error body (free-model rate limit)', '"Lots of people are talking to me right now…" + Try again'],
  ['`chat_unreachable`', '503', 'Network failure or timeout', '"I couldn\'t reply just now…" + Try again'],
  ['`chat_failed`', '502', 'Any other provider error, or an empty reply', '"I couldn\'t reply just now…" + Try again'],
], [2, 1, 4, 4])
p('If a provider rejects the system role (some Gemma providers do), the server retries once with the prompt folded into the first user message.')

// ── 7 API reference ─────────────────────────────────────────────────────────
h1('7. Backend API reference')
p('Base URL: the value of `VITE_API_URL` (locally `http://localhost:8000`). All bodies are JSON. Validation errors return 422. FastAPI errors return `{"detail": "…"}`. Every response carries a `Server-Timing` header (handler time and process age) to diagnose cold starts.')
const ep = (method, route, purpose, req, res, fn) => {
  h3(`${method} ${route}`)
  p(purpose, true)
  table(null, [['Request', req], ['Response', res], ['DB function', fn]], [1, 6])
}
h2('7.1 Health')
ep('GET', '/health', 'Liveness check used by Render.', 'none', '`{"status": "ok"}`', '`SELECT 1`')
h2('7.2 Student accounts')
ep('POST', '/api/students', 'Create a student account at S03.', '`emis` (string, may be empty), `language` (en|hi|ta|te|ml), `nickname` (1–80), `age_group` (e.g. 13-15), `pin` (4 digits), `email`', '`{"child_id": uuid}`; **409** `{"detail": "email_taken"}` if the email is in use', '`create_child`')
ep('POST', '/api/students/{child_id}/finalize', 'Save consents and opt-ins and create session 1 (S08). Refuses unless both consents are true.', '`parent_consent`, `child_assent`, `camera_opt_in`, `voice_opt_in` (booleans)', '`{"session_id", "session_number"}`', '`finalize_onboarding`')
ep('POST', '/api/students/{child_id}/verify-pin', 'Check the PIN of a known account.', '`pin`', '`{"ok", "remaining_attempts", "locked"}`', '`verify_pin`')
ep('POST', '/api/students/login', 'Find an account by nickname + PIN (used by the login screen).', '`nickname`, `pin`, `emis` (optional, narrows the search)', 'Success: `{"ok": true, "child_id", "nickname", "language", "age_group", "face_registered"}`. Failure: `{"ok": false, "reason": "invalid"|"locked"|"ambiguous"}`', '`login_child_by_pin`')
ep('POST', '/api/students/forgot-pin/lookup', 'Find an account by its signup email.', '`email`', '`{"ok": true, "nickname", "age_group"}` or `{"ok": false, "reason": "not_found"}`', '`lookup_child_by_email`')
ep('POST', '/api/students/forgot-pin/reset', 'Set a new PIN by email; clears the lock and failed attempts; writes an audit row.', '`email`, `new_pin`', '`{"ok": true}` or `{"ok": false, "reason": "not_found"|"invalid_new_pin"}`', '`reset_child_pin_by_email`')
ep('GET', '/api/students/{child_id}/profile', 'Read the profile for My details.', 'none', '`nickname, age_group, language, school_id, email, parent_consent, child_assent, camera_opt_in, voice_opt_in, locked, created_at, face_registered, sessions`', '`get_child_profile`')
ep('POST', '/api/students/{child_id}/nickname', 'Rename (also updates the shared user record).', '`nickname`', '`{"ok", "nickname"}`', '`update_child_nickname`')
ep('POST', '/api/students/{child_id}/pin', 'Change PIN. Wrong current PIN counts toward the 3-try lock.', '`nickname`, `age_group`, `current_pin`, `new_pin`', '`{"ok"}` or `{"ok": false, "reason": "wrong_pin"|"same_pin"|"locked"|"details_mismatch"|"invalid_new_pin", "remaining_attempts"}`', '`change_child_pin`')
ep('POST', '/api/students/{child_id}/optins', 'Change camera / voice opt-ins (withdrawing must be as easy as giving).', '`camera_opt_in`, `voice_opt_in`', '`{"ok": true}`', '`update_child_optins`')
ep('GET', '/api/students/{child_id}/context', 'Home screen data.', 'none', '`name, days_since_last, streak, sessions_completed, buddies_unlocked, achievements, clinician_alert_pending`', '`get_returning_context`')
ep('POST', '/api/students/{child_id}/clear-alert', 'Mark the S11 helpline re-offer as shown.', 'none', '`{"ok": true}`', '`clear_clinician_alert`')
h2('7.3 Faces')
ep('POST', '/api/students/{child_id}/face', 'Register a face descriptor. Compared with faces at the same school.', '`descriptor` (128 numbers)', '`{"ok": true, "stored": true}`; review band `{"ok": true, "stored": false, "review": true}`; duplicate `{"ok": false, "reason": "duplicate", "existing_role"}`', '`register_face`')
ep('POST', '/api/students/{child_id}/verify-face', 'Compare a face with this account.', '`descriptor`', '`{"ok", "distance"}`', '`verify_face`')
ep('POST', '/api/students/login-face', 'Find an account by face (login on a new device).', '`descriptor`, `emis` (optional)', 'Same shape as `/api/students/login`', '`login_child_by_face`')
ep('POST', '/api/students/{child_id}/discard', 'Delete a signup that turned out to be a duplicate. Refuses accounts with consent or sessions.', 'none', '`{"ok", "removed"}` or `{"ok": false, "reason": "finalised"}`', '`discard_unfinished_child`')
ep('POST', '/api/students/{child_id}/face-override', 'Staff face authorises skipping the face step. Kept in the API but no longer used, since face registration is optional.', '`descriptor` (the staff member\'s)', '`{"ok", "staff_name"}`', '`authorise_face_skip`')
h2('7.4 Sessions and safeguarding')
ep('POST', '/api/students/{child_id}/sessions', 'Open a session when C01 starts.', 'none', '`{"session_id", "session_number"}`', '`start_session`')
ep('POST', '/api/sessions/{session_id}/safeguard-flag', 'Write an amber or red flag the moment it is tapped.', '`issue_id`, `severity` (amber|red), `cluster_id`, `sub_id`', '`{"flag_id"}`', '`raise_safeguard_flag`')
ep('POST', '/api/sessions/{session_id}/cluster-flags', 'Save the confirmed basket, one row per canonical item.', '`items[]`: `issue_id, cluster_id, sub_id, entry_sub_id, feeling_tags[], flag, free_text, priority_rank` (1–10 items)', '`{"rows", "amber_count"}`', '`save_cluster_selection`')
h2('7.5 Chat')
ep('POST', '/api/chat', 'One counsellor reply. See section 6.', '`language`, `topics[]` (1–3): `title, area, feelings[], own_words`; `messages[]` (0–40): `role` (user|assistant), `content` (1–2000)', '`{"reply": string, "crisis": boolean}`; errors in section 6.5', 'none (OpenRouter)')
h2('7.6 Staff and admin')
ep('POST', '/api/staff/register', 'Register a parent, headmaster or counsellor with a face.', '`role`, `display_name`, `language`, `face_descriptor`', '`{"user_id", "display_name"}`; **409** if the face already belongs to any account', '`create_staff_user`')
ep('POST', '/api/staff/verify-face', 'Staff face sign-in (closest match of that role, under 0.6).', 'same as register', '`{"ok": true, "user_id", "display_name", "language", "distance"}` or `{"ok": false}`', 'direct query on `app_user`')
ep('POST', '/api/admin/login', 'Admin sign-in.', '`username`, `password`', 'Account JSON; **401** if wrong', '`verify_admin`')
ep('GET', '/api/users/{user_id}/dashboard', 'Dashboard summary for a staff user.', 'none', 'User details and counts (students, sessions, alerts)', '`get_user_dashboard_summary`')

// ── 8 Database ──────────────────────────────────────────────────────────────
h1('8. Database')
p('PostgreSQL, hosted on Supabase in Mumbai. Tables are not reachable by anonymous clients; the API calls `SECURITY DEFINER` functions that run as the owner and enforce every rule. The ER diagram is in `docs/ERD.md`.')
h2('8.1 Tables')
table(['Table', 'Holds'], [
  ['`school`', 'EMIS code and district'],
  ['`app_user`', 'One identity for every role: role, display name, language, face descriptor (`face_template`), active flag'],
  ['`child`', 'Student account: nickname, age band, bcrypt `pin_hash`, unique lower-case `email`, consents + timestamps, opt-ins, failed attempts, lock'],
  ['`student_profile`, `student_consent`, `student_preference`', 'Detailed student records linked to `child`'],
  ['`student_assessment`, `student_support_event`', 'Reserved for assessment answers and support/referral events'],
  ['`staff_profile`, `user_school`, `parent_student`', 'Staff details, school access, parent–child links'],
  ['`admin_credential`', 'Admin username and password hash'],
  ['`session`', 'Per-child session number, status, band, red flag'],
  ['`cluster_flag`', 'One row per confirmed item: feelings, rank, free text, where it was tapped. Unique `(session_id, issue_id)`'],
  ['`safeguard_flag`', 'Amber and red disclosures, written immediately, never retracted'],
  ['`audit_log`', 'Events such as clinician alerts, duplicate faces blocked, PIN resets, discarded duplicate signups'],
], [3, 7])
h2('8.2 Functions')
table(['Function', 'Purpose'], [
  ['`create_child`', 'Validate and create a student; hash PIN; enforce unique email'],
  ['`finalize_onboarding`', 'Require both consents; save opt-ins; create session 1'],
  ['`verify_pin`', 'Check PIN; 3 failures lock the account'],
  ['`login_child_by_pin` / `login_child_by_face`', 'Find which child a nickname + PIN or a face belongs to'],
  ['`register_face`, `find_face_owner`, `face_match_threshold`, `face_block_threshold`', 'One face per account, scoped to the school, with block and review bands'],
  ['`verify_face`', 'Compare a face to one account'],
  ['`discard_unfinished_child`', 'Remove an unfinished duplicate signup'],
  ['`authorise_face_skip`', 'Staff face override (unused)'],
  ['`get_child_profile`, `update_child_nickname`, `change_child_pin`, `update_child_optins`', 'My details screen'],
  ['`lookup_child_by_email`, `reset_child_pin_by_email`', 'Forgot PIN'],
  ['`get_returning_context`, `clear_clinician_alert`', 'Home screen and S11 re-offer'],
  ['`start_session`, `raise_safeguard_flag`, `save_cluster_selection`', 'Sessions, flags, confirmed topics'],
  ['`create_staff_user`, `verify_admin`, `get_user_dashboard_summary`, `set_user_language`', 'Staff and admin'],
], [4, 6])
h2('8.3 Migrations')
p('Apply in numeric order (`supabase db push` for hosted, `supabase migration up` locally).')
table(['File', 'Change'], [
  ['`0001_init.sql`', 'Core schema, PIN hashing, consent, verify PIN, audit log'],
  ['`0002_user_roles_and_student_details.sql`', 'Shared user identity, roles, staff tables, student detail tables, face registration'],
  ['`0003_pgcrypto_search_path.sql`', 'Makes pgcrypto resolvable on hosted Supabase'],
  ['`0004_child_login.sql`', 'Login by nickname + PIN or by face on a new device'],
  ['`0005_cluster_selection.sql`', 'Cluster flags, safeguarding flags, sessions after the first'],
  ['`0006_face_uniqueness.sql`', 'One face, one account; discard duplicates'],
  ['`0007_face_scope_and_bands.sql`', 'Per-school scope; block (<0.45) and review (0.45–0.6) bands'],
  ['`0008_child_profile_edits.sql`', 'Rename, change PIN, change opt-ins, profile read'],
  ['`0009_child_email.sql`', 'Required unique email; `create_child` takes 6 arguments'],
  ['`0010_forgot_pin.sql`', 'Email lookup and PIN reset (audited)'],
  ['`0011_profile_email.sql`', 'Email in the profile response'],
], [4, 6])

// ── 9 Face ──────────────────────────────────────────────────────────────────
h1('9. Face recognition')
p('Faces are processed entirely on the device by `src/lib/faceApi.ts`. A camera frame becomes a **128-number descriptor**; the photo is shown only as an on-screen preview and is never saved or uploaded. Comparing two faces is a distance between two descriptors, the same idea as comparing PIN hashes instead of PINs.')
h2('9.1 Pipeline')
steps([
  'Load the face-api library (dynamically, only on face screens) and pick WebGL, or CPU if WebGL is unavailable.',
  'Load three small models: Tiny Face Detector, 68-point landmarks, face recognition. Run a warm-up pass on a blank image so the first real capture is fast (about 0.8 s instead of 5 s).',
  'Detect a face with a chain of increasingly expensive attempts: quick detector → a fresh camera frame → larger input → a padded frame (for close-ups) → SSD MobileNet. The SSD model downloads in the background.',
  'Return the descriptor, or nothing if no face was found.',
])
h2('9.2 Thresholds')
table(['Distance', 'Login / verify', 'New signup (duplicate check)'], [
  ['< 0.45', 'Same person', '**Block.** Near-certain duplicate; offer "That\'s me, take me to sign in"'],
  ['0.45 – 0.60', 'Same person', '**Review.** Store nothing, continue on PIN, flag for staff'],
  ['≥ 0.60', 'Not a match', 'Store normally'],
], [2, 3, 5])
bullets([
  'Duplicate checks compare a student only with students at the same school; staff are compared globally so one person cannot hold a student and a staff account.',
  'Face registration is optional. The PIN always works.',
  'Add `?facedebug=1` to the URL to log detection steps, timings and frame brightness in the console.',
])

// ── 10 Voice ────────────────────────────────────────────────────────────────
h1('10. Voice')
h2('10.1 ARAM speaks (text-to-speech)')
p('ARAM plays pre-recorded MP3 clips rather than using the browser\'s voice. Browser voices have no Tamil, Telugu or Malayalam on most devices, and pre-recorded clips sound the same everywhere, cost nothing at runtime, and can be checked by a native speaker before release.')
bullets([
  '**Clips:** `public/audio/{en,hi,ta,te,ml}/<i18n key>.mp3`, for example `public/audio/hi/sessionSpeech.c01Greet1.mp3`. The file name must match the key exactly. A missing clip plays as silence, with no error.',
  '**Which lines:** `src/speech/spokenKeys.ts` lists the lines each onboarding/home screen speaks on entry. The session screens speak lines from the `sessionSpeech` translation section chosen by what the child tapped (`useSpeakKeys`, `speakNow`).',
  '**Session voice:** topics screen (greeting, privacy line, question, "choose one", the 8 topic names); sub-topic screen (intro, question, "pick what fits best"); items screen (sub-topic name, "which of these…", and "How does that make you feel?" after each pick); review screen (two lines). Option lists are never read.',
  '**Never spoken:** nicknames, PINs and any string with `{{…}}`. Emergency and S11 are tap-to-play only, because that copy names self-harm and children may be overheard in class. The chat is not spoken.',
  '**Mute:** a toggle in the top bar of every speaking screen; the setting is remembered.',
])
h2('10.2 Making new clips')
steps([
  'Edit the line in `src/i18n/*.json` (and, for session lines, the `sessionSpeech` section).',
  'Check what will be spoken: `python3 scripts/render_tts.py --dry-run`.',
  'Generate the standalone Colab script: `python3 scripts/render_tts.py --emit-colab` → `scripts/aram_colab_render.py`.',
  'In Google Colab with a T4 GPU, upload it, log in to Hugging Face (the model is gated) and run it. It skips clips that already exist.',
  'Unzip `aram-audio.zip` into `public/audio/` and commit.',
])
p('Model: AI4Bharat **Indic Parler-TTS** (Apache 2.0). One named speaker per language keeps the voice consistent: English Mary, Hindi Divya, Tamil Jaya, Telugu Lalitha, Malayalam Anjali. Clips are loudness-normalised and faded so they play back to back. `scripts/cluster-audio-texts/{lang}1.json` lists the 66 session lines per language for recording outside Colab.')
h2('10.3 Student dictation')
p('`MicButton` uses the browser\'s Web Speech API (through the `ISpeech` interface in `src/speech/webSpeech.ts`) so a child can say their nickname instead of typing it. It only works in browsers that support speech recognition.')

// ── 11 i18n ────────────────────────────────────────────────────────────────
h1('11. Languages')
p('English, Hindi, Tamil, Telugu and Malayalam. All visible and spoken text is in `src/i18n/{lang}.json`; nothing is hard-coded in screens. Changing language updates the screen immediately and re-speaks it.')
table(['Section', 'Contents'], [
  ['`s01`…`s11`, `common`, `profile`, `forgotPin`, `emergency`', 'Onboarding, login, home, profile, Forgot PIN, helplines'],
  ['`cluster.ui`', 'Session chat lines, buttons, review, confirm, red screens, chat UI'],
  ['`cluster.names`, `desc`, `pill`, `subs`, `items`, `emotions`', 'The topic taxonomy: 8 topics, 33 sub-topics, 251 items, 11 feelings'],
  ['`sessionSpeech`', 'The 66 spoken session lines ("&" written as "and" for speech)'],
], [4, 6])
note('All non-English text is a first pass. It needs native-speaker review before launch, especially the safeguarding items about self-harm, abuse, substances and gender identity. In Hindi, about 10 first-person sentences show both gendered forms (गया/गई) where no neutral wording was natural.')

// ── 12 Security ─────────────────────────────────────────────────────────────
h1('12. Security and privacy')
bullets([
  '**Data minimisation:** nickname only, age band only, no photos, no full DOB anywhere.',
  '**PINs:** bcrypt in the database; verified server-side; 3 wrong attempts lock the account; reset by email unlocks it and is audited.',
  '**One person, one account:** unique email at signup, plus the optional face duplicate check.',
  '**Consent:** parent consent and child assent both required before a session exists.',
  '**No sensitive data on the device:** DOB, PIN and email are wiped from memory after signup; session topics and chat are never persisted.',
  '**Browser never sees credentials:** no database credentials or OpenRouter key in the app bundle.',
  '**Model output** is HTML-escaped before display. The child\'s own words are always rendered as text.',
  '**Headers (vercel.json):** Content-Security-Policy (scripts only from the app, connections only over HTTPS), HSTS, `X-Frame-Options: DENY`, `nosniff`, strict Referrer-Policy and Permissions-Policy (camera and microphone only for the app itself).',
  '**Camera and microphone** are requested only after the child opts in.',
  '**Service worker** never caches API responses.',
])

// ── 13 Config ───────────────────────────────────────────────────────────────
h1('13. Configuration')
table(['Variable', 'Set in', 'Purpose'], [
  ['`VITE_API_URL`', 'Frontend (.env / Vercel)', 'Backend URL. Empty = mock mode'],
  ['`VITE_CHAT_API_URL`', 'Frontend', 'Backend URL for the chat only. Defaults to `VITE_API_URL`'],
  ['`DATABASE_URL`', 'Backend (backend/.env / Render)', 'PostgreSQL connection'],
  ['`FRONTEND_ORIGIN`', 'Backend', 'Allowed browser origins (comma-separated)'],
  ['`FRONTEND_ORIGIN_REGEX`', 'Backend', 'Pattern for Vercel preview URLs'],
  ['`OPENROUTER_API_KEY`', 'Backend only', 'OpenRouter key'],
  ['`OPENROUTER_MODEL`', 'Backend', `Model id, default \`${MODEL}\``],
], [3, 3, 4])
note('`VITE_` variables are copied into the browser bundle at build time. Never put a secret in one, and rebuild after changing one.')

// ── 14 Local dev ────────────────────────────────────────────────────────────
h1('14. Running locally')
h2('14.1 UI only (mock mode)')
code(`npm install
npm run dev          # http://localhost:5173`)
p('Forgotten test login: in the browser console run `JSON.parse(localStorage.getItem(\'aram.mock.child\'))`. To start fresh, clear the site data in DevTools → Application.')
h2('14.2 Full stack')
code(`sudo docker compose up -d --build     # PostgreSQL on :5432, API on :8000
cp .env.example .env.local            # VITE_API_URL=http://localhost:8000
npm run dev`)
h2('14.3 Chat with the rest in mock mode')
code(`cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
echo "OPENROUTER_API_KEY=sk-or-..." > .env
uvicorn main:app --port 8000
# frontend .env:  VITE_CHAT_API_URL=http://localhost:8000   (then restart npm run dev)`)
h2('14.4 Checks')
code(`npm run build        # tsc -b + production build (the real type check)
npm run lint         # oxlint`)
note('`npx tsc --noEmit` at the repository root checks nothing, because the root tsconfig only references the app and node configs. Use `npm run build` or `npx tsc -p tsconfig.app.json --noEmit`.')

// ── 15 Deployment ───────────────────────────────────────────────────────────
h1('15. Deployment')
table(['Part', 'Service', 'Steps'], [
  ['Frontend', 'Vercel', 'Builds `npm run build` on every push to `main`, output `dist`. Set `VITE_API_URL` (or `VITE_CHAT_API_URL`) and redeploy after changing it'],
  ['API', 'Render (`render.yaml`)', 'Redeploys on push. Set `DATABASE_URL`, `FRONTEND_ORIGIN` (must include the Vercel domain) and `OPENROUTER_API_KEY` in the dashboard. Free plan sleeps after ~15 minutes; the first request then takes 30–60 s'],
  ['Database', 'Supabase', 'Run `supabase db push` for new migrations before deploying code that depends on them'],
], [1, 2, 6])
p('Order for a release that changes the database: apply migrations → deploy the API → deploy the frontend.')

// ── 16 Gaps ─────────────────────────────────────────────────────────────────
h1('16. Known gaps and next steps')
table(['Item', 'Why it matters', 'Suggested fix'], [
  ['Chat uses a free OpenRouter model', 'Providers may log or train on children\'s disclosures; data leaves India (DPDP)', 'Private or zero-retention model hosted in India'],
  ['Chat crisis signal not recorded', 'Staff are not alerted', 'Write a safeguarding flag from `/api/chat`'],
  ['Email not verified', 'Anyone knowing a student\'s email can reset their PIN', 'Free one-time code by email (Supabase Auth) before reset'],
  ['Admin password in frontend code', 'Visible to anyone', 'Server-side admin accounts only; remove the demo hint'],
  ['Staff data in mock mode is local', 'Not real accounts', 'Use the backend staff endpoints everywhere'],
  ['Native-speaker review', 'Wording on sensitive topics', 'Review all four non-English files and their audio'],
  ['Spoken welcome on login', 'Says "enter your PIN" but login now needs a nickname too', 'Update text and re-record'],
  ['English `s04.title` clip missing', 'Silent line on the parent consent screen', 'Record it'],
  ['`new_audio/` folder committed', '8.6 MB duplicate of `public/audio`', 'Delete it'],
  ['Abuse hardening', 'Signup and PIN endpoints are open', 'Rate limits, EMIS allow-list'],
  ['DPDP compliance', 'Legal requirement for children\'s data', 'Verifiable parental consent, retention policy, breach process, hosting DPA'],
  ['Assessment not built', 'Session ends after the chat', 'Body-sensation screens and banding'],
  ['Home cards (Quick breathing, My progress, Buddies)', 'Placeholders', 'Build or hide'],
], [3, 4, 4])

// ── 17 Glossary ─────────────────────────────────────────────────────────────
h1('17. Glossary')
table(['Term', 'Meaning'], [
  ['EMIS', 'Tamil Nadu Educational Management Information System code for a school/student'],
  ['Cluster / sub-cluster / item', 'Topic / sub-topic / specific statement the child ticks'],
  ['Basket', 'The (up to 3) items a child chose in one session'],
  ['Amber / red', 'Safeguarding levels: needs staff review / immediate risk'],
  ['Descriptor', 'The 128 numbers that represent a face'],
  ['Mock mode', 'Running the app with no backend, data kept in the browser'],
  ['RPC / database function', 'A PostgreSQL function the API calls; holds the business rules'],
  ['Tele-MANAS 14416', 'India\'s free 24×7 mental health helpline'],
  ['Childline 1098', 'India\'s free 24×7 helpline for children in need of care and protection'],
  ['PWA', 'Progressive Web App: a website that can be installed and works offline'],
], [3, 7])

// ════════════════════════════════════════════════════════════════════════════
const cover = [
  new Paragraph({ spacing: { before: 2600 }, alignment: AlignmentType.LEFT, children: [new TextRun({ text: 'ARAM', bold: true, size: 96, color: PURPLE, font: FONT })] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Automated Resilience & Assessment Module', size: 32, color: '444444', font: FONT })] }),
  new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '9B6EE0', space: 6 } }, children: [] }),
  new Paragraph({ spacing: { before: 300 }, children: [new TextRun({ text: 'Technical and product documentation for the team', size: 28, font: FONT })] }),
  new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: 'Architecture · technology · app flow · API · database · counsellor prompt · safety', size: 22, color: '666666', font: FONT })] }),
  new Paragraph({ spacing: { before: 2400 }, children: [new TextRun({ text: `Version 0.1 · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, size: 22, color: '666666', font: FONT })] }),
  new Paragraph({ children: [new TextRun({ text: 'Generated from the repository at commit time; the code is the source of truth.', size: 20, color: '888888', italics: true, font: FONT })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: 'Contents', bold: true, size: 34, color: PURPLE, font: FONT })] }),
  new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }),
]

const doc = new Document({
  creator: 'ARAM team',
  title: 'ARAM Documentation',
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 34, bold: true, color: PURPLE, font: FONT }, paragraph: { spacing: { before: 240, after: 200 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 27, bold: true, color: '3A2A6E', font: FONT }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, color: '333333', font: MONO }, paragraph: { spacing: { before: 220, after: 80 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullets', levels: [
        { level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } },
        { level: 1, format: LevelFormat.BULLET, text: '◦', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } },
      ] },
      ...numberingRefs.map((reference) => ({ reference, levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 320 } } } },
      ] })),
    ],
  },
  sections: [{
    properties: { page: { margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } }, titlePage: true },
    headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'ARAM · Team documentation', size: 18, color: '888888' })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 18, color: '888888' })] })] }) },
    children: [...cover, ...body],
  }],
})

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(OUT, buf)
  console.log('wrote', OUT, buf.length, 'bytes')
})
