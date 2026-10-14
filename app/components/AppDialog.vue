<script setup lang="ts">
import { XMarkIcon } from '@heroicons/vue/24/outline'

const open = defineModel<boolean>('open', { required: true })
defineProps<{ title: string }>()
const { t } = useI18n()
const dialog = ref<HTMLDialogElement | null>(null)

watch(open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) dialog.value.showModal()
  if (!value && dialog.value.open) dialog.value.close()
})
onMounted(() => {
  if (open.value) dialog.value?.showModal()
})
</script>

<template>
  <dialog
    ref="dialog"
    class="m-auto w-[calc(100%-2rem)] max-w-md rounded-(--radius-card) bg-surface p-0 text-text shadow-(--shadow-lift) backdrop:bg-ink-deep/40 backdrop:backdrop-blur-sm open:animate-pop"
    @close="open = false"
    @click.self="open = false"
  >
    <div class="p-6">
      <div class="mb-4 flex items-start justify-between gap-4">
        <h2 class="text-3xl font-bold text-ink">{{ title }}</h2>
        <button type="button" class="rounded-full p-1 text-muted hover:bg-ink-soft hover:text-ink" :aria-label="t('common.close')" @click="open = false">
          <XMarkIcon class="size-6" />
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>
