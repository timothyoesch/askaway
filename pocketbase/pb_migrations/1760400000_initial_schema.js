/// <reference path="../pb_data/types.d.ts" />

// Initial Ask Away! v2 schema.
//
// All app collections have their API rules set to null (= superusers only).
// Clients never touch them directly; everything goes through the custom
// routes in pb_hooks, which enforce access, rate limits and realtime fan-out.

migrate((app) => {
  // --- users: passwordless login with a one-time code sent by email ---------
  const users = app.findCollectionByNameOrId("users")
  users.listRule = null
  users.viewRule = "id = @request.auth.id"
  users.createRule = null // accounts are created by POST /api/askaway/auth/start
  users.updateRule = "id = @request.auth.id"
  users.deleteRule = "id = @request.auth.id"
  users.passwordAuth.enabled = false
  users.otp.enabled = true
  users.otp.duration = 600
  users.otp.length = 6
  users.fields.add(new TextField({ name: "lang", max: 5 }))
  app.save(users)

  // --- events ---------------------------------------------------------------
  const events = new Collection({
    type: "base",
    name: "events",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "code", required: true, min: 6, max: 6, pattern: "^[0-9A-Z]+$" },
      { type: "text", name: "title", required: true, max: 120 },
      { type: "text", name: "description", max: 1000 },
      { type: "date", name: "starts_at" },
      { type: "relation", name: "owner", collectionId: users.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "owner_key_hash", required: true, hidden: true },
      { type: "text", name: "mod_key_hash", required: true, hidden: true },
      { type: "select", name: "screen", values: ["registration", "questions"], maxSelect: 1, required: true },
      { type: "bool", name: "moderation" },
      { type: "text", name: "spotlight", max: 15 },
      { type: "date", name: "closed_at" },
      { type: "date", name: "last_activity_at" },
      { type: "bool", name: "newsletter_enabled" },
      { type: "text", name: "newsletter_org", max: 120 },
      { type: "text", name: "newsletter_purpose", max: 300 },
      { type: "url", name: "newsletter_privacy_url" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_events_code ON events (code)",
      "CREATE INDEX idx_events_owner ON events (owner)",
    ],
  })
  app.save(events)

  // --- participants: one per device per event, identified by a secret token --
  const participants = new Collection({
    type: "base",
    name: "participants",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "event", collectionId: events.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "text", name: "token_hash", required: true, hidden: true },
      { type: "text", name: "animal", required: true, max: 30 },
      { type: "text", name: "name", max: 40 },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_participants_token ON participants (token_hash)",
      "CREATE INDEX idx_participants_event ON participants (event)",
    ],
  })
  app.save(participants)

  // --- questions --------------------------------------------------------------
  const questions = new Collection({
    type: "base",
    name: "questions",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "event", collectionId: events.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "relation", name: "participant", collectionId: participants.id, maxSelect: 1, cascadeDelete: true },
      { type: "text", name: "content", required: true, max: 2000 },
      // Snapshot of the author's display identity at the time of asking.
      { type: "text", name: "animal", max: 30 },
      { type: "text", name: "name", max: 40 },
      { type: "select", name: "status", values: ["pending", "approved", "rejected"], maxSelect: 1, required: true },
      { type: "number", name: "votes", onlyInt: true, min: 0 },
      { type: "bool", name: "pinned" },
      { type: "date", name: "approved_at" },
      { type: "date", name: "answered_at" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE INDEX idx_questions_event_status ON questions (event, status)",
      "CREATE INDEX idx_questions_participant ON questions (participant, created)",
    ],
  })
  app.save(questions)

  // --- votes: unique per (question, participant), so votes can't be duplicated -
  const votes = new Collection({
    type: "base",
    name: "votes",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "event", collectionId: events.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "relation", name: "question", collectionId: questions.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "relation", name: "participant", collectionId: participants.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_votes_unique ON votes (question, participant)",
      "CREATE INDEX idx_votes_participant ON votes (participant, created)",
    ],
  })
  app.save(votes)

  // --- subscribers: newsletter opt-ins, double opt-in, deleted with the event --
  const subscribers = new Collection({
    type: "base",
    name: "subscribers",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "relation", name: "event", collectionId: events.id, maxSelect: 1, cascadeDelete: true, required: true },
      { type: "email", name: "email", required: true },
      { type: "text", name: "name", max: 80 },
      // Exact consent wording shown to the person, plus when they agreed.
      { type: "text", name: "consent_text", required: true, max: 1000 },
      { type: "date", name: "consent_at", required: true },
      { type: "text", name: "confirm_token_hash", hidden: true },
      { type: "date", name: "confirmed_at" },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_subscribers_event_email ON subscribers (event, email)",
      "CREATE INDEX idx_subscribers_token ON subscribers (confirm_token_hash)",
    ],
  })
  app.save(subscribers)
}, (app) => {
  for (const name of ["subscribers", "votes", "questions", "participants", "events"]) {
    app.delete(app.findCollectionByNameOrId(name))
  }
  const users = app.findCollectionByNameOrId("users")
  users.passwordAuth.enabled = true
  users.otp.enabled = false
  users.fields.removeByName("lang")
  app.save(users)
})
