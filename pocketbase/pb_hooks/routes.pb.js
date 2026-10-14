/// <reference path="../pb_data/types.d.ts" />

// Route registrations. Each handler runs in its own isolated JS context, so
// shared code has to be required inside the handler (see the PocketBase JSVM docs).

// --- public ---------------------------------------------------------------------

routerAdd("GET", "/api/askaway/config", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).publicConfig)
})

routerAdd("POST", "/api/askaway/auth/start", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/auth.js`).start)
})

routerAdd("GET", "/api/askaway/me/events", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).mine)
})

routerAdd("POST", "/api/askaway/events", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).create)
})

routerAdd("GET", "/api/askaway/events/{code}", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).show)
})

routerAdd("GET", "/api/askaway/events/{code}/presence", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).presence)
})

routerAdd("POST", "/api/askaway/events/{code}/participants", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).join)
})

routerAdd("PATCH", "/api/askaway/events/{code}/me", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/events.js`).rename)
})

routerAdd("POST", "/api/askaway/events/{code}/questions", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/questions.js`).ask)
})

routerAdd("PATCH", "/api/askaway/events/{code}/questions/{id}", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/questions.js`).edit)
})

routerAdd("DELETE", "/api/askaway/events/{code}/questions/{id}", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/questions.js`).withdraw)
})

routerAdd("POST", "/api/askaway/events/{code}/questions/{id}/vote", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/questions.js`).vote)
})

routerAdd("DELETE", "/api/askaway/events/{code}/questions/{id}/vote", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/questions.js`).unvote)
})

routerAdd("POST", "/api/askaway/events/{code}/subscribe", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/newsletter.js`).subscribe)
})

routerAdd("POST", "/api/askaway/newsletter/confirm", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/newsletter.js`).confirm)
})

// --- moderators & owners (X-Askaway-Key header or logged-in owner) ---------------

routerAdd("GET", "/api/askaway/events/{code}/admin", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).show)
})

routerAdd("DELETE", "/api/askaway/events/{code}/admin", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).destroy)
})

routerAdd("PATCH", "/api/askaway/events/{code}/admin/event", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).update)
})

routerAdd("POST", "/api/askaway/events/{code}/admin/questions/{id}", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).questionAction)
})

routerAdd("POST", "/api/askaway/events/{code}/admin/close", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).close)
})

routerAdd("POST", "/api/askaway/events/{code}/admin/reopen", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).reopen)
})

routerAdd("POST", "/api/askaway/events/{code}/admin/mod-key", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).rotateModKey)
})

routerAdd("POST", "/api/askaway/events/{code}/admin/claim", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).claim)
})

routerAdd("GET", "/api/askaway/events/{code}/admin/subscribers", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).subscribers)
})

routerAdd("DELETE", "/api/askaway/events/{code}/admin/subscribers", (e) => {
  const h = require(`${__hooks}/lib/http.js`)
  return h.route(e, require(`${__hooks}/routes/admin.js`).deleteSubscribers)
})
