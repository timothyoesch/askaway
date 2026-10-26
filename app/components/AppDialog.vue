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
    class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-(--radius-card) bg-surface p-0 text-text shadow-(--shadow-lift) backdrop:bg-ink-deep/40 backdrop:backdrop-blur-sm open:animate-pop"
    @close="open = false"
    @click.self="open = false"
  >
    <div class="p-6">
      <div class="mb-4 flex items-start justify-between gap-4">
        <!-- Initial focus on the title: no focus ring on the close button, no keyboard popping up on phones. -->
        <h2 tabindex="-1" autofocus class="text-3xl font-bold text-ink outline-none">{{ title }}</h2>
        <button type="button" class="rounded-full p-1 text-muted hover:bg-ink-soft hover:text-ink" :aria-label="t('common.close')" @click="open = false">
          <XMarkIcon class="size-6" />
        </button>
      </div>
      <slot />
    </div>
  </dialog>
</template>
