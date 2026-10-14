// Small, failure-tolerant wrappers around localStorage (private mode or
// blocked storage must never break the app).

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage unavailable: the app keeps working for this visit only.
  }
}

export interface SavedEvent {
  code: string
  title: string
  ownerKey?: string
  modKey?: string
  savedAt: string
}

const EVENTS_KEY = 'askaway:events'

// Events this browser created or moderates ("My events" without an account).
export function useSavedEvents() {
  const events = useState<SavedEvent[]>('saved-events', () => [])

  function load() {
    events.value = read<SavedEvent[]>(EVENTS_KEY, [])
  }

  function find(code: string) {
    load()
    return events.value.find(e => e.code === code)
  }

  function save(entry: Partial<SavedEvent> & { code: string }) {
    load()
    const existing = events.value.find(e => e.code === entry.code)
    const merged: SavedEvent = {
      title: '',
      savedAt: new Date().toISOString(),
      ...existing,
      ...Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== undefined)),
    } as SavedEvent
    events.value = [merged, ...events.value.filter(e => e.code !== entry.code)]
    write(EVENTS_KEY, events.value)
  }

  function forget(code: string) {
    load()
    events.value = events.value.filter(e => e.code !== code)
    write(EVENTS_KEY, events.value)
  }

  return { events, load, find, save, forget }
}

export function participantToken(code: string) {
  return {
    get: () => read<string | null>(`askaway:participant:${code}`, null),
    set: (token: string | null) => write(`askaway:participant:${code}`, token),
  }
}
