/// <reference path="../../pb_data/types.d.ts" />

const h = require(`${__hooks}/lib/http.js`)
const config = require(`${__hooks}/lib/config.js`)
const animals = require(`${__hooks}/lib/animals.js`)
const realtime = require(`${__hooks}/lib/realtime.js`)
const newsletter = require(`${__hooks}/routes/newsletter.js`)

function appUser(e) {
  return e.auth && e.auth.collection().name === "users" ? e.auth : null
}

function parseDate(value) {
  const s = h.str(value)
  if (!s) return ""
  const d = new Date(s)
  if (isNaN(d.getTime())) h.fail(400, "invalid_date")
  return d.toISOString()
}

// POST /api/askaway/events
function create(e) {
  const cfg = config.load()
  const user = appUser(e)
  if (cfg.eventCreation === "registered" && !user && !e.hasSuperuserAuth()) {
    h.fail(403, "login_required")
  }
  h.limit("event-create", e.realIP(), cfg.eventsPerHourPerIp, 3600)

  const b = h.body(e)
  const title = h.str(b.title, 120)
  if (!title) h.fail(400, "title_required")

  let code = h.randomCode()
  for (let i = 0; i < 10 && $app.countRecords("events", $dbx.hashExp({ code })) > 0; i++) {
    code = h.randomCode()
  }

  const ownerKey = h.newSecret()
  const modKey = h.newSecret()
  const record = new Record($app.findCollectionByNameOrId("events"))
  record.set("code", code)
  record.set("title", title)
  record.set("description", h.str(b.description, 1000))
  record.set("starts_at", parseDate(b.startsAt))
  record.set("owner", user ? user.id : "")
  record.set("owner_key_hash", h.hash(ownerKey))
  record.set("mod_key_hash", h.hash(modKey))
  record.set("screen", "registration")
  record.set("moderation", typeof b.moderation === "boolean" ? b.moderation : cfg.defaultModeration)
  record.set("last_activity_at", h.now())
  $app.save(record)

  return { code, ownerKey, modKey, role: "owner", event: h.adminEvent(record) }
}

function meFor(event, participant) {
  const votes = $app.findRecordsByFilter(
    "votes", "participant = {:p}", "", 5000, 0, { p: participant.id }
  )
  const own = $app.findRecordsByFilter(
    "questions", "participant = {:p} && status != 'approved'", "-created", 200, 0, { p: participant.id }
  )
  return {
    participant: h.participantShape(participant),
    votes: votes.map((v) => v.getString("question")),
    questions: own.map(h.modQuestion),
    ownApproved: $app
      .findRecordsByFilter("questions", "participant = {:p} && status = 'approved'", "", 200, 0, { p: participant.id })
      .map((q) => q.id),
  }
}

// GET /api/askaway/events/{code}
function show(e) {
  const event = h.findEvent(e.request.pathValue("code"))
  const questions = $app.findRecordsByFilter(
    "questions", "event = {:event} && status = 'approved'", "-pinned,-votes,created", 2000, 0, { event: event.id }
  )
  const result = {
    event: h.publicEvent(event),
    questions: questions.map(h.publicQuestion),
  }
  if (result.event.newsletter) {
    result.event.newsletter.consentText = newsletter.consentText(e.request.url.query().get("lang"), event)
  }
  const participant = h.findParticipant(e, event, false)
  if (participant) result.me = meFor(event, participant)
  return result
}

// GET /api/askaway/events/{code}/presence
function presence(e) {
  const event = h.findEvent(e.request.pathValue("code"))
  return { count: realtime.presence(event.getString("code")) }
}

// POST /api/askaway/events/{code}/participants
function join(e) {
  const event = h.findEvent(e.request.pathValue("code"))
  // Generous per-IP limit: a whole venue can share a single IP.
  h.limit("participant-create", e.realIP(), 1200, 60)

  const token = h.newSecret()
  const record = new Record($app.findCollectionByNameOrId("participants"))
  record.set("event", event.id)
  record.set("token_hash", h.hash(token))
  record.set("animal", animals.randomAnimal())
  $app.save(record)
  return { token, me: meFor(event, record) }
}

// PATCH /api/askaway/events/{code}/me
function rename(e) {
  const event = h.findEvent(e.request.pathValue("code"))
  const participant = h.findParticipant(e, event, true)
  h.limit("rename", participant.id, 20, 600)
  const b = h.body(e)
  if (b.name !== undefined) participant.set("name", h.str(b.name, 40))
  if (b.animal !== undefined && animals.isAnimal(b.animal)) participant.set("animal", b.animal)
  $app.save(participant)
  return { participant: h.participantShape(participant) }
}

// GET /api/askaway/me/events
function mine(e) {
  const user = appUser(e)
  if (!user) h.fail(401, "login_required")
  const events = $app.findRecordsByFilter("events", "owner = {:u}", "-created", 500, 0, { u: user.id })
  return { events: events.map((ev) => h.adminEvent(ev)) }
}

// GET /api/askaway/config
function publicConfig() {
  const cfg = config.load()
  return {
    eventCreation: cfg.eventCreation,
    registration: cfg.registration,
    mailEnabled: cfg.mailEnabled,
    defaultModeration: cfg.defaultModeration,
    questionMaxLength: cfg.questionMaxLength,
    questionCooldownSeconds: cfg.questionCooldownSeconds,
    retentionDays: cfg.retentionDays,
  }
}

module.exports = { create, show, presence, join, rename, mine, publicConfig, meFor }
