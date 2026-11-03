# CLAUDE.md — Ask Away!

Guide for AI agents working in this repo. Read this first; `docs/` has the
human-facing details (`usage.md`, `deployment.md`, `development.md`).

## 1. What this is

Ask Away! is a live Q&A tool for events. Participants join by QR code with no
account, ask questions (anonymously as an "Anonymous <Animal>" or with a name)
and upvote. Moderators approve, decline, pin, spotlight and mark questions as
answered. A projector view shows either a join screen (QR code) or the live
questions. Everything updates in realtime.

- **Scale target:** ~1'000 concurrent participants in one room on shared venue
  Wi-Fi (load-tested: no errors, vote p95 ≈ 60 ms, ~200 MB RAM).
- **Values:** simple, tracking-free (no third-party requests, no visitor IPs in
  logs, automatic deletion), approachable, and a cute, wholesome tone.
- **Languages:** German (default, Swiss spelling) and English.
- **Repo:** public on GitHub (`timothyoesch/askaway`). Never commit secrets or
  personal data.

## 2. Stack

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Nuxt 4 (`app/`), Vue 3, TypeScript | **Static SPA**: `ssr: false`, built with `nuxt generate` |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), tokens in `app/assets/css/main.css` | Fonts self-hosted via `@fontsource` (Allan = display, Nunito = body) |
| i18n | `@nuxtjs/i18n` v10, `strategy: 'no_prefix'` | Locale files in `i18n/locales/{de,en}.json` |
| Backend | PocketBase **0.40.5** (pinned) with JS hooks (`pocketbase/pb_hooks`) | Embedded goja JS engine, not Node |
| DB | SQLite (inside PocketBase), schema via JS migrations (`pocketbase/pb_migrations`) | |
| Realtime | PocketBase SSE with **custom topics** | No collection subscriptions |
| Tours | `driver.js` **1.8.0** (pinned exact) | Wrapped in `useTour` |
| Other libs | `pocketbase` JS SDK, `vue-sonner` (toasts), `uqr` (QR SVG), `@heroicons/vue` | |
| Deploy | One Docker image: PocketBase serves the API **and** the built SPA from `pb_public` | `docker-compose.yml`, GHCR image |

## 3. Commands

```bash
npm install
npm run dev:pb        # downloads the pinned PocketBase into ./pocketbase and serves :8090 (--dev)
NUXT_PUBLIC_PB_URL=http://127.0.0.1:8090 npm run dev   # Nuxt dev server on :3000
npm run typecheck     # nuxt typecheck (vue-tsc). Must pass with no output
npm run build         # nuxt generate → .output/public
```

Useful environment variables for `dev:pb`:
- `SMTP_HOST=dev.invalid MAIL_DEV_LOG=true`: accounts work, and emails (OTP codes,
  links) are printed to stdout instead of sent.
- `ADMIN_EMAIL=… ADMIN_PASSWORD=…`: superuser for the `/_/` dashboard.
- `QUESTION_COOLDOWN_SECONDS=2`: faster manual testing.

Production-like test without Docker (one origin):
```bash
npm run build && rm -rf pocketbase/pb_public && cp -R .output/public pocketbase/pb_public
```

Docker:
```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build   # build from working copy
docker compose up -d                                                             # published image (ASKAWAY_VERSION)
```

Load test (run from a different machine than the server, with `ulimit -n 20000`):
```bash
node scripts/loadtest.mjs --url http://127.0.0.1:8090 --clients 1000 --seconds 90 --votes 5
```

When you start a PocketBase with a custom `--dir`, also pass `--hooksDir`,
`--migrationsDir` and `--publicDir` explicitly; they default to paths relative to
`--dir`.

## 4. Repository map

```
app/                      Nuxt app (srcDir)
  pages/
    index.vue             Landing: create event, join by code
    e/[code]/index.vue    Participant page (ask, vote, own questions, welcome dialog, newsletter at close)
    e/[code]/present.vue  Projector (layout "bare"): registration screen | questions | spotlight | wrap-up
    e/[code]/admin.vue    Moderation: tabs questions (waiting + live, filter)/answered/declined/share/settings, guided tours
    events.vue            "My events" (account events + events saved in this browser)
    login.vue             Email → 6-digit OTP login
    n/[token].vue         Newsletter double opt-in confirmation
  components/             AppButton, AppDialog, QuestionCard, VoteButton, IdentityPicker, WelcomeDialog,
                          TourMenu, AdminShare, AdminSettings, NewsletterForm, QrCode, …
  composables/
    usePb.ts              Singleton PocketBase client (base URL = runtimeConfig.public.pbUrl || origin)
    useApi.ts             request wrapper for /api/askaway/*, ApiError, toApiError, useErrorToast
    useLiveEvent.ts       Public event state + realtime (participant & projector)
    useAdminEvent.ts      Moderation state + realtime + actions
    useRealtime.ts        subscribe/unsubscribe custom topics, onReconnect → reload
    useAuth.ts            OTP login + useInstanceConfig (GET /api/askaway/config)
    useLocal.ts           Safe localStorage: saved events (keys), participant tokens, welcome flag, question filter
    useTour.ts            driver.js wrapper: start/autoStart, "seen" list, global auto on/off
    useAdminTours.ts      Tour step definitions per area (basics/questions/share/settings)
    useDisplayName.ts     name || translated "Anonymous <Animal>"
  utils/                  types.ts (shared shapes), questions.ts (sort/upsert), animals.ts (emoji map), export.ts (CSV/MD)
  assets/css/main.css     Tailwind import, @theme tokens, components (.card .field .label .hint), tour theme
i18n/                     i18n.config.ts (datetime formats), locales/de.json, locales/en.json
pocketbase/
  pb_migrations/          Schema (JS). Never edit a released migration; add a new file
  pb_hooks/
    routes.pb.js          All routerAdd registrations (thin; logic lives in routes/*.js)
    routes/*.js           events, questions, admin, newsletter, auth handlers
    lib/http.js           route() wrapper, fail(), access checks, rate limiting, JSON shapes
    lib/realtime.js       Topic names, send/broadcast, presence count
    lib/config.js         Env var config (single source of truth)
    lib/mail.js           Bilingual email templates
    lib/animals.js        Animal keys (must match app/utils/animals.ts)
    realtime.pb.js        Guards the moderator topic on subscribe
    bootstrap.pb.js       Applies env → PocketBase settings on every start; superuser upsert; mail hooks
    cron.pb.js            Retention deletion, unconfirmed sign-up purge, rate-limit store cleanup
    meta.pb.js            GET /e/{code}: injects title/OG tags into index.html (link previews)
  pocketbase, pb_data/, pb_public/   gitignored (binary, local data, built SPA)
scripts/                  download-pocketbase.sh, loadtest.mjs
docker/entrypoint.sh      pocketbase serve flags (hooksPool, encryption key)
Dockerfile                3 stages: node build → fetch PB for TARGETARCH → alpine runtime (non-root, /pb_data volume)
docker-compose.yml        Production (image ghcr.io/timothyoesch/askaway:${ASKAWAY_VERSION:-latest})
docker-compose.local.yml  Override: build from working copy as askaway:local
.github/workflows/docker.yml  Multi-arch build → GHCR on tags v2.*/v3.*; build-only on PRs
```

## 5. Backend architecture (PocketBase hooks)

### Security model (do not weaken)
- **All app collections have API rules = `null`** (superusers only). Clients never
  read or write collections directly. Every action goes through
  `/api/askaway/*` routes, which check access, validate input, rate-limit and
  broadcast.
- **Owner / moderator:** a secret key sent as header `X-Askaway-Key`, stored as a
  sha256 hash (`owner_key_hash`, `mod_key_hash`) and compared with
  `$security.equal`. Alternatively, a logged-in user whose id equals `events.owner`
  is the owner. Superusers count as owners. See `accessFor()` in `lib/http.js`.
- **Participant:** a per-device token sent as header `X-Askaway-Participant`,
  stored hashed in `participants.token_hash`, and scoped to one event.
- **Moderator realtime topic:** the key travels as a subscription option header
  (`x_askaway_key`). It's validated in `realtime.pb.js`, and the role is stored on
  the client (`client.set("askaway_role:<CODE>", role)`).
- **Votes:** separate `votes` collection with a UNIQUE index (question,
  participant). The counter `questions.votes` is updated with atomic SQL
  (`votes = votes + 1`) in the same transaction.
- **Rate limits:** per participant (and per IP only where it's generous, because a
  whole venue shares one IP). PocketBase's built-in per-IP limiter is enabled
  **only** for OTP and superuser auth endpoints.
- **Logs:** `logIP = false`. Emails are never logged with recipients.

### Data model (`1760400000_initial_schema.js`)
| Collection | Key fields |
|---|---|
| `users` (auth) | email, `lang`; passwordAuth **off**, OTP **on** (6 digits, 600 s); createRule null |
| `events` | `code` (6 chars, `[0-9A-Z]`, unique), title, description, starts_at, owner→users, owner_key_hash, mod_key_hash, `screen` (registration\|questions), `moderation` bool, `spotlight` (question id), closed_at, last_activity_at, newsletter_enabled/org/purpose/privacy_url |
| `participants` | event, token_hash (unique), `animal`, `name` |
| `questions` | event, participant, content, animal+name (snapshot at ask time), `status` (pending\|approved\|rejected), `votes`, pinned, approved_at, answered_at |
| `votes` | event, question, participant; UNIQUE(question, participant) |
| `subscribers` | event, email, name, consent_text (verbatim), consent_at, confirm_token_hash, confirmed_at; UNIQUE(event, email) |

Deleting an event cascades to everything below it.

### Routes (all JSON; errors are `{ code, ...extra }` with an HTTP status)
| Method & path | Who | Purpose |
|---|---|---|
| GET `/api/askaway/config` | public | Instance config for the UI |
| POST `/api/askaway/auth/start` | public | Ensure a user exists (respects REGISTRATION), then the client calls SDK `requestOTP` / `authWithOTP` |
| GET `/api/askaway/me/events` | user | Account's events |
| POST `/api/askaway/events` | public/user | Create event → `{ code, ownerKey, modKey, event }` |
| GET `/api/askaway/events/{code}` | public (+participant) | Event, approved questions, `me` (participant, votes, own non-approved questions) |
| GET `…/{code}/presence` | public | Connected participants count |
| POST `…/{code}/participants` | public | Join → `{ token, me }` |
| PATCH `…/{code}/me` | participant | name / animal |
| POST `…/{code}/questions` | participant | Ask (cooldown, length, auto self-vote) |
| PATCH / DELETE `…/{code}/questions/{id}` | participant (own) | Edit while pending / withdraw until answered |
| POST / DELETE `…/{code}/questions/{id}/vote` | participant | Vote / unvote |
| POST `…/{code}/subscribe` | public | Newsletter sign-up (double opt-in email) |
| POST `/api/askaway/newsletter/confirm` | public | Confirm token |
| GET / DELETE `…/{code}/admin` | mod/owner, owner | Full state / delete event |
| PATCH `…/{code}/admin/event` | mod: `screen`; owner: everything | Update event |
| POST `…/{code}/admin/questions/{id}` | mod/owner | `{ action, expect? }`: approve, reject, restore, answer, unanswer, pin, unpin, spotlight, unspotlight, delete. `expect` = status the client saw; approve/reject/restore return 409 `question_already_handled` (+ current `question`) if it changed (first decision wins) |
| POST `…/{code}/admin/close` · `/reopen` · `/mod-key` · `/claim` | owner | Close/reopen, rotate moderator key (kicks mods off the realtime topic), attach to account |
| GET / DELETE `…/{code}/admin/subscribers` | owner | Export / delete newsletter sign-ups |

### Realtime topics (`lib/realtime.js`)
| Topic | Subscribers | Messages |
|---|---|---|
| `askaway/<CODE>` | participants, projector | `question` (public shape, approved only), `question_removed`, `votes`, `event`, `deleted` |
| `askaway/<CODE>/here` | participants | none; used for **presence** counting |
| `askaway/<CODE>/mod?options=…` | moderators/owners | everything incl. pending questions (mod shape), `access_revoked` |

- **Public topics** are subscribed **without options**, so `send()` uses the fast
  `hasSubscription(topic)` path. The mod topic needs prefix matching and must be
  sent under each client's exact subscription key (the SDK dispatches by the full
  key including `?options=`).
- **Invisible changes:** don't broadcast public `question_removed` for questions
  participants never saw (pending ones). Pass `wasVisible`.
- **Presence** is **polled** (`GET /presence` every 5 s) by the projector and
  admin page. It isn't pushed.
- **Reconnects:** clients call `onReconnect → load()` to catch up.

### Configuration
- **Env vars only** (no setup wizard). `lib/config.js` and `bootstrap.pb.js`
  apply them on **every** start. The full list is in `.env.example` and
  `docs/deployment.md`.
- **Main variables:** `APP_URL`, `ADMIN_EMAIL/PASSWORD`,
  `EVENT_CREATION=anyone|registered`, `REGISTRATION=open|closed`,
  `DEFAULT_MODERATION`, `SMTP_*`, `MAIL_FROM_*`, `TRUSTED_PROXY_HEADERS`, limits,
  `RETENTION_DAYS`, `BACKUP_CRON` (`off` disables), `HOOKS_POOL`,
  `PB_ENCRYPTION_KEY`.
- **New setting:** add it to `lib/config.js`, `.env.example` and the table in
  `docs/deployment.md`.

### Migrations
- Pending migrations run automatically on `serve` (locally and in Docker). That
  makes upgrades work by pulling a new image.
- **Schema changes:** add `pocketbase/pb_migrations/<unix-ts>_<what>.js` with up
  **and** down. Never edit a migration that has already been released.
- `pocketbase/pb_data/types.d.ts` (generated on start) is the authoritative API
  reference for hooks and migrations in this PocketBase version.

## 6. PocketBase JS hooks: gotchas (important)

- **Handlers run in isolated contexts.** Top-level variables of a `.pb.js` file
  are not visible inside handlers, so `require(\`${__hooks}/lib/x.js\`)` **inside**
  each handler. Modules in `lib/` and `routes/` are CommonJS.
- **No Node APIs and no npm packages.** There's no `setTimeout` or
  `setInterval` (only a blocking `sleep`). Cron has **minute** resolution. That's
  why vote updates aren't batched.
- **Never register `onRealtimeConnectRequest`.** It holds a JS runtime for the
  lifetime of every SSE connection (1'000 connections = 1'000 runtimes).
- **`e.requestInfo().headers`** keys are lowercase with underscores
  (`x_askaway_key`).
- **Route handlers** use `h.route(e, fn)`. `fn` returns a value (sent as JSON) or
  calls `h.fail(status, code, extra)`.
- **Dates:** stored as `"YYYY-MM-DD HH:MM:SS.sssZ"`. Use `h.iso()` for clients.
  Filters compare these strings.
- **Mail is sent asynchronously.** Failures are logged by the `onMailerSend` hook
  as `[mail] ERROR …` with a hint (e.g. 535 → bad SMTP credentials). Without SMTP
  config, login and newsletter are disabled.
- **Hooks reload automatically in dev** (`--hooksWatch`). In Docker,
  `--hooksWatch=false` and `--automigrate=false`.

## 7. Frontend conventions

- **SSR-safe code** even though `ssr: false`: browser APIs only in `onMounted`,
  event handlers or client-only composables. Switching to SSR later should only
  need config and deployment changes.
- **API calls** go through `useApi()` (`get/post/patch/del`, options `key`,
  `participant`). Errors are `ApiError(code, status, data)`. Show them with
  `useErrorToast()`, which maps `code` → `errors.<code>` in i18n.
- **Realtime** goes through `useRealtime()`. Page state lives in `useLiveEvent`
  (public) or `useAdminEvent` (moderation).
- **localStorage** only via `useLocal.ts` / `useTour.ts` helpers (try/catch,
  tolerate blocked storage). Keys:
  - `askaway:events`: saved owner/mod keys per code
  - `askaway:participant:<CODE>`
  - `askaway:welcomed:<CODE>`
  - `askaway:question-filter`: all | pending | live (moderation list, per device)
  - `askaway:tours-seen`
  - `askaway:tours-auto`
- **Admin key in URLs** is passed as `#key=…` (fragment, never sent to the
  server). `useAdminEvent` stores it and strips it from the address bar.
- **Vue boolean props:** an omitted boolean prop is `false`, not `undefined`. Use
  `withDefaults` when the default should be `true` (this caused a real bug with
  `QuestionCard.showVotes`).
- **Types:** `import type { … } from '~/utils/types'` explicitly. Composables and
  utils are auto-imported.
- **Design tokens** (`main.css` `@theme`):
  - brand: `pink #ffadec`, `ink #4400ff`
  - surfaces: `pink-wash`, `ink-soft`, `ink-deep`
  - state colours: `mint`, `honey`, `berry`
  - helpers: `.card`, `.field`, `.label`, `.hint`, `.container-app`

  Headings use `font-display` (Allan). Buttons use `AppButton`
  (`primary|pink|soft|ghost|danger|success`, `sm|md|lg`).
- **Projector** uses viewport-relative sizes (`clamp(…, Nvw, …)`) and
  `TransitionGroup name="list"` for re-ordering.

### Onboarding & tours
- **Participant welcome:** `WelcomeDialog` runs once per event per browser
  (`welcomeFlag`). It mentions moderation on/off and uses `IdentityPicker`
  (compact = swipeable animal row). It can be reopened via *So funktioniert's*.
- **Admin tours:**
  - **Tours:** `basics` runs on the first admin visit, then the tour of the
    open tab. `questions`, `share` and `settings` each run the first time their
    tab is opened (after basics). Steps come from `useAdminTours`, and elements
    are marked with `data-tour="…"`.
  - **Empty lists:** the questions tour switches the filter to *all* (restored
    afterwards) and shows sample `QuestionCard`s for a waiting and a live
    question when there are none (`demo` prop, `tourDemo` ref in `admin.vue`).
  - **Opt-out:** auto-started tours have a *"Tipps nicht mehr automatisch
    anzeigen"* link. The help menu (`TourMenu`) toggles automatic tips and
    replays any tour. Re-enabling clears the seen list.
  - **HTML:** driver.js renders title and description as HTML, so tour texts must
    never contain user content.

## 8. i18n and copy

- **Same keys in both files:** `de.json` and `en.json` must have identical key
  sets. Error codes from the API map to `errors.<code>`.
- **German:** Swiss spelling (**ss, never ß**), informal **"du"**, inclusive forms
  where needed (e.g. *Moderator*innen*). Avoid assuming genders.
- **Tone:** friendly, a little playful, with emoji, e.g. «Woah, langsam 😮‍💨 …»,
  «Oh nein, da ist etwas schiefgelaufen 🥺». Keep the same tone in new strings.
- **vue-i18n special characters:** `@`, `|` (plural separator), `{` and `}`
  (params). Don't use them literally in messages.
- **Animal names:** full phrases per language with correct German grammar
  ("Anonymer Otter", "Anonyme Eule", "Anonymes Faultier"). Keys must match
  `pb_hooks/lib/animals.js` and `app/utils/animals.ts`.
- **Key check** (run after editing locales or templates):
  ```bash
  python3 - <<'EOF'
  import json,re,glob
  de=json.load(open('i18n/locales/de.json')); en=json.load(open('i18n/locales/en.json'))
  def keys(d,p=''):
    o=set()
    for k,v in d.items(): o|=keys(v,p+k+'.') if isinstance(v,dict) else {p+k}
    return o
  def has(d,path):
    for p in path.split('.'):
      if not isinstance(d,dict) or p not in d: return False
      d=d[p]
    return True
  used=set()
  for f in glob.glob('app/**/*.vue',recursive=True)+glob.glob('app/**/*.ts',recursive=True):
    used|=set(re.findall(r"\bt\('([a-zA-Z_.]+)'",open(f).read()))
  print('de/en mismatch:', keys(de)^keys(en)); print('missing:', sorted(k for k in used if not has(en,k)))
  EOF
  ```

## 9. Privacy & newsletter rules

- **Account events only:** newsletter sign-ups are only possible when
  `newsletter_enabled`, the event has an owner (account) **and** SMTP is
  configured.
- **Consent text:** generated **server-side**
  (`routes/newsletter.js → consentText`), stored verbatim with `consent_at`.
  Double opt-in; unconfirmed sign-ups are purged after 7 days. Re-subscribing a
  confirmed email returns `{ok:true}` (no enumeration).
- **No linking:** sign-ups are never linked to questions or votes. Exports are
  owner-only.
- **Context:** political events count as sensitive data under the Swiss nDSG and
  the GDPR. Keep data minimal and consent explicit.
- **Retention:** events are deleted `RETENTION_DAYS` after closing, or after the
  last activity if never closed and not upcoming. This cascades to everything.

## 10. Verification checklist before handing work back

1. **Typecheck:** `npm run typecheck` (no output) and `npm run build` succeed.
2. **Translation keys:** run the i18n key check (no mismatch or missing keys).
3. **Backend changes:** run PocketBase locally and exercise routes with `curl`,
   including access-denied paths (no key, wrong key, moderator vs owner).
4. **UI changes:** check in a real browser at phone width (390 px) and desktop.
   Playwright works well (install it in a temp folder, not in this repo). Watch
   for console errors.
5. **Realtime/perf changes:** run `scripts/loadtest.mjs`.
6. **Docker changes:** build with `docker-compose.local.yml`, start on a fresh
   volume (migrations apply, health is `healthy`), then restart on the same
   volume.

## 11. Git, releases & workflow with the maintainer

- **Branches:** `main` is the default and receives PRs. Feature branches are named
  `feature/<topic>`. `v1.0.0` is a frozen v1 branch, and tag `v1.0.0-final`
  marks the same commit.
- **Releases:** push a tag `vX.Y.Z` (or `vX.Y.Z-rc.N`). GitHub Actions builds
  `linux/amd64,linux/arm64` and pushes it to `ghcr.io/timothyoesch/askaway`. The
  semver tags `X.Y.Z`, `X.Y` and `X` plus `latest` are set for non-prerelease
  tags only. The package is public.
- **Tag names:** don't create branches named like version tags. A `v2.0.0` branch
  once collided with the `v2.0.0` tag.
- **Workflow:** actions are pinned to Node-24 majors (checkout@v7, docker/*@v4–v7),
  and the runner is pinned to `ubuntu-24.04`.
- **The maintainer** is comfortable with Nuxt/Vue but new to agentic coding:
  - Explain outward-facing steps (push, tag, publish) plainly.
  - **Ask before committing, pushing, tagging or publishing**, unless explicitly
    told to. They often commit and push themselves.
  - Keep `.vscode/` and `.env` out of commits.
- **Language:** reply in English unless asked otherwise. App copy is German and
  English.

## 12. Known follow-ups / ideas

- **Webhooks** for newsletter sign-ups (planned: HTTPS only, HMAC-signed, owner
  accounts only).
- **SSR:** only if link previews beyond `/e/{code}` are needed (add a Nuxt server
  container; see `docs/development.md`).
- **Before a big event:**
  - Run the load test against the real server from another machine.
  - Verify the proxy doesn't buffer SSE.
  - Verify login emails arrive.
