/// <reference path="../../pb_data/types.d.ts" />

// Newsletter opt-in shown at the end of an event (double opt-in).
//
// The consent wording is generated here, never taken from the client, and
// stored verbatim with each sign-up so the organiser can prove what people
// agreed to. Only events that belong to an account can collect sign-ups.

const CONSENT = {
  de: "Ich möchte von {org} per E-Mail auf dem Laufenden gehalten werden. Zweck: {purpose} Ich kann mich jederzeit wieder abmelden.",
  en: "I'd like to be kept up to date by {org} via email. Purpose: {purpose} I can unsubscribe at any time.",
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function consentText(lang, event) {
  const purpose = event.getString("newsletter_purpose").replace(/\s*$/, "")
  return CONSENT[lang === "en" ? "en" : "de"]
    .replace("{org}", event.getString("newsletter_org"))
    .replace("{purpose}", /[.!?]$/.test(purpose) ? purpose : purpose + ".")
}

function baseUrl(e) {
  const config = require(`${__hooks}/lib/config.js`).load()
  if (config.appUrl) return config.appUrl
  const proto = String(e.requestInfo().headers["x_forwarded_proto"] || "http")
  return proto + "://" + e.request.host
}

// POST /api/askaway/events/{code}/subscribe  { email, name, lang }
function subscribe(e) {
  const h = require(`${__hooks}/lib/http.js`)
  const mail = require(`${__hooks}/lib/mail.js`)
  const event = h.findEvent(e.request.pathValue("code"))
  if (!h.publicEvent(event).newsletter) h.fail(409, "newsletter_unavailable")

  const b = h.body(e)
  const email = h.str(b.email, 254).toLowerCase()
  if (!EMAIL_PATTERN.test(email)) h.fail(400, "invalid_email")
  const lang = mail.lang(b.lang)

  // Per-IP limit is generous because a whole venue may share one IP.
  h.limit("subscribe-ip", e.realIP(), 3000, 3600)
  h.limit("subscribe-email", event.id + ":" + email, 3, 3600)

  let record = null
  try {
    record = $app.findFirstRecordByFilter("subscribers", "event = {:event} && email = {:email}", { event: event.id, email })
  } catch (_) {
    record = null
  }
  // Already confirmed: answer the same way so nobody can probe who signed up.
  if (record && record.getString("confirmed_at")) return { ok: true }

  if (!record) record = new Record($app.findCollectionByNameOrId("subscribers"))
  const token = h.newSecret()
  record.set("event", event.id)
  record.set("email", email)
  record.set("name", h.str(b.name, 80))
  record.set("consent_text", consentText(lang, event))
  record.set("consent_at", h.now())
  record.set("confirm_token_hash", h.hash(token))
  $app.save(record)

  mail.sendConfirmation(
    lang,
    email,
    { event: event.getString("title"), org: event.getString("newsletter_org") },
    baseUrl(e) + "/n/" + token
  )
  return { ok: true }
}

// POST /api/askaway/newsletter/confirm  { token }
function confirm(e) {
  const h = require(`${__hooks}/lib/http.js`)
  h.limit("confirm", e.realIP(), 300, 60)
  const token = h.str(h.body(e).token, 64)
  if (!token) h.fail(404, "invalid_token")
  let record = null
  try {
    record = $app.findFirstRecordByData("subscribers", "confirm_token_hash", h.hash(token))
  } catch (_) {
    h.fail(404, "invalid_token")
  }
  if (!record.getString("confirmed_at")) {
    record.set("confirmed_at", h.now())
    record.set("confirm_token_hash", "")
    $app.save(record)
  }
  const event = $app.findRecordById("events", record.getString("event"))
  return { org: event.getString("newsletter_org"), title: event.getString("title") }
}

module.exports = { subscribe, confirm, consentText }
