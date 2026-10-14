<script setup lang="ts">
import { PaperAirplaneIcon, PencilSquareIcon, TrashIcon, ClockIcon, MicrophoneIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'
import type { Question } from '~/utils/types'
import type { SortMode } from '~/utils/questions'

const route = useRoute()
const code = String(route.params.code).toUpperCase()
const { t, d } = useI18n()
const api = useApi()
const showError = useErrorToast()
const displayName = useDisplayName()
const { config, load: loadConfig } = useInstanceConfig()

const { event, questions, me, token, status } = useLiveEvent(code, { participate: true })

useHead({ title: () => event.value?.title || code })
onMounted(loadConfig)

// --- asking ---------------------------------------------------------------------
const draft = ref('')
const sending = ref(false)
const cooldownUntil = ref(0)
const nowTick = ref(Date.now())
let ticker: ReturnType<typeof setInterval> | undefined
onMounted(() => (ticker = setInterval(() => (nowTick.value = Date.now()), 500)))
onBeforeUnmount(() => clearInterval(ticker))

const maxLength = computed(() => config.value?.questionMaxLength || 300)
const cooldownLeft = computed(() => Math.max(0, Math.ceil((cooldownUntil.value - nowTick.value) / 1000)))

function startCooldown(seconds: number) {
  cooldownUntil.value = Date.now() + seconds * 1000
}

async function ask() {
  if (!draft.value.trim()) {
    showError(new ApiError('question_empty', 400))
    return
  }
  sending.value = true
  try {
    const { question } = await api.post<{ question: Question }>(`/events/${code}/questions`, { content: draft.value }, { participant: token.value })
    draft.value = ''
    if (me.value) {
      me.value.votes = [...me.value.votes, question.id]
      if (question.status === 'approved') {
        me.value.ownApproved = [...me.value.ownApproved, question.id]
        questions.value = upsert(questions.value, question)
        toast.success(t('ask.sentLive'))
      } else {
        me.value.questions = [question, ...me.value.questions]
        toast.success(t('ask.sentModerated'))
      }
    }
    startCooldown(config.value?.questionCooldownSeconds || 0)
  } catch (err) {
    if (err instanceof ApiError && err.code === 'slow_down') startCooldown(err.data.retryAfter || 10)
    showError(err)
  } finally {
    sending.value = false
  }
}

// --- voting ---------------------------------------------------------------------
const votedIds = computed(() => new Set(me.value?.votes || []))
const ownIds = computed(() => new Set(me.value?.ownApproved || []))

async function toggleVote(question: Question) {
  if (!me.value || event.value?.closed) return
  const voted = votedIds.value.has(question.id)
  // Optimistic update, corrected by the server's count.
  me.value.votes = voted ? me.value.votes.filter(id => id !== question.id) : [...me.value.votes, question.id]
  questions.value = setVotes(questions.value, question.id, question.votes + (voted ? -1 : 1))
  try {
    const path = `/events/${code}/questions/${question.id}/vote`
    const result = voted
      ? await api.del<{ votes: number }>(path, { participant: token.value })
      : await api.post<{ votes: number }>(path, {}, { participant: token.value })
    questions.value = setVotes(questions.value, question.id, result.votes)
  } catch (err) {
    me.value.votes = voted ? [...me.value.votes, question.id] : me.value.votes.filter(id => id !== question.id)
    questions.value = setVotes(questions.value, question.id, question.votes)
    showError(err)
  }
}

// --- own questions ------------------------------------------------------------------
const editing = ref<string | null>(null)
const editDraft = ref('')

function startEdit(question: Question) {
  editing.value = question.id
  editDraft.value = question.content
}

async function saveEdit(question: Question) {
  try {
    const result = await api.patch<{ question: Question }>(`/events/${code}/questions/${question.id}`, { content: editDraft.value }, { participant: token.value })
    if (me.value) me.value.questions = me.value.questions.map(q => (q.id === question.id ? result.question : q))
    editing.value = null
  } catch (err) {
    showError(err)
  }
}

async function withdraw(question: Question) {
  if (!confirm(t('ask.withdrawConfirm'))) return
  try {
    await api.del(`/events/${code}/questions/${question.id}`, { participant: token.value })
    if (me.value) {
      me.value.questions = me.value.questions.filter(q => q.id !== question.id)
      me.value.ownApproved = me.value.ownApproved.filter(id => id !== question.id)
    }
    questions.value = remove(questions.value, question.id)
    toast(t('ask.withdrawn'))
  } catch (err) {
    showError(err)
  }
}

// --- identity -------------------------------------------------------------------------
const identityOpen = ref(false)
const identity = reactive({ name: '', animal: '' })
const savingIdentity = ref(false)

function openIdentity() {
  identity.name = me.value?.participant.name || ''
  identity.animal = me.value?.participant.animal || 'otter'
  identityOpen.value = true
}

async function saveIdentity() {
  savingIdentity.value = true
  try {
    const result = await api.patch<{ participant: Me['participant'] }>(`/events/${code}/me`, identity, { participant: token.value })
    if (me.value) me.value.participant = result.participant
    identityOpen.value = false
    toast.success(t('identity.saved'))
  } catch (err) {
    showError(err)
  } finally {
    savingIdentity.value = false
  }
}

// --- lists -----------------------------------------------------------------------------
const sortMode = ref<SortMode>('popular')
const spotlight = computed(() => questions.value.find(q => q.id === event.value?.spotlight) || null)
const open = computed(() => sortQuestions(questions.value.filter(q => !q.answeredAt && q.id !== spotlight.value?.id), sortMode.value))
const answered = computed(() => sortQuestions(questions.value.filter(q => q.answeredAt), 'newest'))
const showAnswered = ref(false)

const startsAt = computed(() => (event.value?.startsAt ? d(new Date(event.value.startsAt), 'long') : null))
</script>

<template>
  <div class="pb-24">
    <div v-if="status === 'loading'" class="container-app py-24 text-center text-muted">
      <div class="animate-float text-5xl" aria-hidden="true">🐣</div>
      <p class="mt-3">{{ t('common.loading') }}</p>
    </div>

    <EmptyState v-else-if="status === 'not_found'" emoji="🔍" :title="t('errors.event_not_found_title')" :text="t('errors.event_not_found')" class="py-24">
      <AppButton to="/" variant="soft">{{ t('common.toStart') }}</AppButton>
    </EmptyState>

    <EmptyState v-else-if="status === 'error' || !event" emoji="🥺" :title="t('errors.server_error_title')" :text="t('errors.server_error')" class="py-24" />

    <template v-else>
      <!-- Event header -->
      <section class="bg-pink pt-8 pb-14 text-center">
        <div class="container-app">
          <p v-if="startsAt" class="text-sm font-bold text-ink-deep/80">{{ startsAt }}</p>
          <h1 class="mt-1 text-5xl font-bold break-words text-ink sm:text-7xl">{{ event.title }}</h1>
          <p v-if="event.description" class="mx-auto mt-3 max-w-xl whitespace-pre-line text-ink-deep sm:text-lg">{{ event.description }}</p>
        </div>
      </section>

      <div class="container-app -mt-8 space-y-6">
        <!-- Closed: thank-you screen + newsletter -->
        <section v-if="event.closed" class="card p-6 text-center sm:p-8">
          <div class="text-5xl" aria-hidden="true">🎉</div>
          <h2 class="mt-2 text-4xl font-bold text-ink">{{ t('closed.title') }}</h2>
          <p class="mt-2 text-muted">{{ t('closed.text') }}</p>
          <NewsletterForm v-if="event.newsletter" :code="code" :newsletter="event.newsletter" class="mt-6 text-left" />
        </section>

        <!-- Ask form -->
        <section v-else class="card p-4 sm:p-6">
          <form @submit.prevent="ask">
            <label for="question" class="sr-only">{{ t('ask.label') }}</label>
            <textarea
              id="question"
              v-model="draft"
              class="field min-h-24 resize-none text-lg"
              :placeholder="t('ask.placeholder')"
              :maxlength="maxLength"
              rows="3"
              @keydown.enter.meta.prevent="ask"
              @keydown.enter.ctrl.prevent="ask"
            />
            <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
              <button
                v-if="me"
                type="button"
                class="inline-flex min-w-0 items-center gap-2 rounded-full bg-pink-wash py-1 pr-3 pl-1 text-sm hover:bg-pink-soft"
                @click="openIdentity"
              >
                <span class="grid size-8 place-items-center rounded-full bg-white text-lg" aria-hidden="true">{{ animalEmoji(me.participant.animal) }}</span>
                <span class="truncate">{{ t('identity.askingAs') }} <strong>{{ displayName(me.participant) }}</strong></span>
                <PencilSquareIcon class="size-4 shrink-0 text-ink" aria-hidden="true" />
              </button>
              <div class="ml-auto flex items-center gap-3">
                <span class="text-sm tabular-nums" :class="draft.length > maxLength * 0.9 ? 'text-berry' : 'text-muted'">{{ draft.length }}/{{ maxLength }}</span>
                <AppButton type="submit" :loading="sending" :disabled="cooldownLeft > 0">
                  <template v-if="cooldownLeft > 0">
                    <ClockIcon />{{ t('ask.waitSeconds', { seconds: cooldownLeft }) }}
                  </template>
                  <template v-else>
                    {{ t('ask.submit') }}<PaperAirplaneIcon />
                  </template>
                </AppButton>
              </div>
            </div>
            <p v-if="event.moderation" class="hint mt-3">{{ t('ask.moderatedHint') }}</p>
          </form>
        </section>

        <!-- Own questions waiting for (or declined in) moderation -->
        <section v-if="me && me.questions.length" class="space-y-3">
          <h2 class="text-2xl font-bold text-ink">{{ t('ask.yourQuestions') }}</h2>
          <div v-for="q in me.questions" :key="q.id" class="card border-2 border-dashed p-4" :class="q.status === 'rejected' ? 'border-berry-soft' : 'border-honey-soft'">
            <p class="mb-2 text-sm font-bold" :class="q.status === 'rejected' ? 'text-berry' : 'text-honey'">
              {{ q.status === 'rejected' ? t('ask.rejected') : t('ask.pending') }}
            </p>
            <template v-if="editing === q.id">
              <textarea v-model="editDraft" class="field" rows="3" :maxlength="maxLength" />
              <div class="mt-2 flex gap-2">
                <AppButton size="sm" @click="saveEdit(q)">{{ t('common.save') }}</AppButton>
                <AppButton size="sm" variant="ghost" @click="editing = null">{{ t('common.cancel') }}</AppButton>
              </div>
            </template>
            <template v-else>
              <p class="whitespace-pre-line break-words">{{ q.content }}</p>
              <div class="mt-3 flex gap-2">
                <AppButton v-if="q.status === 'pending' && !event.closed" size="sm" variant="soft" @click="startEdit(q)">
                  <PencilSquareIcon />{{ t('common.edit') }}
                </AppButton>
                <AppButton size="sm" variant="danger" @click="withdraw(q)">
                  <TrashIcon />{{ q.status === 'rejected' ? t('common.remove') : t('ask.withdraw') }}
                </AppButton>
              </div>
            </template>
          </div>
        </section>

        <!-- Now answering -->
        <section v-if="spotlight" aria-live="polite">
          <h2 class="mb-3 flex items-center gap-2 text-2xl font-bold text-ink">
            <MicrophoneIcon class="size-6" aria-hidden="true" />{{ t('ask.nowAnswering') }}
          </h2>
          <QuestionCard
            :question="spotlight"
            spotlight
            :voted="votedIds.has(spotlight.id)"
            :mine="ownIds.has(spotlight.id)"
            :can-vote="!event.closed"
            @vote="toggleVote(spotlight)"
          />
        </section>

        <!-- Open questions (hidden after the event if there are none) -->
        <section v-if="!event.closed || open.length">
          <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 class="text-2xl font-bold text-ink">{{ t('ask.openQuestions') }} <span class="text-muted">({{ open.length }})</span></h2>
            <SegmentedControl
              v-model="sortMode"
              :label="t('ask.sortLabel')"
              :options="[{ value: 'popular', label: t('ask.sortPopular') }, { value: 'newest', label: t('ask.sortNewest') }]"
            />
          </div>
          <EmptyState v-if="!open.length" emoji="🦗" :title="t('ask.emptyTitle')" :text="event.closed ? '' : t('ask.emptyText')" />
          <TransitionGroup v-else name="list" tag="div" class="relative space-y-3">
            <QuestionCard
              v-for="q in open"
              :key="q.id"
              :question="q"
              :voted="votedIds.has(q.id)"
              :mine="ownIds.has(q.id)"
              :can-vote="!event.closed"
              @vote="toggleVote(q)"
            >
              <template v-if="ownIds.has(q.id) && !event.closed" #actions>
                <button type="button" class="text-sm font-bold text-muted hover:text-berry" @click="withdraw(q)">{{ t('ask.withdraw') }}</button>
              </template>
            </QuestionCard>
          </TransitionGroup>
        </section>

        <!-- Answered -->
        <section v-if="answered.length">
          <button type="button" class="flex items-center gap-2 text-xl font-bold text-ink" :aria-expanded="showAnswered" @click="showAnswered = !showAnswered">
            {{ t('ask.answeredQuestions') }} ({{ answered.length }})
            <ChevronDownIcon class="size-5 transition-transform" :class="{ 'rotate-180': showAnswered }" />
          </button>
          <div v-if="showAnswered" class="mt-3 space-y-3">
            <QuestionCard v-for="q in answered" :key="q.id" :question="q" :voted="votedIds.has(q.id)" :mine="ownIds.has(q.id)" />
          </div>
        </section>
      </div>

      <AppDialog v-model:open="identityOpen" :title="t('identity.title')">
        <form class="space-y-5" @submit.prevent="saveIdentity">
          <div>
            <label for="name" class="label">{{ t('identity.nameLabel') }}</label>
            <input id="name" v-model="identity.name" class="field" maxlength="40" :placeholder="displayName({ animal: identity.animal })">
            <p class="hint">{{ t('identity.nameHint') }}</p>
          </div>
          <div>
            <p class="label">{{ t('identity.animalLabel') }}</p>
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="animal in ANIMALS"
                :key="animal"
                type="button"
                class="grid aspect-square place-items-center rounded-xl text-2xl transition-transform hover:scale-110"
                :class="identity.animal === animal ? 'bg-ink-soft ring-2 ring-ink' : 'bg-pink-wash'"
                :aria-label="t(`animals.${animal}`)"
                :aria-pressed="identity.animal === animal"
                @click="identity.animal = animal"
              >
                {{ animalEmoji(animal) }}
              </button>
            </div>
          </div>
          <AppButton type="submit" block :loading="savingIdentity">{{ t('common.save') }}</AppButton>
        </form>
      </AppDialog>
    </template>
  </div>
</template>
