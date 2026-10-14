/// <reference path="../../pb_data/types.d.ts" />

// Instance configuration, read from environment variables.
// Every variable is documented in .env.example and docs/deployment.md.

function env(name, fallback) {
  const value = $os.getenv(name)
  return value === "" ? fallback : value
}

function intEnv(name, fallback) {
  const value = parseInt(env(name, ""), 10)
  return isNaN(value) ? fallback : value
}

function boolEnv(name, fallback) {
  const value = env(name, "").toLowerCase()
  if (value === "") return fallback
  return ["1", "true", "yes", "on"].indexOf(value) !== -1
}

function oneOf(name, allowed, fallback) {
  const value = env(name, fallback).toLowerCase()
  return allowed.indexOf(value) !== -1 ? value : fallback
}

function load() {
  return {
    appUrl: env("APP_URL", "").replace(/\/+$/, ""),
    appName: env("APP_NAME", "Ask Away!"),

    // Who may create events: "anyone" or "registered" (logged-in users only).
    eventCreation: oneOf("EVENT_CREATION", ["anyone", "registered"], "anyone"),
    // Whether new accounts can be created by logging in: "open" or "closed".
    registration: oneOf("REGISTRATION", ["open", "closed"], "open"),

    // Default for the per-event "needs approval" switch.
    defaultModeration: boolEnv("DEFAULT_MODERATION", true),

    // Spam protection
    questionMaxLength: intEnv("QUESTION_MAX_LENGTH", 300),
    questionCooldownSeconds: intEnv("QUESTION_COOLDOWN_SECONDS", 30),
    votesPerMinute: intEnv("VOTES_PER_MINUTE", 60),
    eventsPerHourPerIp: intEnv("EVENTS_PER_HOUR_PER_IP", 10),

    // Days after an event closes (or goes quiet) until it is deleted. 0 = never.
    retentionDays: intEnv("RETENTION_DAYS", 30),

    mailEnabled: env("SMTP_HOST", "") !== "",
  }
}

module.exports = { load, env, intEnv, boolEnv }
