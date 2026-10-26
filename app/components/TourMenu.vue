<script setup lang="ts">
import { QuestionMarkCircleIcon, BellSlashIcon, BellAlertIcon } from '@heroicons/vue/24/outline'

defineProps<{ items: Array<{ id: string, emoji: string, label: string }>, autoEnabled: boolean }>()
const emit = defineEmits<{ start: [id: string], toggleAuto: [] }>()

const { t } = useI18n()
const open = ref(false)
const root = ref<HTMLElement | null>(null)

function choose(id: string) {
  open.value = false
  emit('start', id)
}

function onDocumentClick(event: MouseEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}
onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="root" class="relative">
    <AppButton variant="ghost" size="sm" data-tour="help" :aria-expanded="open" aria-haspopup="menu" @click="open = !open">
      <QuestionMarkCircleIcon />{{ t('tour.help') }}
    </AppButton>
    <Transition name="fade">
      <div v-if="open" role="menu" class="card absolute right-0 z-30 mt-2 w-64 p-2">
        <p class="px-3 pt-2 pb-1 text-xs font-bold tracking-wide text-muted uppercase">{{ t('tour.menuTitle') }}</p>
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left font-bold text-ink-deep hover:bg-pink-wash"
          @click="choose(item.id)"
        >
          <span aria-hidden="true">{{ item.emoji }}</span>{{ item.label }}
        </button>
        <hr class="my-1 border-line">
        <button
          type="button"
          role="menuitem"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-muted hover:bg-pink-wash"
          @click="open = false; emit('toggleAuto')"
        >
          <component :is="autoEnabled ? BellSlashIcon : BellAlertIcon" class="size-4 shrink-0" aria-hidden="true" />
          {{ autoEnabled ? t('tour.disable') : t('tour.enable') }}
        </button>
      </div>
    </Transition>
  </div>
</template>
