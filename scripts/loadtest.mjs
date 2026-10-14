#!/usr/bin/env node
// Simulates an audience: N phones join an event, keep a realtime connection
// open, ask some questions and vote for a while. Reports API latencies and how
// long it takes for an update to reach everyone.
//
//   node scripts/loadtest.mjs --url https://ask.example.ch --clients 1000 --seconds 120
//
// Creates its own test event (approval switched off) and deletes it afterwards.
// Run it from a machine with enough open-file headroom (`ulimit -n 10000`).
// Note: all simulated phones share your IP, just like at a venue on one Wi-Fi.

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, arg, i, all) => (arg.startsWith('--') ? [...acc, [arg.slice(2), all[i + 1]]] : acc), []),
)
const BASE = (args.url || 'http://127.0.0.1:8090').replace(/\/$/, '')
const CLIENTS = Number(args.clients || 200)
const SECONDS = Number(args.seconds || 60)
const QUESTIONS = Number(args.questions || 40) // total questions asked during the run
const VOTES_PER_CLIENT = Number(args.votes || 5)

const sleep = ms => new Promise(r => setTimeout(r, ms))
const stats = { api: {}, errors: {}, messages: 0, fanout: [] }

function record(name, ms) {
  ;(stats.api[name] ||= []).push(ms)
}
function fail(name, detail) {
  const key = `${name}: ${detail}`
  stats.errors[key] = (stats.errors[key] || 0) + 1
}

async function api(name, method, path, body, headers = {}) {
  const start = performance.now()
  try {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    record(name, performance.now() - start)
    if (!res.ok) {
      fail(name, `${res.status} ${text.slice(0, 80)}`)
      return null
    }
    return text ? JSON.parse(text) : {}
  } catch (err) {
    fail(name, err.cause?.code || err.message)
    return null
  }
}

// Minimal SSE client for PocketBase's realtime endpoint.
async function connect(topics, onMessage) {
  const controller = new AbortController()
  const res = await fetch(BASE + '/api/realtime', { signal: controller.signal })
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let resolveId
  const clientId = new Promise(r => (resolveId = r))
  ;(async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let index
        while ((index = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, index)
          buffer = buffer.slice(index + 2)
          const event = /^event:(.*)$/m.exec(chunk)?.[1]
          const data = /^data:(.*)$/m.exec(chunk)?.[1]
          if (event === 'PB_CONNECT') resolveId(JSON.parse(data).clientId)
          else if (event && data) onMessage(JSON.parse(data))
        }
      }
    } catch {
      // aborted
    }
  })()
  const id = await clientId
  await api('realtime-subscribe', 'POST', '/api/realtime', { clientId: id, subscriptions: topics })
  return () => controller.abort()
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]
}

async function main() {
  console.log(`→ ${BASE} · ${CLIENTS} clients · ${SECONDS}s`)
  const created = await api('create-event', 'POST', '/api/askaway/events', { title: 'Load test 🧪', moderation: false })
  if (!created) throw new Error('Could not create the test event: ' + JSON.stringify(stats.errors))
  const { code, ownerKey } = created
  console.log(`  event ${code}`)

  // Track when vote updates arrive, to measure fan-out delay.
  const sentAt = new Map()
  const questionIds = []

  // 1. Everyone joins, ramped up over ~10 seconds like people scanning a QR code.
  const clients = []
  const rampMs = 10000 / CLIENTS
  const joins = []
  for (let i = 0; i < CLIENTS; i++) {
    joins.push(
      (async () => {
        const joined = await api('join', 'POST', `/api/askaway/events/${code}/participants`)
        if (!joined) return
        const close = await connect([`askaway/${code}`, `askaway/${code}/here`], (message) => {
          stats.messages++
          if (message.type === 'question' && !questionIds.includes(message.question.id)) questionIds.push(message.question.id)
          const key = message.type === 'votes' ? `${message.id}:${message.votes}` : null
          if (key && sentAt.has(key)) stats.fanout.push(performance.now() - sentAt.get(key))
        }).catch((err) => {
          fail('connect', err.message)
          return () => {}
        })
        clients.push({ token: joined.token, close })
      })(),
    )
    await sleep(rampMs)
  }
  await Promise.all(joins)
  const presence = await api('presence', 'GET', `/api/askaway/events/${code}/presence`)
  console.log(`  ${clients.length} joined, presence reports ${presence?.count}`)

  // 2. Questions trickle in, votes come in bursts.
  const endAt = Date.now() + SECONDS * 1000
  const askEvery = (SECONDS * 1000) / QUESTIONS
  const askers = (async () => {
    for (let i = 0; i < QUESTIONS && Date.now() < endAt; i++) {
      const client = clients[i % clients.length]
      await api('ask', 'POST', `/api/askaway/events/${code}/questions`, { content: `Load test question #${i + 1}` }, { 'x-askaway-participant': client.token })
      await sleep(askEvery)
    }
  })()
  const voters = clients.map(async (client) => {
    for (let v = 0; v < VOTES_PER_CLIENT && Date.now() < endAt; v++) {
      await sleep(Math.random() * (SECONDS * 1000) / VOTES_PER_CLIENT)
      if (!questionIds.length) continue
      const id = questionIds[Math.floor(Math.random() * questionIds.length)]
      const result = await api('vote', 'POST', `/api/askaway/events/${code}/questions/${id}/vote`, {}, { 'x-askaway-participant': client.token })
      if (result) sentAt.set(`${id}:${result.votes}`, performance.now())
    }
  })
  await Promise.all([askers, ...voters])
  await sleep(2000)

  // 3. Clean up.
  clients.forEach(c => c.close())
  await api('delete-event', 'DELETE', `/api/askaway/events/${code}/admin`, null, { 'x-askaway-key': ownerKey })

  console.log('\nAPI latency (ms)        count     p50     p95     p99     max')
  for (const [name, values] of Object.entries(stats.api)) {
    const row = [values.length, percentile(values, 50), percentile(values, 95), percentile(values, 99), Math.max(...values)]
    console.log(`  ${name.padEnd(20)} ${row.map(v => String(Math.round(v)).padStart(7)).join(' ')}`)
  }
  console.log(`\nRealtime messages received: ${stats.messages}`)
  console.log(`Vote fan-out delay (ms): p50 ${Math.round(percentile(stats.fanout, 50))}, p95 ${Math.round(percentile(stats.fanout, 95))}, p99 ${Math.round(percentile(stats.fanout, 99))}`)
  const errors = Object.entries(stats.errors)
  console.log(errors.length ? '\nErrors:\n' + errors.map(([k, n]) => `  ${n}× ${k}`).join('\n') : '\nNo errors 🎉')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
