<script setup lang="ts">
import { HandThumbUpIcon as OutlineThumb } from '@heroicons/vue/24/outline'
import { HandThumbUpIcon as SolidThumb } from '@heroicons/vue/24/solid'

const props = defineProps<{
  votes: number
  voted?: boolean
  disabled?: boolean
  large?: boolean
}>()
defineEmits<{ toggle: [] }>()

const { t } = useI18n()

// Re-trigger the pop animation whenever the count changes.
const bump = ref(0)
watch(() => props.votes, () => bump.value++)
</script>

<template>
  <button
    type="button"
    class="flex shrink-0 flex-col items-center justify-center rounded-2xl font-extrabold transition-colors"
    :class="[
      large ? 'min-w-24 px-4 py-3 text-4xl [&_svg]:size-10' : 'min-w-14 px-2.5 py-2 text-base [&_svg]:size-5',
      voted ? 'bg-ink text-pink' : 'bg-ink-soft/70 text-ink-deep',
      disabled ? 'cursor-default' : 'hover:bg-ink hover:text-pink active:scale-95',
    ]"
    :disabled="disabled"
    :aria-pressed="voted"
    :aria-label="voted ? t('question.unvote') : t('question.vote')"
    @click="$emit('toggle')"
  >
    <component :is="voted ? SolidThumb : OutlineThumb" :class="{ 'animate-wiggle': voted }" aria-hidden="true" />
    <span :key="bump" class="animate-pop tabular-nums">{{ votes }}</span>
  </button>
</template>
