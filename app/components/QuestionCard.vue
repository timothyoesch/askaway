<script setup lang="ts">
import { StarIcon, SparklesIcon, CheckCircleIcon } from '@heroicons/vue/24/solid'
import type { Question } from '~/utils/types'

const props = withDefaults(defineProps<{
  question: Question
  voted?: boolean
  canVote?: boolean
  mine?: boolean
  spotlight?: boolean
  showVotes?: boolean
}>(), { showVotes: true })
defineEmits<{ vote: [] }>()

const { t } = useI18n()
const displayName = useDisplayName()
const answered = computed(() => !!props.question.answeredAt)
</script>

<template>
  <article
    class="card relative flex gap-3 p-4 transition-shadow sm:gap-4 sm:p-5"
    :class="{
      'ring-2 ring-ink': spotlight,
      'ring-2 ring-pink': question.pinned && !spotlight,
      'opacity-70': answered,
    }"
  >
    <div class="min-w-0 flex-1">
      <div class="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
        <span class="text-lg leading-none" aria-hidden="true">{{ animalEmoji(question.animal) }}</span>
        <span class="font-bold text-text">{{ displayName(question) }}</span>
        <span v-if="mine" class="rounded-full bg-pink-soft px-2 py-0.5 text-xs font-bold text-ink-deep">{{ t('question.you') }}</span>
        <span v-if="spotlight" class="inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-pink">
          <SparklesIcon class="size-3.5" aria-hidden="true" />{{ t('question.spotlight') }}
        </span>
        <span v-else-if="question.pinned" class="inline-flex items-center gap-1 rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-ink-deep">
          <StarIcon class="size-3.5" aria-hidden="true" />{{ t('question.pinned') }}
        </span>
        <span v-if="answered" class="inline-flex items-center gap-1 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-mint">
          <CheckCircleIcon class="size-3.5" aria-hidden="true" />{{ t('question.answered') }}
        </span>
      </div>
      <p class="text-base leading-relaxed break-words whitespace-pre-line sm:text-lg">{{ question.content }}</p>
      <div v-if="$slots.actions" class="mt-3 flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
    <VoteButton
      v-if="showVotes"
      :votes="question.votes"
      :voted="voted"
      :disabled="!canVote || answered"
      class="self-start"
      @toggle="$emit('vote')"
    />
  </article>
</template>
