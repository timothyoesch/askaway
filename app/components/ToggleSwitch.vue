<script setup lang="ts">
const model = defineModel<boolean>({ required: true })
defineProps<{ label: string, description?: string, disabled?: boolean }>()
const id = useId()
</script>

<template>
  <div class="flex items-start justify-between gap-4">
    <div>
      <label :for="id" class="font-bold" :class="{ 'opacity-50': disabled }">{{ label }}</label>
      <p v-if="description" class="hint">{{ description }}</p>
    </div>
    <button
      :id="id"
      type="button"
      role="switch"
      :aria-checked="model"
      :disabled="disabled"
      class="relative mt-0.5 h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50"
      :class="model ? 'bg-ink' : 'bg-line'"
      @click="model = !model"
    >
      <span
        class="absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform"
        :class="model ? 'translate-x-5 bg-pink' : ''"
      />
    </button>
  </div>
</template>
