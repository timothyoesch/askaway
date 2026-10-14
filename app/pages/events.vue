<script setup lang="ts">
import { PlusIcon, ArrowRightOnRectangleIcon } from '@heroicons/vue/24/outline'
import type { AdminEvent } from '~/utils/types'

const { t, d } = useI18n()
const api = useApi()
const showError = useErrorToast()
const { user, logout } = useAuth()
const saved = useSavedEvents()

useHead({ title: () => t('nav.myEvents') })

const accountEvents = ref<AdminEvent[]>([])
const loading = ref(true)

async function loadAccount() {
  if (!user.value) {
    accountEvents.value = []
    return
  }
  try {
    accountEvents.value = (await api.get<{ events: AdminEvent[] }>('/me/events')).events
  } catch (err) {
    showError(err)
  }
}

onMounted(async () => {
  saved.load()
  await loadAccount()
  loading.value = false
})
watch(user, loadAccount)

// Browser-only events that aren't already listed under the account.
const localOnly = computed(() => saved.events.value.filter(e => !accountEvents.value.some(a => a.code === e.code)))

function adminLink(code: string) {
  return `/e/${code}/admin`
}
</script>

<template>
  <div class="container-app py-10">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-5xl font-bold text-ink">{{ t('nav.myEvents') }}</h1>
        <p v-if="user" class="mt-1 text-muted">{{ t('events.loggedInAs', { email: user.email }) }}</p>
      </div>
      <div class="flex gap-2">
        <AppButton to="/"><PlusIcon />{{ t('events.new') }}</AppButton>
        <AppButton v-if="user" variant="ghost" @click="logout"><ArrowRightOnRectangleIcon />{{ t('nav.logout') }}</AppButton>
      </div>
    </div>

    <div v-if="loading" class="py-16 text-center text-muted">{{ t('common.loading') }}</div>

    <template v-else>
      <section v-if="user" class="mt-8">
        <h2 class="text-2xl font-bold text-ink">{{ t('events.account') }}</h2>
        <EmptyState v-if="!accountEvents.length" emoji="🗂️" :title="t('events.accountEmpty')" />
        <div v-else class="mt-3 space-y-3">
          <NuxtLink v-for="e in accountEvents" :key="e.code" :to="adminLink(e.code)" class="card flex items-center justify-between gap-4 p-4 transition-shadow hover:shadow-(--shadow-lift)">
            <div class="min-w-0">
              <p class="truncate text-lg font-bold">{{ e.title }}</p>
              <p class="text-sm text-muted">
                <span class="font-mono font-bold text-ink">{{ e.code }}</span>
                · {{ e.startsAt ? d(new Date(e.startsAt), 'long') : d(new Date(e.created), 'short') }}
                <span v-if="e.closed"> · {{ t('admin.closed') }}</span>
              </p>
            </div>
            <span class="text-2xl" aria-hidden="true">→</span>
          </NuxtLink>
        </div>
      </section>

      <section class="mt-10">
        <h2 class="text-2xl font-bold text-ink">{{ t('events.browser') }}</h2>
        <p class="mt-1 text-muted">{{ user ? t('events.browserHintLoggedIn') : t('events.browserHint') }}</p>
        <EmptyState v-if="!localOnly.length" emoji="🌷" :title="t('events.browserEmpty')" />
        <div v-else class="mt-3 space-y-3">
          <div v-for="e in localOnly" :key="e.code" class="card flex items-center justify-between gap-4 p-4">
            <NuxtLink :to="adminLink(e.code)" class="min-w-0 flex-1">
              <p class="truncate text-lg font-bold">{{ e.title || e.code }}</p>
              <p class="text-sm text-muted">
                <span class="font-mono font-bold text-ink">{{ e.code }}</span>
                · {{ e.ownerKey ? t('admin.roleOwner') : t('admin.roleMod') }}
              </p>
            </NuxtLink>
            <AppButton variant="ghost" size="sm" @click="saved.forget(e.code)">{{ t('events.forget') }}</AppButton>
          </div>
        </div>
        <p v-if="!user" class="mt-6 text-center">
          <AppButton to="/login?next=/events" variant="soft">{{ t('events.loginCta') }}</AppButton>
        </p>
      </section>
    </template>
  </div>
</template>
