<script setup lang="ts" generic="T extends string">
const model = defineModel<T>({ required: true })
defineProps<{ options: Array<{ value: T, label: string }>, label?: string }>()
</script>

<template>
  <div class="inline-flex rounded-full bg-ink-soft/60 p-1" role="radiogroup" :aria-label="label">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="radio"
      :aria-checked="model === option.value"
      class="rounded-full px-4 py-1.5 text-sm font-bold transition-colors"
      :class="model === option.value ? 'bg-ink text-pink shadow' : 'text-ink-deep hover:bg-white/60'"
      @click="model = option.value"
    >
      {{ option.label }}
    </button>
  </div>
</template>
