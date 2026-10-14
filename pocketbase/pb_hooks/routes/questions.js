/// <reference path="../../pb_data/types.d.ts" />

const h = require(`${__hooks}/lib/http.js`)
const config = require(`${__hooks}/lib/config.js`)
const realtime = require(`${__hooks}/lib/realtime.js`)

function context(e) {
  const event = h.findEvent(e.request.pathValue("code"))
  const participant = h.findParticipant(e, event, true)
  return { event, participant, code: event.getString("code") }
}

function findQuestion(event, id) {
  let q = null
  try {
    q = $app.findRecordById("questions", id)
  } catch (_) {
    q = null
  }
  if (!q || q.getString("event") !== event.id) h.fail(404, "question_not_found")
  return q
}

function cleanContent(value) {
  const cfg = config.load()
  const content = h.str(value)
  if (!content) h.fail(400, "question_empty")
  if (content.length > cfg.questionMaxLength) h.fail(400, "question_too_long", { max: cfg.questionMaxLength })
  return content
}

// Sends a question update: everyone sees approved ones, moderators see all.
// `wasVisible` tells whether participants may still be showing the question.
function announce(code, q, wasVisible) {
  const visible = q.getString("status") === "approved"
  let publicPayload = null
  if (visible) publicPayload = { type: "question", question: h.publicQuestion(q) }
  else if (wasVisible) publicPayload = { type: "question_removed", id: q.id }
  realtime.broadcast(code, publicPayload, { type: "question", question: h.modQuestion(q) })
}

function announceRemoved(code, id) {
  realtime.broadcast(code, { type: "question_removed", id }, { type: "question_removed", id })
}

function touch(event) {
  event.set("last_activity_at", h.now())
  $app.save(event)
}

// POST /api/askaway/events/{code}/questions
function ask(e) {
  const { event, participant, code } = context(e)
  h.requireOpen(event)
  const cfg = config.load()
  const content = cleanContent(h.body(e).content)

  const last = $app.findRecordsByFilter(
    "questions", "participant = {:p}", "-created", 1, 0, { p: participant.id }
  )
  if (last.length && cfg.questionCooldownSeconds > 0) {
    const elapsed = (Date.now() - new Date(h.iso(last[0], "created")).getTime()) / 1000
    if (elapsed < cfg.questionCooldownSeconds) {
      h.fail(429, "slow_down", { retryAfter: Math.ceil(cfg.questionCooldownSeconds - elapsed) })
    }
  }
  h.limit("questions-hour", participant.id, 20, 3600)

  const approved = !event.getBool("moderation")
  const question = new Record($app.findCollectionByNameOrId("questions"))
  $app.runInTransaction((tx) => {
    question.set("event", event.id)
    question.set("participant", participant.id)
    question.set("content", content)
    question.set("animal", participant.getString("animal"))
    question.set("name", participant.getString("name"))
    question.set("status", approved ? "approved" : "pending")
    if (approved) question.set("approved_at", h.now())
    // Askers automatically upvote their own question.
    question.set("votes", 1)
    tx.save(question)

    const vote = new Record(tx.findCollectionByNameOrId("votes"))
    vote.set("event", event.id)
    vote.set("question", question.id)
    vote.set("participant", participant.id)
    tx.save(vote)
  })
  touch(event)
  announce(code, question, false)
  return { question: h.modQuestion(question) }
}

function ownQuestion(e) {
  const ctx = context(e)
  const q = findQuestion(ctx.event, e.request.pathValue("id"))
  if (q.getString("participant") !== ctx.participant.id) h.fail(403, "not_your_question")
  return Object.assign(ctx, { q })
}

// PATCH /api/askaway/events/{code}/questions/{id}  (own, while pending)
function edit(e) {
  const { event, code, q } = ownQuestion(e)
  h.requireOpen(event)
  if (q.getString("status") !== "pending") h.fail(409, "question_locked")
  h.limit("edit", q.id, 10, 600)
  q.set("content", cleanContent(h.body(e).content))
  $app.save(q)
  announce(code, q, false)
  return { question: h.modQuestion(q) }
}

// DELETE /api/askaway/events/{code}/questions/{id}  (own, until answered)
function withdraw(e) {
  const { event, code, q } = ownQuestion(e)
  if (q.getString("answered_at")) h.fail(409, "question_locked")
  const id = q.id
  const wasVisible = q.getString("status") === "approved"
  $app.delete(q)
  if (event.getString("spotlight") === id) {
    event.set("spotlight", "")
    $app.save(event)
    realtime.broadcast(code, { type: "event", event: h.publicEvent(event) }, { type: "event", event: h.adminEvent(event) })
  }
  if (wasVisible) announceRemoved(code, id)
  else realtime.broadcast(code, null, { type: "question_removed", id })
}

function currentVotes(id) {
  const row = new DynamicModel({ votes: 0 })
  $app.db().newQuery("SELECT votes FROM questions WHERE id = {:id}").bind({ id }).one(row)
  return row.votes
}

function votable(e) {
  const ctx = context(e)
  h.requireOpen(ctx.event)
  const q = findQuestion(ctx.event, e.request.pathValue("id"))
  if (q.getString("status") !== "approved") h.fail(409, "question_not_votable")
  h.limit("vote", ctx.participant.id, config.load().votesPerMinute, 60)
  return Object.assign(ctx, { q })
}

function hasVoted(questionId, participantId) {
  return $app.countRecords("votes", $dbx.hashExp({ question: questionId, participant: participantId })) > 0
}

// POST /api/askaway/events/{code}/questions/{id}/vote
function vote(e) {
  const { event, participant, code, q } = votable(e)
  if (!hasVoted(q.id, participant.id)) {
    try {
      $app.runInTransaction((tx) => {
        const v = new Record(tx.findCollectionByNameOrId("votes"))
        v.set("event", event.id)
        v.set("question", q.id)
        v.set("participant", participant.id)
        tx.save(v)
        tx.db().newQuery("UPDATE questions SET votes = votes + 1 WHERE id = {:id}").bind({ id: q.id }).execute()
      })
    } catch (_) {
      // A concurrent request already stored this vote (unique index); nothing to do.
    }
  }
  const votes = currentVotes(q.id)
  realtime.broadcast(code, { type: "votes", id: q.id, votes }, { type: "votes", id: q.id, votes })
  return { votes, voted: true }
}

// DELETE /api/askaway/events/{code}/questions/{id}/vote
function unvote(e) {
  const { participant, code, q } = votable(e)
  const existing = $app.findRecordsByFilter(
    "votes", "question = {:q} && participant = {:p}", "", 1, 0, { q: q.id, p: participant.id }
  )
  if (existing.length) {
    $app.runInTransaction((tx) => {
      tx.delete(existing[0])
      tx.db().newQuery("UPDATE questions SET votes = MAX(votes - 1, 0) WHERE id = {:id}").bind({ id: q.id }).execute()
    })
  }
  const votes = currentVotes(q.id)
  realtime.broadcast(code, { type: "votes", id: q.id, votes }, { type: "votes", id: q.id, votes })
  return { votes, voted: false }
}

module.exports = { ask, edit, withdraw, vote, unvote, announce, announceRemoved, findQuestion }
