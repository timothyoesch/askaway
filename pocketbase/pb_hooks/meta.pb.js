/// <reference path="../pb_data/types.d.ts" />

// Link previews: when an event link (/e/<CODE>) is shared in a chat app, the
// crawler gets the app's index.html with the event's title and description
// already filled in. Browsers get the same page and boot the SPA as usual.
routerAdd("GET", "/e/{code}", (e) => {
  const { escapeHtml } = require(`${__hooks}/lib/mail.js`)
  const publicDir = $os.getenv("ASKAWAY_PUBLIC_DIR") || `${__hooks}/../pb_public`

  let html = ""
  try {
    html = toString($os.readFile(`${publicDir}/index.html`))
  } catch (_) {
    return e.next() // no built frontend (e.g. API-only development)
  }

  let title = "Ask Away!"
  let description = "Ask Away! – Live Q&A, simple and tracking-free."
  try {
    const event = $app.findFirstRecordByData("events", "code", String(e.request.pathValue("code")).toUpperCase())
    title = event.getString("title") + " · Ask Away!"
    if (event.getString("description")) description = event.getString("description").slice(0, 200)
  } catch (_) {
    // Unknown code: keep the generic preview; the SPA shows the friendly 404.
  }

  const tags =
    "<title>" + escapeHtml(title) + "</title>" +
    '<meta name="description" content="' + escapeHtml(description) + '">' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">' +
    '<meta property="og:description" content="' + escapeHtml(description) + '">' +
    '<meta property="og:type" content="website">'

  const anchor = html.indexOf('<meta charset="utf-8">') !== -1 ? '<meta charset="utf-8">' : "<head>"
  return e.html(200, html.replace(anchor, anchor + tags))
})
