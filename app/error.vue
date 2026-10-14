<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const { t } = useI18n()
const notFound = computed(() => props.error.statusCode === 404)

useHead({ title: () => (notFound.value ? t('errors.page_not_found_title') : t('errors.server_error_title')) })
</script>

<template>
  <div class="flex min-h-dvh flex-col">
    <AppHeader />
    <main class="grid flex-1 place-items-center">
      <EmptyState
        :emoji="notFound ? '🙈' : '🥺'"
        :title="notFound ? t('errors.page_not_found_title') : t('errors.server_error_title')"
        :text="notFound ? t('errors.page_not_found') : t('errors.server_error')"
      >
        <AppButton @click="clearError({ redirect: '/' })">{{ t('common.toStart') }}</AppButton>
      </EmptyState>
    </main>
  </div>
</template>
