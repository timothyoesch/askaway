/// <reference path="../pb_data/types.d.ts" />

// Guards the moderator channel "askaway/<CODE>/mod". The key is passed as a
// subscription option header (x_askaway_key); logged-in owners are recognised
// by their auth token. Public topics need no check.
onRealtimeSubscribeRequest((e) => {
  const h = require(`${__hooks}/lib/http.js`)

  for (const sub of e.subscriptions) {
    const match = /^askaway\/([0-9A-Z]{6})\/mod(?:\?options=(.*))?$/.exec(sub)
    if (!match) continue

    let key = ""
    if (match[2]) {
      try {
        const options = JSON.parse(decodeURIComponent(match[2]))
        key = String((options.headers || {}).x_askaway_key || "")
      } catch (_) {
        key = ""
      }
    }

    let event = null
    try {
      event = $app.findFirstRecordByData("events", "code", match[1])
    } catch (_) {
      throw new ForbiddenError("no_access")
    }
    const role = h.accessFor(e, event, key)
    if (!role) throw new ForbiddenError("no_access")
    e.client.set("askaway_role:" + match[1], role)
  }

  return e.next()
})
