# Development

## Architecture

```
Browser (Nuxt SPA) ── REST /api/askaway/* ──▶ PocketBase
        ▲                                         │  pb_hooks/   routes, access checks, rate limits
        └──── SSE /api/realtime (custom topics) ──┘  pb_migrations/  database schema
                                                      pb_public/   built SPA (served as static files)
```

- **Frontend** (`app/`, `i18n/`): Nuxt 4, built as a static SPA (`ssr: false`,
  `nuxt generate`), Tailwind CSS 4, `@nuxtjs/i18n` (German default, English).
- **Backend** (`pocketbase/`): PocketBase with JavaScript hooks.
  - All app collections have API rules set to *superusers only*. Clients never
    read or write collections directly; every action goes through the custom
    routes in `pb_hooks/routes.pb.js` → `pb_hooks/routes/*.js`.
  - Owners and moderators are identified by a secret key (`X-Askaway-Key`,
    stored hashed) or, for account events, by being logged in as the owner.
    Participants by a per-device token (`X-Askaway-Participant`, stored hashed).
  - Votes are a separate collection with a unique index on (question,
    participant) plus a counter updated atomically in SQL, so votes can't be
    duplicated or lost.
- **Realtime**: custom topics per event instead of collection subscriptions,
  so every phone only receives its own event's (public) data:
  - `askaway/<CODE>`: approved questions, vote counts, event changes
  - `askaway/<CODE>/here`: no messages; counts connected participants ("presence")
  - `askaway/<CODE>/mod`: everything incl. pending questions. Checked in
    `pb_hooks/realtime.pb.js`; the key is passed as a subscription option header.
- **Link previews**: `pb_hooks/meta.pb.js` serves `/e/<CODE>` with the event's
  title and description injected into `index.html`.

### Why no Nuxt server (SSR)?

A static SPA costs no server CPU per visitor and keeps deployment to one
container. The code is written SSR-safe (browser APIs only in `onMounted` or
client-side handlers), so switching on SSR later means: `ssr: true`,
`nuxt build` instead of `generate`, a second container for the Nuxt server, and
routing `/api` and `/_/` to PocketBase in the proxy.

### Limitations of PocketBase JS hooks worth knowing

- Hooks run in an embedded JS engine (goja), not Node: no npm packages and no
  `setTimeout`. Each handler runs in isolation, so shared code is `require`d
  **inside** the handler.
- Cron jobs have minute resolution.
- Don't hook `onRealtimeConnectRequest`: it would hold a JS runtime for the
  whole lifetime of every connection.

## Local setup

Requirements: Node.js 22+.

```bash
npm install
npm run dev:pb        # downloads the pinned PocketBase and starts it on :8090
# in a second terminal:
NUXT_PUBLIC_PB_URL=http://127.0.0.1:8090 npm run dev   # app on :3000
```

Useful environment variables for `dev:pb` (prefix the command):

- `SMTP_HOST=dev.invalid MAIL_DEV_LOG=true`: enables accounts; emails (login
  codes, confirmation links) are printed to the console instead of being sent.
- `ADMIN_EMAIL=… ADMIN_PASSWORD=…`: creates a dashboard login for `/_/`.
- `QUESTION_COOLDOWN_SECONDS=2`: less waiting while testing.

Hooks reload automatically when you edit files in `pocketbase/pb_hooks`.

To test the production setup (one origin, PocketBase serving the app):

```bash
npm run build && rm -rf pocketbase/pb_public && cp -R .output/public pocketbase/pb_public
```

## Changing the database schema

Add a new file to `pocketbase/pb_migrations/` named `<unix timestamp>_<what>.js`
(never edit a migration that has already been released):

```js
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const events = app.findCollectionByNameOrId("events")
  events.fields.add(new TextField({ name: "something", max: 100 }))
  app.save(events)
}, (app) => {
  const events = app.findCollectionByNameOrId("events")
  events.fields.removeByName("something")
  app.save(events)
})
```

Migrations run automatically when PocketBase starts (locally and in Docker).
`pocketbase/pb_data/types.d.ts` (generated on start) has the full API reference
for hooks and migrations.

## Translations

`i18n/locales/de.json` and `en.json` must have the same keys. Error codes
returned by the API (`{ "code": "slow_down" }`) map to `errors.<code>`. Keep the
tone friendly and a little playful 💜. German uses Swiss spelling (ss, not ß)
and the informal "du".

## Upgrading PocketBase

Change the version in `scripts/download-pocketbase.sh` and `Dockerfile`
(`POCKETBASE_VERSION`), read the PocketBase changelog for breaking changes in the
JS hooks API, run the app locally and run the load test.
