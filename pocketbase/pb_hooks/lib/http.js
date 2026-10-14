/// <reference path="../../pb_data/types.d.ts" />

// Shared helpers for the /api/askaway routes: error handling, access checks,
// rate limiting and the JSON shapes sent to clients.
//
// Errors are returned as `{ code: "some_code", ...extra }` with a matching HTTP
// status. The frontend turns `code` into a friendly translated message.

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

function fail(status, code, extra) {
  throw { __askaway: true, status, code, extra: extra || {} }
}

// Runs a route handler and converts its return value / thrown errors to JSON.
function route(e, handler) {
  try {
    const result = handler(e)
    return e.json(200, result === undefined ? { ok: true } : result)
  } catch (err) {
    if (err && err.__askaway) {
      return e.json(err.status, Object.assign({ code: err.code }, err.extra))
    }
    $app.logger().error("askaway route failed", "path", e.request.url.path, "error", String(err))
    return e.json(500, { code: "server_error" })
  }
}

function body(e) {
  return e.requestInfo().body || {}
}

function header(e, name) {
  // requestInfo() normalizes header names to lowercase with underscores.
  return String(e.requestInfo().headers[name] || "")
}

function str(value, maxLength) {
  if (value === undefined || value === null) return ""
  const s = String(value).trim()
  return maxLength ? s.slice(0, maxLength) : s
}

function randomCode() {
  return $security.randomStringWithAlphabet(6, CODE_ALPHABET)
}

function newSecret() {
  return $security.randomString(32)
}

function hash(secret) {
  return $security.sha256(secret)
}

// PocketBase dates are "2026-01-14 18:30:00.000Z"; clients get ISO strings.
function iso(record, field) {
  const value = record.getString(field)
  return value ? value.replace(" ", "T") : null
}

function now() {
  return new DateTime()
}

// --- lookups -----------------------------------------------------------------

function findEvent(code) {
  const normalized = str(code).toUpperCase()
  if (!/^[0-9A-Z]{6}$/.test(normalized)) fail(404, "event_not_found")
  try {
    return $app.findFirstRecordByData("events", "code", normalized)
  } catch (_) {
    fail(404, "event_not_found")
  }
}

// Returns "owner", "mod" or null for the current request.
// Owners are recognised by the owner key or by being the logged-in owner;
// moderators by the moderator key. Superusers count as owners.
function accessFor(e, event, key) {
  if (e.hasSuperuserAuth && e.hasSuperuserAuth()) return "owner"
  const secret = key !== undefined ? key : header(e, "x_askaway_key")
  if (secret) {
    const h = hash(secret)
    if ($security.equal(h, event.getString("owner_key_hash"))) return "owner"
    if ($security.equal(h, event.getString("mod_key_hash"))) return "mod"
  }
  const owner = event.getString("owner")
  if (owner && e.auth && e.auth.collection().name === "users" && e.auth.id === owner) {
    return "owner"
  }
  return null
}

function requireAccess(e, event, minimum) {
  const role = accessFor(e, event)
  if (!role) fail(403, "no_access")
  if (minimum === "owner" && role !== "owner") fail(403, "owner_only")
  return role
}

function findParticipant(e, event, required) {
  const token = header(e, "x_askaway_participant")
  if (!token) {
    if (required) fail(401, "no_participant")
    return null
  }
  let participant = null
  try {
    participant = $app.findFirstRecordByData("participants", "token_hash", hash(token))
  } catch (_) {
    participant = null
  }
  if (!participant || participant.getString("event") !== event.id) {
    if (required) fail(401, "no_participant")
    return null
  }
  return participant
}

function requireOpen(event) {
  if (event.getString("closed_at")) fail(409, "event_closed")
}

// --- rate limiting -------------------------------------------------------------
//
// Fixed-window counters in the app store (memory only, reset on restart).
// Keys are "rl:<name>:<subject>", values "<window>:<count>:<windowSeconds>".

function hit(name, subject, limit, windowSeconds) {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const window = Math.floor(nowSeconds / windowSeconds)
  let allowed = true
  let retryAfter = 0
  $app.store().setFunc("rl:" + name + ":" + subject, (old) => {
    let w = window
    let count = 0
    if (old) {
      const parts = String(old).split(":")
      if (Number(parts[0]) === window) count = Number(parts[1])
    }
    count++
    if (count > limit) {
      allowed = false
      retryAfter = (w + 1) * windowSeconds - nowSeconds
    }
    return w + ":" + count + ":" + windowSeconds
  })
  return { allowed, retryAfter: Math.max(1, retryAfter) }
}

function limit(name, subject, max, windowSeconds) {
  const result = hit(name, subject, max, windowSeconds)
  if (!result.allowed) fail(429, "slow_down", { retryAfter: result.retryAfter })
}

function cleanupRateLimits() {
  const store = $app.store()
  const nowSeconds = Math.floor(Date.now() / 1000)
  for (const key of store.keys()) {
    if (key.indexOf("rl:") !== 0) continue
    const parts = String(store.get(key)).split(":")
    const windowSeconds = Number(parts[2]) || 3600
    if (Number(parts[0]) < Math.floor(nowSeconds / windowSeconds)) store.remove(key)
  }
}

// --- JSON shapes -----------------------------------------------------------------

function newsletterAvailable(event) {
  const config = require(`${__hooks}/lib/config.js`).load()
  return config.mailEnabled && !!event.getString("owner")
}

function publicEvent(event) {
  const newsletterOn = event.getBool("newsletter_enabled") && newsletterAvailable(event)
  return {
    code: event.getString("code"),
    title: event.getString("title"),
    description: event.getString("description"),
    startsAt: iso(event, "starts_at"),
    screen: event.getString("screen"),
    moderation: event.getBool("moderation"),
    spotlight: event.getString("spotlight") || null,
    closed: !!event.getString("closed_at"),
    closedAt: iso(event, "closed_at"),
    newsletter: newsletterOn
      ? {
          org: event.getString("newsletter_org"),
          purpose: event.getString("newsletter_purpose"),
          privacyUrl: event.getString("newsletter_privacy_url") || null,
        }
      : null,
  }
}

function adminEvent(event) {
  return Object.assign(publicEvent(event), {
    hasOwner: !!event.getString("owner"),
    newsletterAvailable: newsletterAvailable(event),
    newsletterEnabled: event.getBool("newsletter_enabled"),
    newsletterOrg: event.getString("newsletter_org"),
    newsletterPurpose: event.getString("newsletter_purpose"),
    newsletterPrivacyUrl: event.getString("newsletter_privacy_url"),
    created: iso(event, "created"),
    lastActivityAt: iso(event, "last_activity_at"),
  })
}

function publicQuestion(q) {
  return {
    id: q.id,
    content: q.getString("content"),
    animal: q.getString("animal"),
    name: q.getString("name"),
    votes: q.getInt("votes"),
    pinned: q.getBool("pinned"),
    answeredAt: iso(q, "answered_at"),
    created: iso(q, "created"),
  }
}

function modQuestion(q) {
  return Object.assign(publicQuestion(q), {
    status: q.getString("status"),
    approvedAt: iso(q, "approved_at"),
  })
}

function participantShape(p) {
  return { id: p.id, animal: p.getString("animal"), name: p.getString("name") }
}

module.exports = {
  fail, route, body, header, str, randomCode, newSecret, hash, iso, now,
  findEvent, accessFor, requireAccess, findParticipant, requireOpen,
  hit, limit, cleanupRateLimits,
  publicEvent, adminEvent, publicQuestion, modQuestion, participantShape,
}
