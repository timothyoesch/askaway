<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const api = useApi()

useHead({ title: () => t('newsletter.confirmTitle') })

const state = ref<'loading' | 'done' | 'invalid' | 'error'>('loading')
const info = ref<{ org: string, title: string } | null>(null)

onMounted(async () => {
  try {
    info.value = await api.post<{ org: string, title: string }>('/newsletter/confirm', { token: String(route.params.token) })
    state.value = 'done'
  } catch (err) {
    state.value = err instanceof ApiError && err.code === 'invalid_token' ? 'invalid' : 'error'
  }
})
</script>

<template>
  <div class="container-app max-w-lg py-16">
    <div class="card p-6">
      <div v-if="state === 'loading'" class="py-10 text-center text-muted">{{ t('common.loading') }}</div>
      <EmptyState v-else-if="state === 'done' && info" emoji="💜" :title="t('newsletter.confirmedTitle')" :text="t('newsletter.confirmedText', info)" />
      <EmptyState v-else-if="state === 'invalid'" emoji="⏳" :title="t('newsletter.invalidTitle')" :text="t('errors.invalid_token')" />
      <EmptyState v-else emoji="🥺" :title="t('errors.server_error_title')" :text="t('errors.server_error')" />
    </div>
  </div>
</template>
