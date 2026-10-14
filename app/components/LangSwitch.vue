<script setup lang="ts">
const { locale, locales, setLocale, t } = useI18n()
</script>

<template>
  <div class="inline-flex rounded-full bg-white/60 p-0.5 text-xs font-bold" role="group" :aria-label="t('nav.language')">
    <button
      v-for="item in locales"
      :key="item.code"
      type="button"
      class="rounded-full px-2.5 py-1 uppercase transition-colors"
      :class="locale === item.code ? 'bg-ink text-pink' : 'text-ink-deep hover:bg-white'"
      :aria-pressed="locale === item.code"
      :title="item.name"
      @click="setLocale(item.code)"
    >
      {{ item.code }}
    </button>
  </div>
</template>
