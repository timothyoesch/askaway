# Deploying Ask Away!

Ask Away! ships as **one Docker image**. It contains:

- **PocketBase**: database (SQLite), realtime server, API and server logic
  (`pb_hooks`), and database migrations (`pb_migrations`)
- the **web app**, served by PocketBase on the same port

All data lives in one volume (`/pb_data`). Put any reverse proxy in front for HTTPS.

## Requirements

- Docker with Compose
- A reverse proxy with HTTPS (Caddy, nginx, Traefik, …)
- An SMTP account for login codes and newsletter confirmations (optional, but
  without it there are no accounts)
- For ~1'000 simultaneous participants: **1–2 vCPU, 1 GB RAM** is plenty.
  A load test with 1'000 clients used about 200 MB RAM.

## First start

```bash
mkdir askaway && cd askaway
curl -O https://raw.githubusercontent.com/timothyoesch/askaway/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/timothyoesch/askaway/main/.env.example
nano .env            # at least APP_URL, ADMIN_EMAIL, ADMIN_PASSWORD, SMTP_*
docker compose up -d
docker compose logs -f
```

On the first start the database is created and all migrations are applied.
Configuration from `.env` is applied on **every** start, so `.env` is the single
source of truth and there is no setup wizard.

The app listens on `127.0.0.1:8090`. If your reverse proxy runs in another
container, put both on a shared Docker network and use `askaway:8090` instead of
publishing the port.

## Configuration (`.env`)

| Variable | Default | Description |
|---|---|---|
| `APP_URL` | — | Public URL, e.g. `https://ask.example.ch`. Used in emails. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | — | Login for the database dashboard at `/_/`. This email can also always log in to the app. |
| `EVENT_CREATION` | `anyone` | `anyone` or `registered` (only logged-in users can create events). |
| `REGISTRATION` | `open` | `open`: anyone can create an account by logging in. `closed`: only existing accounts and `ADMIN_EMAIL` (add users in the dashboard under *users*). |
| `DEFAULT_MODERATION` | `true` | Default for "questions need approval" on new events. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | — | Mail server. Without `SMTP_HOST`, login and newsletter sign-ups are disabled. |
| `SMTP_TLS` | `false` | `true` for implicit TLS (port 465). STARTTLS on 587 works with `false`. |
| `SMTP_AUTH_METHOD` | `PLAIN` | `PLAIN` or `LOGIN`. |
| `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` | — / `Ask Away!` | Sender of all emails. |
| `TRUSTED_PROXY_HEADERS` | — | Header with the visitor's IP set by your proxy, e.g. `X-Forwarded-For`. Set it only if a proxy sits in front, otherwise clients could fake their IP. |
| `QUESTION_MAX_LENGTH` | `300` | Max characters per question. |
| `QUESTION_COOLDOWN_SECONDS` | `30` | Time between two questions of the same person. |
| `VOTES_PER_MINUTE` | `60` | Vote limit per person. |
| `EVENTS_PER_HOUR_PER_IP` | `10` | Limit for creating events. |
| `RETENTION_DAYS` | `30` | Events are deleted this many days after closing (or after their last activity if never closed, unless their date is still upcoming). `0` disables. |
| `BACKUP_CRON` | `0 4 * * *` | Daily backup into `/pb_data/backups`. `off` disables it. |
| `BACKUP_KEEP` | `7` | Number of backups kept. |
| `LOG_DAYS` | `3` | Days request logs are kept. Visitor IPs are never logged. |
| `HOOKS_POOL` | `50` | Pre-warmed JS runtimes for the server logic. Raise for very large events. |
| `PB_ENCRYPTION_KEY` | — | Optional 32 characters; encrypts stored settings such as the SMTP password. Set it before the first start and never change it. |
| `ASKAWAY_VERSION` | `latest` | Image tag used by `docker-compose.yml`, e.g. `2` or `2.0.0`. |

## Reverse proxy

Ask Away! keeps a long-lived **Server-Sent Events** connection open per browser
(`/api/realtime`). The proxy must **not buffer** it and must allow long idle times.

**Caddy** (works out of the box):

```caddy
ask.example.ch {
    reverse_proxy 127.0.0.1:8090
}
```

**nginx**:

```nginx
server {
    server_name ask.example.ch;
    # listen 443 ssl; ssl_certificate ...;

    client_max_body_size 1m;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection '';
        proxy_buffering off;          # required for realtime updates
        proxy_read_timeout 1h;
    }
}
```

With either one, set `TRUSTED_PROXY_HEADERS=X-Forwarded-For`.

Optionally restrict the database dashboard (`/_/`) to your own IP in the proxy.

## Upgrading

```bash
docker compose pull
docker compose up -d
```

New database migrations in the image are applied automatically when the
container starts. Your data is never touched by a pull; it lives in the
`askaway_data` volume. Take a backup before major upgrades (see below).

To pin a version, set `ASKAWAY_VERSION=2.0.0` in `.env`.

> Don't change the database structure in the dashboard (`/_/`) of a production
> instance. Structure changes belong in migration files in the repository so
> every instance gets them on upgrade.

## Backups and restore

Backups run daily (see `BACKUP_CRON`) and are stored in the volume under
`/pb_data/backups`. **Copy them off the server** regularly, e.g.:

```bash
docker compose cp askaway:/pb_data/backups ./backups
```

You can also create, download and restore backups in the dashboard
(`/_/` → Settings → Backups). To restore by hand, stop the container, replace the
volume contents with an unpacked backup, and start it again.

## Before a big event (checklist)

- [ ] Run the load test against your server from a different machine (needs
      Node.js 20+): `node scripts/loadtest.mjs --url https://ask.example.ch --clients 1000 --seconds 120`
- [ ] Check your proxy passes realtime updates (open the participant page on two
      phones and vote: the count should update instantly on the other one).
- [ ] Ask the venue whether the Wi-Fi isolates clients or limits connections per
      access point. Everyone on the same Wi-Fi usually shares one public IP;
      Ask Away! limits per participant rather than per IP, so this is fine.
- [ ] Test login emails arrive (and don't land in spam).
- [ ] Have a backup and know how to restore it.

## Troubleshooting email

Emails are sent in the background, so the login page says "code is on its way"
even if sending fails. Failures are printed in the container log as
`[mail] ERROR …` (`docker compose logs askaway`) and also appear in the
dashboard under `/_/` → *Logs*.

- **`535 Authentication failed`**: the mail server rejected the username/password.
  - Mailgun: `SMTP_USERNAME`/`SMTP_PASSWORD` must be an **SMTP credential** of
    the sending domain (*Sending → Domain settings → SMTP credentials*), not an
    API key. The username includes the domain, e.g. `askaway@example.ch`.
    A new or reset credential can take a few minutes to start working.
  - Use the host of the region your domain is in: `smtp.eu.mailgun.org` for EU
    domains, `smtp.mailgun.org` for US domains.
- **Timeouts / connection refused**: wrong host or port, or outgoing SMTP is
  blocked by the network or hosting provider. Port 587 needs `SMTP_TLS=false`
  (STARTTLS is used automatically), port 465 needs `SMTP_TLS=true`.
- **Values with special characters**: wrap them in single quotes in `.env`
  (`SMTP_PASSWORD='…'`). Docker Compose would otherwise treat a `$` as a variable.

To test without logging in: `/_/` → *Settings* → *Mail settings* → *Send test email*.

## Building the image yourself

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up -d --build
```

Images for `linux/amd64` and `linux/arm64` are built and published to
`ghcr.io/timothyoesch/askaway` by GitHub Actions when a version tag (e.g.
`v2.0.0`) is pushed (`.github/workflows/docker.yml`).
