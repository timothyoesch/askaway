# Ask Away!

Free, simple and tracking-free live Q&A for events. Your audience scans a QR
code, asks questions (anonymously as a cute animal, if they like) and upvotes
the ones they want answered. You moderate from your phone or laptop while the
projector shows the questions live.

- 📱 **No sign-up for participants**: scan, ask, vote.
- 📽️ **Presenter view**: join screen with QR code, or a live question list with a spotlight on the question being answered.
- 🛡️ **Moderation**: approve or decline questions, pin, spotlight, mark as answered. Owner and moderator links are separate.
- 💌 **Stay in touch**: optional double opt-in sign-up when the event ends.
- 🌍 German and English.
- 🌱 **Tracking-free**: no third-party requests, and events are deleted automatically after the event.

## Documentation

- [Usage](docs/usage.md): running an event as organiser or moderator
- [Deployment](docs/deployment.md): self-hosting with Docker, configuration, upgrades, backups
- [Development](docs/development.md): architecture and local setup

## Quick start (self-hosting)

```bash
curl -O https://raw.githubusercontent.com/timothyoesch/askaway/main/docker-compose.yml
curl -o .env https://raw.githubusercontent.com/timothyoesch/askaway/main/.env.example
# edit .env, then:
docker compose up -d
```

Then point your reverse proxy at `127.0.0.1:8090`. See [docs/deployment.md](docs/deployment.md).

## Tech

[Nuxt](https://nuxt.com) (static SPA) + [PocketBase](https://pocketbase.io)
(database, realtime and server logic in `pocketbase/pb_hooks`), shipped as a
single Docker image.
