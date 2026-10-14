#!/bin/sh
# Starts PocketBase. Pending migrations from /app/pb_migrations are applied
# automatically on every start, so pulling a newer image upgrades the database.
set -eu

set -- serve \
  --http=0.0.0.0:8090 \
  --dir=/pb_data \
  --migrationsDir=/app/pb_migrations \
  --hooksDir=/app/pb_hooks \
  --publicDir=/app/pb_public \
  --hooksWatch=false \
  --automigrate=false \
  --hooksPool="${HOOKS_POOL:-50}"

# Optional: encrypt stored settings (e.g. the SMTP password) at rest.
if [ -n "${PB_ENCRYPTION_KEY:-}" ]; then
  set -- "$@" --encryptionEnv=PB_ENCRYPTION_KEY
fi

exec /usr/local/bin/pocketbase "$@"
