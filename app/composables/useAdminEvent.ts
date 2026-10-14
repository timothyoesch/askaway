import type { AdminEvent, Question, RealtimeMessage, Role } from '~/utils/types'

type Status = 'loading' | 'ready' | 'no_access' | 'not_found' | 'error'

// State and actions for the moderation page. Access comes from an owner or
// moderator key (from the link's #key=… or this browser's saved events) or
// from being logged in as the event's owner.
export function useAdminEvent(code: string, hooks: { onNewPending?: (question: Question) => void } = {}) {
  const api = useApi()
  const showError = useErrorToast()
  const saved = useSavedEvents()
  const realtime = useRealtime()

  const event = ref<AdminEvent | null>(null)
  const questions = ref<Question[]>([])
  const role = ref<Role | null>(null)
  const presence = ref(0)
  const status = ref<Status>('loading')
  const key = ref<string | null>(null)

  function readKey() {
    const fromHash = new URLSearchParams(window.location.hash.slice(1)).get('key')
    if (fromHash) {
      // Keep the secret out of the address bar (screen sharing, history).
      history.replaceState(history.state, '', window.location.pathname + window.location.search)
      return fromHash
    }
    const entry = saved.find(code)
    return entry?.ownerKey || entry?.modKey || null
  }

  async function load() {
    try {
      const result = await api.get<{ role: Role, event: AdminEvent, questions: Question[], presence: number }>(
        `/events/${code}/admin`,
        { key: key.value },
      )
      role.value = result.role
      event.value = result.event
      questions.value = result.questions
      presence.value = result.presence
      status.value = 'ready'
      saved.save({
        code,
        title: result.event.title,
        ...(key.value && result.role === 'owner' ? { ownerKey: key.value } : {}),
        ...(key.value && result.role === 'mod' ? { modKey: key.value } : {}),
      })
    } catch (err) {
      if (err instanceof ApiError && (err.code === 'no_access' || err.code === 'event_not_found')) {
        status.value = err.code === 'no_access' ? 'no_access' : 'not_found'
      } else {
        if (status.value === 'loading') status.value = 'error'
        showError(err)
      }
    }
  }

  function handle(message: RealtimeMessage) {
    switch (message.type) {
      case 'question': {
        const isNew = !questions.value.some(q => q.id === message.question.id)
        questions.value = upsert(questions.value, message.question)
        if (isNew && message.question.status === 'pending') hooks.onNewPending?.(message.question)
        break
      }
      case 'question_removed':
        questions.value = remove(questions.value, message.id)
        break
      case 'votes':
        questions.value = setVotes(questions.value, message.id, message.votes)
        break
      case 'event':
        event.value = { ...event.value, ...message.event } as AdminEvent
        break
      case 'deleted':
        status.value = 'not_found'
        realtime.stop()
        break
      case 'access_revoked':
        status.value = 'no_access'
        realtime.stop()
        break
    }
  }

  let presenceTimer: ReturnType<typeof setInterval> | undefined
  async function refreshPresence() {
    try {
      presence.value = (await api.get<{ count: number }>(`/events/${code}/presence`)).count
    } catch {
      // Ignore; next tick will retry.
    }
  }

  onMounted(async () => {
    key.value = readKey()
    await load()
    if (status.value !== 'ready') return
    try {
      await realtime.subscribe(`askaway/${code}/mod`, handle, key.value ? { x_askaway_key: key.value } : undefined)
      await realtime.onReconnect(load)
    } catch (err) {
      showError(err)
    }
    presenceTimer = setInterval(refreshPresence, 5000)
  })
  onBeforeUnmount(() => clearInterval(presenceTimer))

  // --- actions ----------------------------------------------------------------------

  async function questionAction(question: Question, action: string) {
    try {
      const result = await api.post<{ question?: Question, event?: AdminEvent, deleted?: string }>(
        `/events/${code}/admin/questions/${question.id}`,
        { action },
        { key: key.value },
      )
      if (result.deleted) questions.value = remove(questions.value, result.deleted)
      if (result.question) questions.value = upsert(questions.value, result.question)
      if (result.event) event.value = result.event
    } catch (err) {
      showError(err)
    }
  }

  async function updateEvent(changes: Record<string, unknown>) {
    try {
      const result = await api.patch<{ event: AdminEvent }>(`/events/${code}/admin/event`, changes, { key: key.value })
      event.value = result.event
      return true
    } catch (err) {
      showError(err)
      return false
    }
  }

  async function post<T>(path: string) {
    try {
      return await api.post<T>(`/events/${code}/admin${path}`, {}, { key: key.value })
    } catch (err) {
      showError(err)
      return null
    }
  }

  return {
    event, questions, role, presence, status, key,
    load, questionAction, updateEvent, post,
  }
}
