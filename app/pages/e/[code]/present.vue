<script setup lang="ts">
import { ArrowsPointingOutIcon, QrCodeIcon, ChatBubbleLeftRightIcon, UserGroupIcon, MicrophoneIcon } from '@heroicons/vue/24/outline'
import type { Screen } from '~/utils/types'

definePageMeta({ layout: 'bare' })

const route = useRoute()
const code = String(route.params.code).toUpperCase()
const { t } = useI18n()
const api = useApi()
const showError = useErrorToast()
const displayName = useDisplayName()
const saved = useSavedEvents()

const { event, questions, status } = useLiveEvent(code)
useHead({ title: () => event.value?.title || code })

// --- join URL -------------------------------------------------------------------
const origin = ref('')
onMounted(() => (origin.value = window.location.origin))
const joinUrl = computed(() => `${origin.value}/e/${code}`)
const prettyUrl = computed(() => joinUrl.value.replace(/^https?:\/\//, ''))

// --- presence (polled; cheap and self-correcting) --------------------------------
const presence = ref<number | null>(null)
let presenceTimer: ReturnType<typeof setInterval> | undefined
async function loadPresence() {
  try {
    presence.value = (await api.get<{ count: number }>(`/events/${code}/presence`)).count
  } catch {
    // Not critical; try again on the next tick.
  }
}
onMounted(() => {
  loadPresence()
  presenceTimer = setInterval(loadPresence, 5000)
})
onBeforeUnmount(() => clearInterval(presenceTimer))

// --- questions ---------------------------------------------------------------------
const MAX_VISIBLE = 6
const spotlight = computed(() => questions.value.find(q => q.id === event.value?.spotlight) || null)
const visible = computed(() =>
  sortQuestions(questions.value.filter(q => !q.answeredAt && q.id !== spotlight.value?.id)).slice(0, spotlight.value ? 3 : MAX_VISIBLE),
)
const hiddenCount = computed(() =>
  Math.max(0, questions.value.filter(q => !q.answeredAt).length - visible.value.length - (spotlight.value ? 1 : 0)),
)

// --- controls (keyboard + auto-hiding toolbar) -----------------------------------
const key = computed(() => {
  const entry = saved.find(code)
  return entry?.ownerKey || entry?.modKey || null
})
const controlsVisible = ref(true)
let hideTimer: ReturnType<typeof setTimeout> | undefined
function wake() {
  controlsVisible.value = true
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => (controlsVisible.value = false), 2500)
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen()
  else document.documentElement.requestFullscreen().catch(() => {})
}

async function setScreen(screen: Screen) {
  if (!key.value || !event.value || event.value.screen === screen) return
  try {
    await api.patch(`/events/${code}/admin/event`, { screen }, { key: key.value })
  } catch (err) {
    showError(err)
  }
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
  const k = e.key.toLowerCase()
  if (k === 'f') toggleFullscreen()
  if (k === 'r') setScreen('registration')
  if (k === 'q') setScreen('questions')
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('mousemove', wake)
  wake()
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('mousemove', wake)
  clearTimeout(hideTimer)
})
</script>

<template>
  <div class="relative h-dvh overflow-hidden bg-pink text-text" :class="{ 'cursor-none': !controlsVisible }">
    <div v-if="status === 'loading'" class="grid h-full place-items-center">
      <div class="animate-float text-[8vw]" aria-hidden="true">🐣</div>
    </div>

    <EmptyState v-else-if="status !== 'ready' || !event" emoji="🔍" :title="t('errors.event_not_found_title')" :text="t('errors.event_not_found')" class="h-full justify-center" />

    <!-- Closed -->
    <div v-else-if="event.closed" class="grid h-full place-items-center p-[4vw] text-center">
      <div>
        <div class="animate-float text-[9vw]" aria-hidden="true">🎉</div>
        <h1 class="text-[7vw] leading-none font-bold text-ink">{{ t('present.wrapTitle') }}</h1>
        <p class="mt-[2vh] text-[2.4vw] text-ink-deep">{{ t('present.wrapText', { count: questions.length }) }}</p>
      </div>
    </div>

    <!-- Registration: big QR + URL + code -->
    <div v-else-if="event.screen === 'registration'" class="flex h-full items-center gap-[5vw] p-[5vw]">
      <div class="min-w-0 flex-1">
        <h1 class="text-[clamp(2.5rem,6vw,9rem)] leading-[0.95] font-bold break-words text-ink">{{ event.title }}</h1>
        <p class="mt-[4vh] text-[clamp(1.25rem,2.4vw,3.5rem)] font-bold text-ink-deep">{{ t('present.scanToAsk') }}</p>
        <p class="mt-[1vh] font-mono text-[clamp(1.25rem,2.8vw,4rem)] font-bold break-all text-ink">{{ prettyUrl }}</p>
        <p class="mt-[3vh] text-[clamp(1rem,1.6vw,2.5rem)] text-ink-deep">
          {{ t('present.orCode') }}
          <span class="ml-2 rounded-2xl bg-white px-[1vw] py-[0.3vw] font-mono font-bold tracking-[0.2em] text-ink">{{ code }}</span>
        </p>
        <p v-if="presence !== null" class="mt-[5vh] inline-flex items-center gap-3 rounded-full bg-white/70 px-[1.4vw] py-[0.6vw] text-[clamp(1rem,1.6vw,2.5rem)] font-bold text-ink-deep">
          <UserGroupIcon class="size-[1.2em]" aria-hidden="true" />
          {{ t('present.here', { count: presence }, presence) }}
        </p>
      </div>
      <div class="card aspect-square h-[min(70vh,40vw)] shrink-0 p-[1.5vw]">
        <QrCode v-if="origin" :value="joinUrl" class="h-full w-full" />
      </div>
    </div>

    <!-- Questions -->
    <div v-else class="flex h-full flex-col bg-pink-wash">
      <header class="flex items-center justify-between gap-6 bg-pink px-[3vw] py-[1.6vh]">
        <h1 class="min-w-0 truncate text-[clamp(1.5rem,2.8vw,4rem)] font-bold text-ink">{{ event.title }}</h1>
        <div class="flex shrink-0 items-center gap-[1.5vw]">
          <p v-if="presence !== null" class="inline-flex items-center gap-2 text-[clamp(0.9rem,1.3vw,2rem)] font-bold text-ink-deep">
            <UserGroupIcon class="size-[1.2em]" aria-hidden="true" />{{ presence }}
          </p>
          <p class="text-right font-mono text-[clamp(0.9rem,1.3vw,2rem)] font-bold text-ink-deep">{{ prettyUrl }}</p>
          <div class="size-[clamp(3rem,6vw,9rem)] rounded-xl bg-white p-1">
            <QrCode v-if="origin" :value="joinUrl" />
          </div>
        </div>
      </header>

      <main class="relative flex min-h-0 flex-1 flex-col gap-[2vh] px-[3vw] py-[3vh]">
        <Transition name="fade">
          <section v-if="spotlight" :key="spotlight.id" class="rounded-[2vw] bg-ink p-[2.5vw] text-pink shadow-(--shadow-lift)">
            <p class="flex items-center gap-3 text-[clamp(1rem,1.6vw,2.5rem)] font-bold uppercase tracking-wider">
              <MicrophoneIcon class="size-[1.2em]" aria-hidden="true" />{{ t('ask.nowAnswering') }}
            </p>
            <p class="mt-[1.5vh] text-[clamp(1.75rem,3.4vw,5.5rem)] leading-tight font-bold break-words text-white">{{ spotlight.content }}</p>
            <p class="mt-[1.5vh] text-[clamp(1rem,1.6vw,2.5rem)]">
              {{ animalEmoji(spotlight.animal) }} {{ displayName(spotlight) }} · 👍 {{ spotlight.votes }}
            </p>
          </section>
        </Transition>

        <EmptyState v-if="!visible.length && !spotlight" emoji="💭" :title="t('present.emptyTitle')" :text="t('present.emptyText')" class="flex-1 justify-center [&_p]:text-[clamp(1rem,2vw,3rem)]" />

        <TransitionGroup name="list" tag="ol" class="relative flex min-h-0 flex-col gap-[1.6vh]">
          <li
            v-for="q in visible"
            :key="q.id"
            class="card flex items-center gap-[2vw] px-[2vw] py-[1.8vh]"
            :class="{ 'ring-4 ring-pink': q.pinned }"
          >
            <span class="text-[clamp(1.5rem,2.6vw,4rem)]" aria-hidden="true">{{ animalEmoji(q.animal) }}</span>
            <div class="min-w-0 flex-1">
              <p class="line-clamp-3 leading-snug font-semibold break-words" :class="spotlight ? 'text-[clamp(1rem,1.8vw,3rem)]' : 'text-[clamp(1.1rem,2.2vw,3.5rem)]'">{{ q.content }}</p>
              <p class="mt-1 text-[clamp(0.8rem,1.1vw,1.8rem)] text-muted">{{ displayName(q) }}</p>
            </div>
            <div class="flex shrink-0 flex-col items-center rounded-2xl bg-ink-soft px-[1.2vw] py-[0.8vh] text-ink-deep">
              <span class="text-[clamp(1.25rem,2.4vw,4rem)] leading-none font-extrabold tabular-nums">{{ q.votes }}</span>
              <span class="text-[clamp(0.7rem,0.9vw,1.4rem)] font-bold uppercase">👍</span>
            </div>
          </li>
        </TransitionGroup>

        <p v-if="hiddenCount" class="mt-auto text-center text-[clamp(0.9rem,1.3vw,2rem)] font-bold text-muted">
          {{ t('present.more', { count: hiddenCount }, hiddenCount) }}
        </p>
      </main>
    </div>

    <!-- Auto-hiding controls -->
    <Transition name="fade">
      <div v-if="controlsVisible && status === 'ready'" class="absolute right-4 bottom-4 flex items-center gap-2 rounded-full bg-white/90 p-1.5 shadow-(--shadow-lift)">
        <template v-if="key && event && !event.closed">
          <AppButton size="sm" :variant="event.screen === 'registration' ? 'primary' : 'ghost'" :title="t('present.keyR')" @click="setScreen('registration')">
            <QrCodeIcon />{{ t('screen.registration') }}
          </AppButton>
          <AppButton size="sm" :variant="event.screen === 'questions' ? 'primary' : 'ghost'" :title="t('present.keyQ')" @click="setScreen('questions')">
            <ChatBubbleLeftRightIcon />{{ t('screen.questions') }}
          </AppButton>
        </template>
        <AppButton size="sm" variant="ghost" :title="t('present.keyF')" :aria-label="t('present.fullscreen')" @click="toggleFullscreen">
          <ArrowsPointingOutIcon />
        </AppButton>
        <LangSwitch />
      </div>
    </Transition>
  </div>
</template>
