/// <reference path="../../pb_data/types.d.ts" />

// Passwordless login. The client first calls POST /api/askaway/auth/start,
// which makes sure an account exists for the email (if registration is open),
// and then uses PocketBase's built-in OTP flow:
//   pb.collection("users").requestOTP(email) → authWithOTP(otpId, code)

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function start(e) {
  const h = require(`${__hooks}/lib/http.js`)
  const config = require(`${__hooks}/lib/config.js`)
  const cfg = config.load()
  if (!cfg.mailEnabled) h.fail(503, "mail_not_configured")

  h.limit("auth-start", e.realIP(), 10, 600)
  const b = h.body(e)
  const email = h.str(b.email, 254).toLowerCase()
  if (!EMAIL_PATTERN.test(email)) h.fail(400, "invalid_email")
  const lang = b.lang === "en" ? "en" : "de"

  let user = null
  try {
    user = $app.findAuthRecordByEmail("users", email)
  } catch (_) {
    user = null
  }

  if (!user) {
    const adminEmail = config.env("ADMIN_EMAIL", "").toLowerCase()
    if (cfg.registration === "closed" && email !== adminEmail) h.fail(403, "registration_closed")
    user = new Record($app.findCollectionByNameOrId("users"))
    user.setEmail(email)
    user.setPassword($security.randomString(40))
    user.set("lang", lang)
    $app.save(user)
  } else if (user.getString("lang") !== lang) {
    user.set("lang", lang)
    $app.save(user)
  }
  return { ok: true }
}

module.exports = { start }
