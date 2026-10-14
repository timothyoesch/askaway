/// <reference path="../../pb_data/types.d.ts" />

// Realtime fan-out over custom PocketBase topics (one set per event):
//
//   askaway/<CODE>        public: approved questions, votes, event changes
//   askaway/<CODE>/here   no messages; marks a participant as "present"
//   askaway/<CODE>/mod    moderators/owners only (checked in realtime.pb.js)
//
// Messages are JSON: { type: "...", ...payload }.
//
// A client may subscribe with options (the JS SDK appends "?options=..." to the
// topic) and only receives a message when its name matches that exact key, so
// we send each client the message under its own subscription key.

const PREFIX = "askaway/"

function publicTopic(code) {
  return PREFIX + code
}

function hereTopic(code) {
  return PREFIX + code + "/here"
}

function modTopic(code) {
  return PREFIX + code + "/mod"
}

function matchingKeys(client, topic) {
  const keys = []
  const subs = client.subscriptions(topic)
  for (const key in subs) {
    if (key === topic || key.indexOf(topic + "?") === 0) keys.push(key)
  }
  return keys
}

// Public topics are subscribed without options, so an exact lookup is enough
// (this is the hot path: every vote goes to every connected phone). The
// moderator topic carries the key as an option and needs the prefix match.
function send(topic, payload, withOptions) {
  const data = JSON.stringify(payload)
  const message = new SubscriptionMessage({ name: topic, data })
  const chunks = $app.subscriptionsBroker().chunkedClients(500)
  for (const chunk of chunks) {
    for (const client of chunk) {
      if (client.isDiscarded()) continue
      if (!withOptions) {
        if (client.hasSubscription(topic)) client.send(message)
        continue
      }
      for (const key of matchingKeys(client, topic)) {
        client.send(new SubscriptionMessage({ name: key, data }))
      }
    }
  }
}

// Sends a public payload to everyone and a (possibly richer) one to moderators.
function broadcast(code, publicPayload, modPayload) {
  if (publicPayload) send(publicTopic(code), publicPayload)
  if (modPayload) send(modTopic(code), modPayload, true)
}

function presence(code) {
  const topic = hereTopic(code)
  let count = 0
  const chunks = $app.subscriptionsBroker().chunkedClients(500)
  for (const chunk of chunks) {
    for (const client of chunk) {
      if (!client.isDiscarded() && client.hasSubscription(topic)) count++
    }
  }
  return count
}

module.exports = { publicTopic, hereTopic, modTopic, send, broadcast, presence }
