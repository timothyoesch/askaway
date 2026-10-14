/// <reference path="../../pb_data/types.d.ts" />

// Small bilingual email templates. Kept deliberately plain so they render well
// in every mail client.

const STRINGS = {
  de: {
    otpSubject: "Dein Login-Code für Ask Away! 🔑",
    otpIntro: "Hallöchen! 👋 Hier ist dein Login-Code:",
    otpOutro: "Der Code ist 10 Minuten gültig. Falls du dich nicht anmelden wolltest, kannst du diese Mail einfach ignorieren. 💜",
    confirmSubject: "Bitte bestätige deine Anmeldung 💌",
    confirmIntro: "Fast geschafft! Du hast dich bei «{event}» angemeldet, um von {org} auf dem Laufenden gehalten zu werden.",
    confirmButton: "Ja, ich will auf dem Laufenden bleiben",
    confirmOutro: "Falls du das nicht warst, ignoriere diese Mail einfach – ohne Bestätigung speichern wir nichts dauerhaft.",
    footer: "Gesendet von Ask Away! – Live Q&A, simpel und tracking-frei.",
  },
  en: {
    otpSubject: "Your Ask Away! login code 🔑",
    otpIntro: "Hi there! 👋 Here's your login code:",
    otpOutro: "The code is valid for 10 minutes. If you didn't try to log in, you can simply ignore this email. 💜",
    confirmSubject: "Please confirm your sign-up 💌",
    confirmIntro: "Almost there! You signed up at «{event}» to be kept up to date by {org}.",
    confirmButton: "Yes, keep me posted",
    confirmOutro: "If this wasn't you, just ignore this email – nothing is kept without your confirmation.",
    footer: "Sent by Ask Away! – live Q&A, simple and tracking-free.",
  },
}

function lang(value) {
  return value === "en" ? "en" : "de"
}

function t(language, key, vars) {
  let text = STRINGS[lang(language)][key]
  for (const name in vars || {}) {
    text = text.split("{" + name + "}").join(vars[name])
  }
  return text
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function layout(language, inner) {
  return (
    '<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f1147">' +
    '<p style="font-size:28px;font-weight:700;color:#4400ff;margin:0 0 16px">Ask Away!</p>' +
    inner +
    '<p style="font-size:12px;color:#6b6290;margin-top:32px">' + escapeHtml(t(language, "footer")) + "</p>" +
    "</div>"
  )
}

function from() {
  const meta = $app.settings().meta
  return { address: meta.senderAddress, name: meta.senderName }
}

function otpMessage(language, code) {
  const html = layout(
    language,
    "<p>" + escapeHtml(t(language, "otpIntro")) + "</p>" +
      '<p style="font-size:36px;letter-spacing:8px;font-weight:700;color:#4400ff;background:#fff0fb;border-radius:12px;padding:16px;text-align:center">' +
      escapeHtml(code) +
      "</p>" +
      "<p>" + escapeHtml(t(language, "otpOutro")) + "</p>"
  )
  return { subject: t(language, "otpSubject"), html }
}

function sendConfirmation(language, to, vars, url) {
  const html = layout(
    language,
    "<p>" + escapeHtml(t(language, "confirmIntro", vars)) + "</p>" +
      '<p style="margin:24px 0"><a href="' + escapeHtml(url) + '" style="background:#4400ff;color:#ffadec;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">' +
      escapeHtml(t(language, "confirmButton")) +
      "</a></p>" +
      "<p>" + escapeHtml(t(language, "confirmOutro")) + "</p>"
  )
  const message = new MailerMessage({
    from: from(),
    to: [{ address: to }],
    subject: t(language, "confirmSubject"),
    html,
  })
  $app.newMailClient().send(message)
}

module.exports = { lang, otpMessage, sendConfirmation, escapeHtml }
