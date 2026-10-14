<script setup lang="ts">
import { ArrowDownTrayIcon, LockClosedIcon, LockOpenIcon, TrashIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'
import type { AdminEvent, Question } from '~/utils/types'

const props = defineProps<{
  code: string
  event: AdminEvent
  questions: Question[]
  updateEvent: (changes: Record<string, unknown>) => Promise<boolean>
  post: <T>(path: string) => Promise<T | null>
  accessKey: string | null
}>()
const emit = defineEmits<{ event: [event: AdminEvent] }>()

const { t } = useI18n()
const api = useApi()
const showError = useErrorToast()
const displayName = useDisplayName()
const saved = useSavedEvents()
const { config, load: loadConfig } = useInstanceConfig()
onMounted(loadConfig)

function toLocalInput(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const form = reactive({
  title: props.event.title,
  description: props.event.description,
  startsAt: toLocalInput(props.event.startsAt),
})
const savingDetails = ref(false)
async function saveDetails() {
  savingDetails.value = true
  const ok = await props.updateEvent({
    title: form.title,
    description: form.description,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
  })
  savingDetails.value = false
  if (ok) toast.success(t('common.saved'))
}

// Moderation switches immediately: it's the setting people look for in a hurry.
const moderation = computed({
  get: () => props.event.moderation,
  set: async (value: boolean) => {
    if (await props.updateEvent({ moderation: value })) {
      toast.success(value ? t('settings.moderationOn') : t('settings.moderationOff'))
    }
  },
})

const newsletter = reactive({
  org: props.event.newsletterOrg,
  purpose: props.event.newsletterPurpose,
  privacyUrl: props.event.newsletterPrivacyUrl,
  enabled: props.event.newsletterEnabled,
})
const savingNewsletter = ref(false)
async function saveNewsletter() {
  savingNewsletter.value = true
  const ok = await props.updateEvent({
    newsletterOrg: newsletter.org,
    newsletterPurpose: newsletter.purpose,
    newsletterPrivacyUrl: newsletter.privacyUrl,
    newsletterEnabled: newsletter.enabled,
  })
  savingNewsletter.value = false
  if (ok) toast.success(t('common.saved'))
}

// --- exports ------------------------------------------------------------------------
const filename = computed(() => `${slug(props.event.title)}-${props.code}`)

function exportQuestions(format: 'csv' | 'md') {
  const rows = sortQuestions(props.questions.filter(q => q.status === 'approved'))
  if (format === 'csv') {
    download(`${filename.value}-questions.csv`, toCsv(rows.map(q => ({
      question: q.content,
      author: displayName(q),
      votes: q.votes,
      pinned: q.pinned ? 'yes' : '',
      answered: q.answeredAt || '',
      asked: q.created,
    }))))
  } else {
    const lines = [`# ${props.event.title}`, '', ...rows.map(q => `- **${q.votes} 👍** ${q.content.replace(/\n+/g, ' ')} — _${displayName(q)}_${q.answeredAt ? ' ✅' : ''}`)]
    download(`${filename.value}-questions.md`, lines.join('\n') + '\n', 'text/markdown')
  }
}

const subscriberInfo = ref<{ pending: number, count: number } | null>(null)
async function exportSubscribers() {
  try {
    const result = await api.get<{ pending: number, subscribers: Array<Record<string, string>> }>(`/events/${props.code}/admin/subscribers`, { key: props.accessKey })
    subscriberInfo.value = { pending: result.pending, count: result.subscribers.length }
    if (!result.subscribers.length) {
      toast(t('settings.noSubscribers'))
      return
    }
    download(`${filename.value}-newsletter.csv`, toCsv(result.subscribers))
  } catch (err) {
    showError(err)
  }
}

async function deleteSubscribers() {
  if (!confirm(t('settings.deleteSubscribersConfirm'))) return
  try {
    await api.del(`/events/${props.code}/admin/subscribers`, { key: props.accessKey })
    subscriberInfo.value = { pending: 0, count: 0 }
    toast.success(t('settings.subscribersDeleted'))
  } catch (err) {
    showError(err)
  }
}

// --- close / delete -------------------------------------------------------------------------
async function toggleClosed() {
  if (!props.event.closed && !confirm(t('settings.closeConfirm'))) return
  const result = await props.post<{ event: AdminEvent }>(props.event.closed ? '/reopen' : '/close')
  if (result) emit('event', result.event)
}

async function destroy() {
  if (!confirm(t('settings.deleteConfirm', { title: props.event.title }))) return
  try {
    await api.del(`/events/${props.code}/admin`, { key: props.accessKey })
    saved.forget(props.code)
    toast.success(t('settings.deleted'))
    await navigateTo('/events')
  } catch (err) {
    showError(err)
  }
}
</script>

<template>
  <div class="space-y-6">
    <!-- Moderation: the most important switch, so it comes first. -->
    <section class="card p-5">
      <ToggleSwitch v-model="moderation" :label="t('settings.moderationLabel')" :description="t('settings.moderationHelp')" />
      <p class="mt-3 rounded-xl bg-pink-wash px-3 py-2 text-sm text-ink-deep">
        {{ event.moderation ? t('settings.moderationStateOn') : t('settings.moderationStateOff') }}
      </p>
    </section>

    <section class="card p-5">
      <h3 class="text-2xl font-bold text-ink">{{ t('settings.details') }}</h3>
      <form class="mt-4 space-y-4" @submit.prevent="saveDetails">
        <div>
          <label for="s-title" class="label">{{ t('settings.title') }}</label>
          <input id="s-title" v-model="form.title" class="field" maxlength="120" required>
        </div>
        <div>
          <label for="s-desc" class="label">{{ t('settings.description') }}</label>
          <textarea id="s-desc" v-model="form.description" class="field" rows="3" maxlength="1000" />
        </div>
        <div>
          <label for="s-start" class="label">{{ t('settings.startsAt') }}</label>
          <input id="s-start" v-model="form.startsAt" type="datetime-local" class="field">
        </div>
        <AppButton type="submit" :loading="savingDetails">{{ t('common.save') }}</AppButton>
      </form>
    </section>

    <section class="card p-5">
      <h3 class="text-2xl font-bold text-ink">{{ t('settings.newsletter') }}</h3>
      <p class="mt-1 text-muted">{{ t('settings.newsletterIntro') }}</p>
      <p v-if="!event.newsletterAvailable" class="mt-4 rounded-xl bg-honey-soft px-3 py-2 text-sm text-honey">
        {{ config?.mailEnabled ? t('settings.newsletterNeedsAccount') : t('settings.newsletterNeedsMail') }}
      </p>
      <form v-else class="mt-4 space-y-4" @submit.prevent="saveNewsletter">
        <div>
          <label for="n-org" class="label">{{ t('settings.newsletterOrg') }}</label>
          <input id="n-org" v-model="newsletter.org" class="field" maxlength="120" :placeholder="t('settings.newsletterOrgPlaceholder')">
        </div>
        <div>
          <label for="n-purpose" class="label">{{ t('settings.newsletterPurpose') }}</label>
          <textarea id="n-purpose" v-model="newsletter.purpose" class="field" rows="2" maxlength="300" :placeholder="t('settings.newsletterPurposePlaceholder')" />
          <p class="hint">{{ t('settings.newsletterPurposeHint') }}</p>
        </div>
        <div>
          <label for="n-privacy" class="label">{{ t('settings.newsletterPrivacy') }} <span class="font-normal text-muted">({{ t('common.optional') }})</span></label>
          <input id="n-privacy" v-model="newsletter.privacyUrl" type="url" class="field" placeholder="https://">
        </div>
        <ToggleSwitch v-model="newsletter.enabled" :label="t('settings.newsletterEnabled')" :description="t('settings.newsletterEnabledHelp')" />
        <div class="rounded-xl bg-pink-wash p-3 text-sm text-ink-deep">
          <p class="font-bold">{{ t('settings.privacyTitle') }}</p>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            <li>{{ t('settings.privacyController') }}</li>
            <li>{{ t('settings.privacyMinimal') }}</li>
            <li>{{ t('settings.privacyRetention', { days: config?.retentionDays || 30 }) }}</li>
          </ul>
        </div>
        <AppButton type="submit" :loading="savingNewsletter">{{ t('common.save') }}</AppButton>
      </form>
    </section>

    <section class="card p-5">
      <h3 class="text-2xl font-bold text-ink">{{ t('settings.export') }}</h3>
      <p class="mt-1 text-muted">{{ t('settings.exportIntro') }}</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <AppButton variant="soft" size="sm" @click="exportQuestions('csv')"><ArrowDownTrayIcon />{{ t('settings.exportCsv') }}</AppButton>
        <AppButton variant="soft" size="sm" @click="exportQuestions('md')"><ArrowDownTrayIcon />{{ t('settings.exportMd') }}</AppButton>
        <AppButton v-if="event.newsletterAvailable" variant="soft" size="sm" @click="exportSubscribers"><ArrowDownTrayIcon />{{ t('settings.exportSubscribers') }}</AppButton>
        <AppButton v-if="event.newsletterAvailable" variant="danger" size="sm" @click="deleteSubscribers"><TrashIcon />{{ t('settings.deleteSubscribers') }}</AppButton>
      </div>
      <p v-if="subscriberInfo" class="hint">{{ t('settings.subscriberStats', subscriberInfo) }}</p>
    </section>

    <section class="card border-2 border-berry-soft p-5">
      <h3 class="text-2xl font-bold text-berry">{{ t('settings.dangerZone') }}</h3>
      <div class="mt-4 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-bold">{{ event.closed ? t('settings.reopen') : t('settings.close') }}</p>
            <p class="hint">{{ event.closed ? t('settings.reopenHelp') : t('settings.closeHelp') }}</p>
          </div>
          <AppButton :variant="event.closed ? 'success' : 'soft'" size="sm" @click="toggleClosed">
            <component :is="event.closed ? LockOpenIcon : LockClosedIcon" />{{ event.closed ? t('settings.reopen') : t('settings.close') }}
          </AppButton>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p class="font-bold">{{ t('settings.delete') }}</p>
            <p class="hint">{{ t('settings.deleteHelp', { days: config?.retentionDays || 30 }) }}</p>
          </div>
          <AppButton variant="danger" size="sm" @click="destroy"><TrashIcon />{{ t('settings.delete') }}</AppButton>
        </div>
      </div>
    </section>
  </div>
</template>
