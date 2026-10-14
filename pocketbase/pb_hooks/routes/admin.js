/// <reference path="../../pb_data/types.d.ts" />

const h = require(`${__hooks}/lib/http.js`)
const realtime = require(`${__hooks}/lib/realtime.js`)
const questions = require(`${__hooks}/routes/questions.js`)

function context(e, minimum) {
  const event = h.findEvent(e.request.pathValue("code"))
  const role = h.requireAccess(e, event, minimum)
  return { event, role, code: event.getString("code") }
}

function announceEvent(code, event) {
  realtime.broadcast(
    code,
    { type: "event", event: h.publicEvent(event) },
    { type: "event", event: h.adminEvent(event) }
  )
}

// GET /api/askaway/events/{code}/admin
function show(e) {
  const { event, role, code } = context(e)
  const all = $app.findRecordsByFilter("questions", "event = {:event}", "created", 5000, 0, { event: event.id })
  return {
    role,
    event: h.adminEvent(event),
    questions: all.map(h.modQuestion),
    presence: realtime.presence(code),
  }
}

// POST /api/askaway/events/{code}/admin/questions/{id}  { action }
function questionAction(e) {
  const { event, code } = context(e)
  const q = questions.findQuestion(event, e.request.pathValue("id"))
  const action = h.str(h.body(e).action)
  const wasVisible = q.getString("status") === "approved"
  let eventChanged = false

  const clearSpotlight = () => {
    if (event.getString("spotlight") === q.id) {
      event.set("spotlight", "")
      eventChanged = true
    }
  }

  switch (action) {
    case "approve":
      q.set("status", "approved")
      if (!q.getString("approved_at")) q.set("approved_at", h.now())
      break
    case "reject":
      q.set("status", "rejected")
      q.set("pinned", false)
      clearSpotlight()
      break
    case "restore":
      q.set("status", "pending")
      break
    case "answer":
      q.set("answered_at", h.now())
      q.set("pinned", false)
      clearSpotlight()
      break
    case "unanswer":
      q.set("answered_at", "")
      break
    case "pin":
      q.set("pinned", true)
      break
    case "unpin":
      q.set("pinned", false)
      break
    case "spotlight":
      if (q.getString("status") !== "approved") h.fail(409, "question_not_approved")
      if (q.getString("answered_at")) q.set("answered_at", "")
      event.set("spotlight", q.id)
      eventChanged = true
      break
    case "unspotlight":
      clearSpotlight()
      break
    case "delete": {
      const id = q.id
      clearSpotlight()
      if (eventChanged) $app.save(event)
      $app.delete(q)
      if (eventChanged) announceEvent(code, event)
      if (wasVisible) questions.announceRemoved(code, id)
      else realtime.broadcast(code, null, { type: "question_removed", id })
      return { deleted: id }
    }
    default:
      h.fail(400, "unknown_action")
  }

  $app.save(q)
  if (eventChanged) $app.save(event)
  questions.announce(code, q, wasVisible)
  if (eventChanged) announceEvent(code, event)
  return { question: h.modQuestion(q), event: h.adminEvent(event) }
}

// PATCH /api/askaway/events/{code}/admin/event
// Moderators may switch the screen; owners may change everything.
function update(e) {
  const { event, role, code } = context(e)
  const b = h.body(e)

  if (b.screen !== undefined) {
    if (["registration", "questions"].indexOf(b.screen) === -1) h.fail(400, "invalid_screen")
    event.set("screen", b.screen)
  }

  const ownerFields = ["title", "description", "startsAt", "moderation",
    "newsletterEnabled", "newsletterOrg", "newsletterPurpose", "newsletterPrivacyUrl"]
  const touchesOwnerFields = ownerFields.some((f) => b[f] !== undefined)
  if (touchesOwnerFields && role !== "owner") h.fail(403, "owner_only")

  if (b.title !== undefined) {
    const title = h.str(b.title, 120)
    if (!title) h.fail(400, "title_required")
    event.set("title", title)
  }
  if (b.description !== undefined) event.set("description", h.str(b.description, 1000))
  if (b.startsAt !== undefined) {
    const s = h.str(b.startsAt)
    const d = new Date(s)
    if (s && isNaN(d.getTime())) h.fail(400, "invalid_date")
    event.set("starts_at", s ? d.toISOString() : "")
  }
  if (typeof b.moderation === "boolean") event.set("moderation", b.moderation)
  if (b.newsletterOrg !== undefined) event.set("newsletter_org", h.str(b.newsletterOrg, 120))
  if (b.newsletterPurpose !== undefined) event.set("newsletter_purpose", h.str(b.newsletterPurpose, 300))
  if (b.newsletterPrivacyUrl !== undefined) {
    const url = h.str(b.newsletterPrivacyUrl, 500)
    if (url && !/^https?:\/\//.test(url)) h.fail(400, "invalid_url")
    event.set("newsletter_privacy_url", url)
  }
  if (typeof b.newsletterEnabled === "boolean") {
    if (b.newsletterEnabled) {
      if (!h.adminEvent(event).newsletterAvailable) h.fail(409, "newsletter_unavailable")
      if (!event.getString("newsletter_org") || !event.getString("newsletter_purpose")) {
        h.fail(400, "newsletter_incomplete")
      }
    }
    event.set("newsletter_enabled", b.newsletterEnabled)
  }

  event.set("last_activity_at", h.now())
  $app.save(event)
  announceEvent(code, event)
  return { event: h.adminEvent(event) }
}

// POST /api/askaway/events/{code}/admin/close and /reopen
function close(e) {
  const { event, code } = context(e, "owner")
  if (!event.getString("closed_at")) {
    event.set("closed_at", h.now())
    event.set("spotlight", "")
    $app.save(event)
    announceEvent(code, event)
  }
  return { event: h.adminEvent(event) }
}

function reopen(e) {
  const { event, code } = context(e, "owner")
  event.set("closed_at", "")
  event.set("last_activity_at", h.now())
  $app.save(event)
  announceEvent(code, event)
  return { event: h.adminEvent(event) }
}

// DELETE /api/askaway/events/{code}/admin
function destroy(e) {
  const { event, code } = context(e, "owner")
  $app.delete(event)
  realtime.broadcast(code, { type: "deleted" }, { type: "deleted" })
}

// POST /api/askaway/events/{code}/admin/mod-key  → new moderator link
// Existing moderators are disconnected from the moderation channel.
function rotateModKey(e) {
  const { event, code } = context(e, "owner")
  const modKey = h.newSecret()
  event.set("mod_key_hash", h.hash(modKey))
  $app.save(event)

  const topic = realtime.modTopic(code)
  for (const chunk of $app.subscriptionsBroker().chunkedClients(500)) {
    for (const client of chunk) {
      const subs = client.subscriptions(topic)
      for (const key in subs) {
        if (client.get("askaway_role:" + code) === "mod") {
          client.unsubscribe(key)
          client.send(new SubscriptionMessage({ name: key, data: JSON.stringify({ type: "access_revoked" }) }))
        }
      }
    }
  }
  return { modKey }
}

// POST /api/askaway/events/{code}/admin/claim  → attach an anonymous event to the logged-in account
function claim(e) {
  const { event } = context(e, "owner")
  if (!e.auth || e.auth.collection().name !== "users") h.fail(401, "login_required")
  const current = event.getString("owner")
  if (current && current !== e.auth.id) h.fail(409, "already_claimed")
  event.set("owner", e.auth.id)
  $app.save(event)
  return { event: h.adminEvent(event) }
}

// GET /api/askaway/events/{code}/admin/subscribers
function subscribers(e) {
  const { event } = context(e, "owner")
  const confirmed = $app.findRecordsByFilter(
    "subscribers", "event = {:event} && confirmed_at != ''", "confirmed_at", 100000, 0, { event: event.id }
  )
  const pending = $app.countRecords(
    "subscribers", $dbx.hashExp({ event: event.id, confirmed_at: "" })
  )
  return {
    pending,
    subscribers: confirmed.map((s) => ({
      email: s.getString("email"),
      name: s.getString("name"),
      consentText: s.getString("consent_text"),
      consentAt: h.iso(s, "consent_at"),
      confirmedAt: h.iso(s, "confirmed_at"),
    })),
  }
}

// DELETE /api/askaway/events/{code}/admin/subscribers
function deleteSubscribers(e) {
  const { event } = context(e, "owner")
  $app.db().newQuery("DELETE FROM subscribers WHERE event = {:event}").bind({ event: event.id }).execute()
}

module.exports = {
  show, questionAction, update, close, reopen, destroy, rotateModKey, claim,
  subscribers, deleteSubscribers,
}
