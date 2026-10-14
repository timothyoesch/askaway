<script setup lang="ts">
defineProps<{ emoji: string, title: string, text?: string }>()
</script>

<template>
  <div class="flex flex-col items-center px-6 py-10 text-center">
    <div class="mb-3 animate-float text-5xl" aria-hidden="true">{{ emoji }}</div>
    <p class="font-display text-2xl font-bold text-ink">{{ title }}</p>
    <p v-if="text" class="mt-1 max-w-sm text-muted">{{ text }}</p>
    <div v-if="$slots.default" class="mt-4">
      <slot />
    </div>
  </div>
</template>
