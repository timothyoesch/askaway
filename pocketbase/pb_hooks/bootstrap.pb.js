/// <reference path="../pb_data/types.d.ts" />

// Applies the instance configuration from environment variables on every start,
// so docker-compose / .env is the single source of truth (no setup wizard).
onBootstrap((e) => {
  e.next()

  const config = require(`${__hooks}/lib/config.js`)
  const env = config.env
  const settings = $app.settings()

  settings.meta.appName = env("APP_NAME", "Ask Away!")
  const appUrl = env("APP_URL", "")
  if (appUrl) settings.meta.appURL = appUrl.replace(/\/+$/, "")
  settings.meta.senderName = env("MAIL_FROM_NAME", "Ask Away!")
  settings.meta.senderAddress = env("MAIL_FROM_ADDRESS", settings.meta.senderAddress)
  settings.meta.hideControls = true

  const smtpHost = env("SMTP_HOST", "")
  settings.smtp.enabled = smtpHost !== ""
  if (smtpHost) {
    settings.smtp.host = smtpHost
    settings.smtp.port = config.intEnv("SMTP_PORT", 587)
    settings.smtp.username = env("SMTP_USERNAME", "")
    settings.smtp.password = env("SMTP_PASSWORD", "")
    settings.smtp.tls = config.boolEnv("SMTP_TLS", false)
    settings.smtp.authMethod = env("SMTP_AUTH_METHOD", "PLAIN")
  }

  // Real client IPs from the reverse proxy (needed for per-IP limits).
  const proxyHeaders = env("TRUSTED_PROXY_HEADERS", "")
  settings.trustedProxy.headers = proxyHeaders ? proxyHeaders.split(",").map((s) => s.trim()) : []
  settings.trustedProxy.useLeftmostIP = config.boolEnv("TRUSTED_PROXY_USE_LEFTMOST_IP", false)

  // Built-in per-IP rate limits only for the login endpoints. A whole venue can
  // share one IP, so everything else is limited per participant in the routes.
  settings.rateLimits.enabled = true
  settings.rateLimits.rules = [
    { label: "POST /api/collections/users/request-otp", audience: "", duration: 60, maxRequests: 5 },
    { label: "POST /api/collections/users/auth-with-otp", audience: "", duration: 60, maxRequests: 10 },
    { label: "/api/collections/_superusers/", audience: "", duration: 10, maxRequests: 10 },
  ]

  // Tracking-free: don't keep visitor IPs in the request logs, keep logs short.
  settings.logs.logIP = false
  settings.logs.maxDays = config.intEnv("LOG_DAYS", 3)

  settings.batch.enabled = false

  // Daily database backups into pb_data/backups (same volume). "off" disables them.
  const backupCron = env("BACKUP_CRON", "0 4 * * *")
  settings.backups.cron = backupCron === "off" ? "" : backupCron
  settings.backups.cronMaxKeep = config.intEnv("BACKUP_KEEP", 7)

  $app.save(settings)

  // Dashboard (/_/) superuser from ADMIN_EMAIL / ADMIN_PASSWORD.
  const adminEmail = env("ADMIN_EMAIL", "")
  const adminPassword = env("ADMIN_PASSWORD", "")
  if (adminEmail && adminPassword) {
    const superusers = $app.findCollectionByNameOrId("_superusers")
    let su = null
    try {
      su = $app.findAuthRecordByEmail(superusers, adminEmail)
    } catch (_) {
      su = new Record(superusers)
      su.setEmail(adminEmail)
    }
    if (!su.validatePassword(adminPassword)) {
      su.setPassword(adminPassword)
      $app.save(su)
    }
  }
})

// Branded, translated login-code email.
onMailerRecordOTPSend((e) => {
  const mail = require(`${__hooks}/lib/mail.js`)
  const code = String(e.meta.password || "")
  if (code) {
    const message = mail.otpMessage(e.record.getString("lang"), code)
    e.message.subject = message.subject
    e.message.html = message.html
  }
  return e.next()
}, "users")

// MAIL_DEV_LOG=true prints emails to the console instead of sending them.
onMailerSend((e) => {
  if (require(`${__hooks}/lib/config.js`).boolEnv("MAIL_DEV_LOG", false)) {
    console.log("[mail] to:", e.message.to.map((t) => t.address).join(", "), "| subject:", e.message.subject)
    console.log("[mail] " + e.message.html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "))
    const links = e.message.html.match(/href="[^"]+"/g) || []
    for (const link of links) console.log("[mail] link: " + link.slice(6, -1))
    return
  }
  // Emails are sent in the background, so failures would otherwise only show up
  // in the dashboard logs (/_/ → Logs). Print them to the container log as well.
  // Recipients are left out on purpose (privacy).
  try {
    e.next()
  } catch (err) {
    const error = String(err)
    let hint = ""
    if (/\b535\b|auth/i.test(error)) hint = " → the mail server rejected SMTP_USERNAME / SMTP_PASSWORD"
    else if (/timeout|refused|no such host|dial/i.test(error)) hint = " → can't reach SMTP_HOST:SMTP_PORT (check host, port and SMTP_TLS)"
    else if (/tls|certificate|handshake/i.test(error)) hint = " → TLS problem: use SMTP_TLS=true with port 465, false with 587"
    console.log("[mail] ERROR sending «" + e.message.subject + "»: " + error + hint)
    throw err
  }
})
