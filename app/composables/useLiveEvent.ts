import type { Me, PublicEvent, Question, RealtimeMessage } from '~/utils/types'

type Status = 'loading' | 'ready' | 'not_found' | 'error'

// Loads an event's public state and keeps it live via realtime.
// With `participate`, the browser also joins as a participant (anonymous
// animal identity, own votes and questions) and counts towards presence.
export function useLiveEvent(code: string, options: { participate?: boolean } = {}) {
  const api = useApi()
  const showError = useErrorToast()
  const { locale } = useI18n()
  const realtime = useRealtime()
  const tokenStore = participantToken(code)

  const event = ref<PublicEvent | null>(null)
  const questions = ref<Question[]>([])
  const me = ref<Me | null>(null)
  const token = ref<string | null>(null)
  const status = ref<Status>('loading')

  async function load() {
    token.value = options.participate ? tokenStore.get() : null
    try {
      const result = await api.get<{ event: PublicEvent, questions: Question[], me?: Me }>(`/events/${code}`, {
        participant: token.value,
        query: { lang: locale.value },
      })
      event.value = result.event
      questions.value = result.questions
      if (options.participate) {
        if (result.me) {
          me.value = result.me
        } else {
          const joined = await api.post<{ token: string, me: Me }>(`/events/${code}/participants`)
          tokenStore.set(joined.token)
          token.value = joined.token
          me.value = joined.me
        }
      }
      status.value = 'ready'
    } catch (err) {
      if (err instanceof ApiError && err.code === 'event_not_found') {
        status.value = 'not_found'
      } else {
        if (status.value === 'loading') status.value = 'error'
        showError(err)
      }
    }
  }

  function handle(message: RealtimeMessage) {
    switch (message.type) {
      case 'question': {
        questions.value = upsert(questions.value, message.question)
        if (me.value) {
          const own = me.value.questions.find(q => q.id === message.question.id)
          if (own) {
            me.value.questions = me.value.questions.filter(q => q.id !== own.id)
            me.value.ownApproved = [...me.value.ownApproved, own.id]
          }
        }
        break
      }
      case 'question_removed':
        questions.value = remove(questions.value, message.id)
        break
      case 'votes':
        questions.value = setVotes(questions.value, message.id, message.votes)
        break
      case 'event': {
        const wasClosed = event.value?.closed
        event.value = { ...event.value, ...message.event } as PublicEvent
        // Reload once an event closes to fetch the translated newsletter consent text.
        if (!wasClosed && message.event.closed) load()
        break
      }
      case 'deleted':
        status.value = 'not_found'
        realtime.stop()
        break
    }
  }

  onMounted(async () => {
    await load()
    if (status.value !== 'ready') return
    try {
      await realtime.subscribe(`askaway/${code}`, handle)
      if (options.participate) await realtime.subscribe(`askaway/${code}/here`, () => {})
      await realtime.onReconnect(load)
    } catch (err) {
      showError(err)
    }
  })

  // Reload when the language changes so the consent text matches.
  watch(locale, () => {
    if (status.value === 'ready' && event.value?.newsletter) load()
  })

  return { event, questions, me, token, status, load }
}
