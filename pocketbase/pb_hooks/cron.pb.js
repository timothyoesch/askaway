/// <reference path="../pb_data/types.d.ts" />

// Automatic deletion ("tracking-free"): events are removed RETENTION_DAYS after
// they were closed, or after their last activity if never closed. Deleting an
// event cascades to its participants, questions, votes and newsletter sign-ups.
cronAdd("askaway_retention", "17 3 * * *", () => {
  const config = require(`${__hooks}/lib/config.js`).load()
  if (config.retentionDays <= 0) return

  const cutoff = new Date(Date.now() - config.retentionDays * 86400000).toISOString().replace("T", " ")
  const stale = $app.findRecordsByFilter(
    "events",
    "(closed_at != '' && closed_at < {:cutoff}) || " +
      "(closed_at = '' && last_activity_at < {:cutoff} && (starts_at = '' || starts_at < {:cutoff}))",
    "", 1000, 0, { cutoff }
  )
  for (const event of stale) {
    $app.delete(event)
  }
  if (stale.length) console.log("[retention] deleted " + stale.length + " event(s)")
})

// Unconfirmed newsletter sign-ups are dropped after 7 days.
cronAdd("askaway_unconfirmed_subscribers", "27 3 * * *", () => {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString().replace("T", " ")
  $app.db()
    .newQuery("DELETE FROM subscribers WHERE confirmed_at = '' AND created < {:cutoff}")
    .bind({ cutoff })
    .execute()
})

cronAdd("askaway_rate_limit_cleanup", "*/10 * * * *", () => {
  require(`${__hooks}/lib/http.js`).cleanupRateLimits()
})
