<script setup lang="ts">
import { Toaster } from 'vue-sonner'
import 'vue-sonner/style.css'

const { locale, t } = useI18n()

useHead({
  titleTemplate: (title?: string) => (title ? `${title} · Ask Away!` : 'Ask Away!'),
  htmlAttrs: { lang: locale },
  meta: [{ name: 'description', content: () => t('app.description') }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster position="top-center" rich-colors :toast-options="{ style: { borderRadius: '1rem', fontFamily: 'inherit' } }" />
</template>
