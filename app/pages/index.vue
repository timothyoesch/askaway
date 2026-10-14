<script setup lang="ts">
import { RocketLaunchIcon, ArrowRightIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import type { AdminEvent } from '~/utils/types'

const { t } = useI18n()
const api = useApi()
const showError = useErrorToast()
const { user } = useAuth()
const { config, load: loadConfig } = useInstanceConfig()
const saved = useSavedEvents()

useHead({ title: () => t('home.metaTitle') })

const form = reactive({
  title: '',
  description: '',
  startsAt: '',
  moderation: true,
})
const showMore = ref(false)
const creating = ref(false)
const joinCode = ref('')

onMounted(async () => {
  const cfg = await loadConfig()
  if (cfg) form.moderation = cfg.defaultModeration
})

const mustLogin = computed(() => config.value?.eventCreation === 'registered' && !user.value)

async function create() {
  if (!form.title.trim()) {
    showError(new ApiError('title_required', 400))
    return
  }
  creating.value = true
  try {
    const result = await api.post<{ code: string, ownerKey: string, modKey: string, event: AdminEvent }>('/events', {
      title: form.title,
      description: form.description,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : '',
      moderation: form.moderation,
    })
    saved.save({ code: result.code, title: result.event.title, ownerKey: result.ownerKey, modKey: result.modKey })
    await navigateTo(`/e/${result.code}/admin?welcome=1#key=${result.ownerKey}`)
  } catch (err) {
    showError(err)
  } finally {
    creating.value = false
  }
}

function join() {
  const code = joinCode.value.replace(/[^0-9a-z]/gi, '').toUpperCase()
  if (code.length === 6) navigateTo(`/e/${code}`)
  else showError(new ApiError('invalid_code_format', 400))
}
</script>

<template>
  <div>
    <section class="bg-pink pb-16 pt-10 sm:pt-16">
      <div class="container-app text-center">
        <h1 class="text-7xl font-bold text-ink sm:text-9xl">Ask Away!</h1>
        <p class="mx-auto mt-3 max-w-xl text-lg text-ink-deep sm:text-2xl">{{ t('home.tagline') }}</p>

        <div class="card mx-auto mt-10 max-w-xl p-5 text-left sm:p-7">
          <template v-if="mustLogin">
            <EmptyState emoji="🔑" :title="t('home.loginToCreateTitle')" :text="t('home.loginToCreateText')">
              <AppButton to="/login?next=/">{{ t('nav.login') }}</AppButton>
            </EmptyState>
          </template>
          <form v-else @submit.prevent="create">
            <label for="title" class="label">{{ t('home.titleLabel') }}</label>
            <div class="flex flex-col gap-3 sm:flex-row">
              <input
                id="title"
                v-model="form.title"
                class="field text-lg"
                :placeholder="t('home.titlePlaceholder')"
                maxlength="120"
                autocomplete="off"
              >
              <AppButton type="submit" size="lg" :loading="creating" class="shrink-0">
                {{ t('home.create') }}
                <RocketLaunchIcon />
              </AppButton>
            </div>

            <button
              type="button"
              class="mt-4 inline-flex items-center gap-1 text-sm font-bold text-ink hover:underline"
              :aria-expanded="showMore"
              @click="showMore = !showMore"
            >
              {{ t('home.moreOptions') }}
              <ChevronDownIcon class="size-4 transition-transform" :class="{ 'rotate-180': showMore }" />
            </button>

            <div v-if="showMore" class="mt-4 space-y-4">
              <div>
                <label for="description" class="label">{{ t('settings.description') }} <span class="font-normal text-muted">({{ t('common.optional') }})</span></label>
                <textarea id="description" v-model="form.description" class="field" rows="2" maxlength="1000" />
              </div>
              <div>
                <label for="startsAt" class="label">{{ t('settings.startsAt') }} <span class="font-normal text-muted">({{ t('common.optional') }})</span></label>
                <input id="startsAt" v-model="form.startsAt" type="datetime-local" class="field">
              </div>
              <ToggleSwitch v-model="form.moderation" :label="t('settings.moderationLabel')" :description="t('settings.moderationHelp')" />
            </div>
          </form>
        </div>
      </div>
    </section>

    <section class="container-app -mt-8">
      <form class="card mx-auto flex max-w-xl items-center gap-3 p-3 pl-5" @submit.prevent="join">
        <label for="join" class="shrink-0 font-bold">{{ t('home.joinLabel') }}</label>
        <input
          id="join"
          v-model="joinCode"
          class="min-w-0 flex-1 bg-transparent font-mono text-lg uppercase tracking-[0.3em] focus:outline-none"
          placeholder="K7F2Q9"
          maxlength="7"
          autocomplete="off"
          autocapitalize="characters"
        >
        <AppButton type="submit" variant="soft" size="sm" :aria-label="t('home.join')">
          <ArrowRightIcon />
        </AppButton>
      </form>

      <div class="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-3">
        <div v-for="feature in ['noSignup', 'bigScreen', 'trackingFree']" :key="feature" class="card p-5 text-center">
          <div class="text-4xl" aria-hidden="true">{{ t(`home.features.${feature}.emoji`) }}</div>
          <p class="mt-2 font-display text-2xl font-bold text-ink">{{ t(`home.features.${feature}.title`) }}</p>
          <p class="mt-1 text-muted">{{ t(`home.features.${feature}.text`) }}</p>
        </div>
      </div>
    </section>
  </div>
</template>
