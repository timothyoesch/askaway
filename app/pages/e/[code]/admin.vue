<script setup lang="ts">
import {
  CheckIcon, XMarkIcon, StarIcon, MicrophoneIcon, CheckCircleIcon, ArrowUturnLeftIcon, TrashIcon,
  PresentationChartBarIcon, DevicePhoneMobileIcon, UserGroupIcon,
} from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'
import type { Question, Screen } from '~/utils/types'
import type { AdminTourId } from '~/composables/useAdminTours'

type Tab = 'queue' | 'live' | 'answered' | 'declined' | 'share' | 'settings'

const route = useRoute()
const code = String(route.params.code).toUpperCase()
const { t } = useI18n()

const tab = ref<Tab>('live')
const { event, questions, role, presence, status, key, questionAction, updateEvent, post } = useAdminEvent(code, {
  onNewPending: () => {
    if (tab.value !== 'queue') toast(t('admin.newPending'), { id: 'new-pending', action: { label: t('admin.tabs.queue'), onClick: () => (tab.value = 'queue') } })
  },
})
useHead({ title: () => (event.value ? `${t('admin.metaTitle')} · ${event.value.title}` : t('admin.metaTitle')) })

const welcome = ref(route.query.welcome === '1')


const pending = computed(() => questions.value.filter(q => q.status === 'pending').sort((a, b) => a.created.localeCompare(b.created)))
const live = computed(() => sortQuestions(questions.value.filter(q => q.status === 'approved' && !q.answeredAt)))
const answered = computed(() => sortQuestions(questions.value.filter(q => q.status === 'approved' && q.answeredAt), 'newest'))
const declined = computed(() => questions.value.filter(q => q.status === 'rejected'))
const spotlight = computed(() => questions.value.find(q => q.id === event.value?.spotlight) || null)

// Start on the queue when moderation is on and something is waiting.
watch(status, (value) => {
  if (value === 'ready' && event.value?.moderation && pending.value.length) tab.value = 'queue'
}, { once: true })

const tabs = computed(() => {
  const list: Array<{ id: Tab, label: string, count?: number }> = [
    { id: 'queue', label: t('admin.tabs.queue'), count: pending.value.length },
    { id: 'live', label: t('admin.tabs.live'), count: live.value.length },
    { id: 'answered', label: t('admin.tabs.answered'), count: answered.value.length },
    { id: 'declined', label: t('admin.tabs.declined'), count: declined.value.length },
    { id: 'share', label: t('admin.tabs.share') },
  ]
  if (role.value === 'owner') list.push({ id: 'settings', label: t('admin.tabs.settings') })
  return list
})

const screen = computed({
  get: () => event.value?.screen || 'registration',
  set: (value: Screen) => updateEvent({ screen: value }),
})

function confirmDelete(q: Question) {
  if (confirm(t('admin.deleteConfirm'))) questionAction(q, 'delete')
}

// --- guided tours ------------------------------------------------------------------------
// "basics" runs on the first visit; each area's tour runs the first time that
// tab is opened (after the basics). All of them can be replayed from the help menu.
const tour = useTour()
const adminTours = useAdminTours()
const areaTours: Partial<Record<Tab, AdminTourId>> = { queue: 'queue', live: 'live', share: 'share', settings: 'settings' }
const tourItems = computed(() => (role.value ? adminTours.menuItems(role.value) : []))

function tourSteps(id: AdminTourId) {
  return adminTours.steps(id, {
    role: role.value!,
    event: event.value!,
    hasPending: pending.value.length > 0,
    hasLive: live.value.length > 0,
  })
}

// Wait for the tab content (and its list transition) before measuring elements.
async function afterRender() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 350))
}

// A sample question shown in an empty list while that list's tour runs, so the
// tour can point at real-looking buttons instead of floating in the middle.
const tourDemo = ref<'queue' | 'live' | null>(null)
const demoQuestion = computed<Question>(() => ({
  id: 'tour-demo',
  content: t('tour.demoQuestion'),
  animal: 'otter',
  name: '',
  votes: 3,
  pinned: false,
  answeredAt: null,
  created: new Date().toISOString(),
  status: 'pending',
}))

async function runTour(id: AdminTourId, auto: boolean) {
  if (auto && (!tour.autoEnabled.value || tour.hasSeen(id))) return
  const needsDemo = (id === 'queue' && !pending.value.length) || (id === 'live' && !live.value.length)
  tourDemo.value = needsDemo ? id as 'queue' | 'live' : null
  await afterRender()
  const options = { onClose: () => (tourDemo.value = null) }
  const started = auto ? tour.autoStart(id, tourSteps(id), options) : (tour.start(id, tourSteps(id), options), true)
  if (!started) tourDemo.value = null
}

async function startTour(id: string) {
  const tourId = id as AdminTourId
  const target = (Object.keys(areaTours) as Tab[]).find(key => areaTours[key] === tourId)
  if (target) tab.value = target
  await runTour(tourId, false)
}

function toggleAutoTours() {
  const enable = !tour.autoEnabled.value
  tour.setAuto(enable)
  toast.success(enable ? t('tour.enabledInfo') : t('tour.disabledInfo'))
}

watch(status, (value) => {
  if (value === 'ready') runTour('basics', true)
})

watch(tab, (value) => {
  const id = areaTours[value]
  if (id && tour.hasSeen('basics')) runTour(id, true)
})
</script>

<template>
  <div class="pb-16">
    <div v-if="status === 'loading'" class="py-24 text-center text-muted">
      <div class="animate-float text-5xl" aria-hidden="true">🐣</div>
      <p class="mt-3">{{ t('common.loading') }}</p>
    </div>

    <EmptyState v-else-if="status === 'no_access'" emoji="🚪" :title="t('errors.no_access_title')" :text="t('errors.no_access')" class="py-24">
      <AppButton to="/login" variant="soft">{{ t('nav.login') }}</AppButton>
    </EmptyState>

    <EmptyState v-else-if="status === 'not_found'" emoji="🔍" :title="t('errors.event_not_found_title')" :text="t('errors.event_not_found')" class="py-24">
      <AppButton to="/" variant="soft">{{ t('common.toStart') }}</AppButton>
    </EmptyState>

    <EmptyState v-else-if="status === 'error' || !event || !role" emoji="🥺" :title="t('errors.server_error_title')" :text="t('errors.server_error')" class="py-24" />

    <div v-else class="mx-auto max-w-5xl px-4 pt-6 sm:px-6">
      <!-- Welcome after creating -->
      <section v-if="welcome" class="card mb-6 bg-ink p-5 text-pink sm:p-6">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="font-display text-3xl font-bold text-white">{{ t('admin.welcomeTitle') }}</p>
            <p class="mt-1">{{ event.hasOwner ? t('admin.welcomeTextAccount') : t('admin.welcomeText') }}</p>
          </div>
          <button type="button" class="rounded-full p-1 hover:bg-white/10" :aria-label="t('common.close')" @click="welcome = false">
            <XMarkIcon class="size-6" />
          </button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <AppButton variant="pink" size="sm" @click="tab = 'share'; welcome = false">{{ t('admin.welcomeShare') }}</AppButton>
          <AppButton variant="pink" size="sm" :href="`/e/${code}/present`"><PresentationChartBarIcon />{{ t('admin.openPresenter') }}</AppButton>
        </div>
      </section>

      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <span class="rounded-full bg-ink-soft px-2.5 py-0.5 font-bold text-ink-deep">{{ role === 'owner' ? t('admin.roleOwner') : t('admin.roleMod') }}</span>
            <span class="rounded-full bg-white px-2.5 py-0.5 font-mono font-bold tracking-widest text-ink">{{ code }}</span>
            <span class="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 font-bold text-ink-deep">
              <UserGroupIcon class="size-4" aria-hidden="true" />{{ t('admin.presence', { count: presence }, presence) }}
            </span>
            <span v-if="event.closed" class="rounded-full bg-berry-soft px-2.5 py-0.5 font-bold text-berry">{{ t('admin.closed') }}</span>
          </div>
          <h1 class="mt-2 text-4xl font-bold break-words text-ink sm:text-5xl">{{ event.title }}</h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <AppButton variant="soft" size="sm" :href="`/e/${code}/present`" data-tour="presenter"><PresentationChartBarIcon />{{ t('admin.openPresenter') }}</AppButton>
          <AppButton variant="ghost" size="sm" :href="`/e/${code}`"><DevicePhoneMobileIcon />{{ t('admin.openParticipant') }}</AppButton>
          <TourMenu :items="tourItems" :auto-enabled="tour.autoEnabled.value" @start="startTour" @toggle-auto="toggleAutoTours" />
        </div>
      </div>

      <!-- Screen mode + spotlight -->
      <section class="card mt-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5" data-tour="screen">
        <div>
          <p class="font-bold">{{ t('admin.screenLabel') }}</p>
          <p class="hint">{{ t('admin.screenHelp') }}</p>
        </div>
        <SegmentedControl
          v-model="screen"
          :label="t('admin.screenLabel')"
          :options="[{ value: 'registration', label: `📱 ${t('screen.registration')}` }, { value: 'questions', label: `💬 ${t('screen.questions')}` }]"
        />
      </section>

      <section v-if="spotlight" class="card mt-4 border-2 border-ink p-4 sm:p-5" data-tour="spotlight-box">
        <p class="flex items-center gap-2 text-sm font-bold text-ink uppercase"><MicrophoneIcon class="size-5" />{{ t('ask.nowAnswering') }}</p>
        <p class="mt-2 text-lg">{{ spotlight.content }}</p>
        <div class="mt-3 flex flex-wrap gap-2">
          <AppButton size="sm" variant="success" @click="questionAction(spotlight, 'answer')"><CheckCircleIcon />{{ t('admin.doneAnswering') }}</AppButton>
          <AppButton size="sm" variant="ghost" @click="questionAction(spotlight, 'unspotlight')">{{ t('admin.removeSpotlight') }}</AppButton>
        </div>
      </section>

      <!-- Tabs -->
      <nav class="-mx-4 mt-8 flex gap-1 overflow-x-auto px-4 pb-2" :aria-label="t('admin.tabsLabel')" data-tour="tabs">
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          class="inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-bold transition-colors"
          :class="tab === item.id ? 'bg-ink text-pink' : 'text-ink-deep hover:bg-ink-soft/60'"
          :aria-current="tab === item.id ? 'page' : undefined"
          :data-tour="`tab-${item.id}`"
          @click="tab = item.id"
        >
          {{ item.label }}
          <span
            v-if="item.count !== undefined"
            class="rounded-full px-2 text-sm tabular-nums"
            :class="[tab === item.id ? 'bg-pink text-ink-deep' : 'bg-ink-soft', item.id === 'queue' && item.count ? '!bg-honey !text-white' : '']"
          >{{ item.count }}</span>
        </button>
      </nav>

      <div class="mt-4">
        <!-- Queue -->
        <div v-if="tab === 'queue'" class="space-y-3">
          <p v-if="!event.moderation" class="rounded-xl bg-pink-wash px-4 py-3 text-sm text-ink-deep">{{ t('admin.moderationOffHint') }}</p>
          <EmptyState v-if="!pending.length && tourDemo !== 'queue'" emoji="🧘" :title="t('admin.queueEmptyTitle')" :text="t('admin.queueEmptyText')" />
          <QuestionCard v-if="tourDemo === 'queue' && !pending.length" :question="demoQuestion" :show-votes="false" demo data-tour="first-pending">
            <template #actions>
              <AppButton size="sm" variant="success" tabindex="-1"><CheckIcon />{{ t('admin.approve') }}</AppButton>
              <AppButton size="sm" variant="danger" tabindex="-1"><XMarkIcon />{{ t('admin.reject') }}</AppButton>
            </template>
          </QuestionCard>
          <TransitionGroup name="list" tag="div" class="relative space-y-3">
            <QuestionCard v-for="(q, i) in pending" :key="q.id" :question="q" :show-votes="false" :data-tour="i === 0 ? 'first-pending' : undefined">
              <template #actions>
                <AppButton size="sm" variant="success" @click="questionAction(q, 'approve')"><CheckIcon />{{ t('admin.approve') }}</AppButton>
                <AppButton size="sm" variant="danger" @click="questionAction(q, 'reject')"><XMarkIcon />{{ t('admin.reject') }}</AppButton>
              </template>
            </QuestionCard>
          </TransitionGroup>
        </div>

        <!-- Live -->
        <div v-else-if="tab === 'live'">
          <EmptyState v-if="!live.length && tourDemo !== 'live'" emoji="🦗" :title="t('admin.liveEmptyTitle')" :text="t('admin.liveEmptyText')" />
          <QuestionCard v-if="tourDemo === 'live' && !live.length" :question="demoQuestion" demo data-tour="first-live">
            <template #actions>
              <AppButton size="sm" variant="primary" tabindex="-1"><MicrophoneIcon />{{ t('admin.spotlight') }}</AppButton>
              <AppButton size="sm" variant="success" tabindex="-1"><CheckCircleIcon />{{ t('admin.markAnswered') }}</AppButton>
              <AppButton size="sm" variant="soft" tabindex="-1"><StarIcon />{{ t('admin.pin') }}</AppButton>
              <AppButton size="sm" variant="ghost" tabindex="-1"><XMarkIcon />{{ t('admin.hide') }}</AppButton>
            </template>
          </QuestionCard>
          <TransitionGroup name="list" tag="div" class="relative space-y-3">
            <QuestionCard v-for="(q, i) in live" :key="q.id" :question="q" :spotlight="q.id === event.spotlight" :data-tour="i === 0 ? 'first-live' : undefined">
              <template #actions>
                <AppButton v-if="q.id !== event.spotlight" size="sm" variant="primary" @click="questionAction(q, 'spotlight')"><MicrophoneIcon />{{ t('admin.spotlight') }}</AppButton>
                <AppButton size="sm" variant="success" @click="questionAction(q, 'answer')"><CheckCircleIcon />{{ t('admin.markAnswered') }}</AppButton>
                <AppButton size="sm" variant="soft" @click="questionAction(q, q.pinned ? 'unpin' : 'pin')"><StarIcon />{{ q.pinned ? t('admin.unpin') : t('admin.pin') }}</AppButton>
                <AppButton size="sm" variant="ghost" @click="questionAction(q, 'reject')"><XMarkIcon />{{ t('admin.hide') }}</AppButton>
              </template>
            </QuestionCard>
          </TransitionGroup>
        </div>

        <!-- Answered -->
        <div v-else-if="tab === 'answered'" class="space-y-3">
          <EmptyState v-if="!answered.length" emoji="🌱" :title="t('admin.answeredEmptyTitle')" />
          <QuestionCard v-for="q in answered" :key="q.id" :question="q">
            <template #actions>
              <AppButton size="sm" variant="soft" @click="questionAction(q, 'unanswer')"><ArrowUturnLeftIcon />{{ t('admin.unanswer') }}</AppButton>
            </template>
          </QuestionCard>
        </div>

        <!-- Declined -->
        <div v-else-if="tab === 'declined'" class="space-y-3">
          <EmptyState v-if="!declined.length" emoji="✨" :title="t('admin.declinedEmptyTitle')" />
          <QuestionCard v-for="q in declined" :key="q.id" :question="q" :show-votes="false">
            <template #actions>
              <AppButton size="sm" variant="soft" @click="questionAction(q, 'approve')"><CheckIcon />{{ t('admin.approve') }}</AppButton>
              <AppButton size="sm" variant="ghost" @click="questionAction(q, 'restore')"><ArrowUturnLeftIcon />{{ t('admin.restore') }}</AppButton>
              <AppButton size="sm" variant="danger" @click="confirmDelete(q)"><TrashIcon />{{ t('common.delete') }}</AppButton>
            </template>
          </QuestionCard>
        </div>

        <AdminShare v-else-if="tab === 'share'" :code="code" :role="role" :event="event" :access-key="key" :post="post" @claimed="event = $event" />

        <AdminSettings
          v-else-if="tab === 'settings' && role === 'owner'"
          :code="code"
          :event="event"
          :questions="questions"
          :update-event="updateEvent"
          :post="post"
          :access-key="key"
          @event="event = $event"
        />
      </div>
    </div>
  </div>
</template>
