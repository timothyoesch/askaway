<script setup lang="ts">
import type { PublicEvent } from '~/utils/types'

const props = defineProps<{ code: string, newsletter: NonNullable<PublicEvent['newsletter']> }>()
const { t, locale } = useI18n()
const api = useApi()
const showError = useErrorToast()

const form = reactive({ email: '', name: '', consent: false })
const sending = ref(false)
const done = ref(false)

async function submit() {
  if (!form.consent) {
    showError(new ApiError('consent_required', 400))
    return
  }
  sending.value = true
  try {
    await api.post(`/events/${props.code}/subscribe`, { email: form.email, name: form.name, lang: locale.value })
    done.value = true
  } catch (err) {
    showError(err)
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl bg-pink-wash p-5">
    <div v-if="done" class="text-center">
      <div class="text-4xl" aria-hidden="true">💌</div>
      <p class="mt-2 font-display text-2xl font-bold text-ink">{{ t('newsletter.checkInbox') }}</p>
      <p class="mt-1 text-muted">{{ t('newsletter.checkInboxText') }}</p>
    </div>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <div>
        <p class="font-display text-2xl font-bold text-ink">{{ t('newsletter.title', { org: newsletter.org }) }}</p>
        <p class="mt-1 text-muted">{{ newsletter.purpose }}</p>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label for="nl-email" class="label">{{ t('newsletter.email') }}</label>
          <input id="nl-email" v-model="form.email" type="email" class="field" required autocomplete="email">
        </div>
        <div>
          <label for="nl-name" class="label">{{ t('newsletter.name') }} <span class="font-normal text-muted">({{ t('common.optional') }})</span></label>
          <input id="nl-name" v-model="form.name" class="field" maxlength="80" autocomplete="name">
        </div>
      </div>
      <label class="flex items-start gap-3 text-sm">
        <input v-model="form.consent" type="checkbox" class="mt-0.5 size-5 shrink-0 accent-ink">
        <span>
          {{ newsletter.consentText }}
          <a v-if="newsletter.privacyUrl" :href="newsletter.privacyUrl" target="_blank" rel="noopener" class="font-bold text-ink underline">{{ t('newsletter.privacy') }}</a>
        </span>
      </label>
      <p class="hint">{{ t('newsletter.doubleOptIn') }}</p>
      <AppButton type="submit" :loading="sending">{{ t('newsletter.submit') }}</AppButton>
    </form>
  </div>
</template>
