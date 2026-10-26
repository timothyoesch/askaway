<script setup lang="ts">
import type { Participant } from '~/utils/types'

// First-visit explainer on the participant page: how it works in three lines,
// then pick a name and animal (or just stay anonymous).
const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ moderation: boolean, participant: Participant, saving?: boolean }>()
const emit = defineEmits<{ save: [identity: { name: string, animal: string }] }>()

const { t } = useI18n()
const identity = reactive({ name: '', animal: '' })
const picker = ref<{ revealSelected: () => void } | null>(null)

watch(open, async (value) => {
  if (!value) return
  identity.name = props.participant.name
  identity.animal = props.participant.animal
  await nextTick()
  picker.value?.revealSelected()
}, { immediate: true })

function done() {
  const changed = identity.name.trim() !== props.participant.name || identity.animal !== props.participant.animal
  if (changed) emit('save', { name: identity.name.trim(), animal: identity.animal })
  else open.value = false
}

const steps = computed(() => [
  { emoji: '✍️', text: t('welcome.ask') },
  { emoji: '👍', text: t('welcome.vote') },
  props.moderation
    ? { emoji: '🛡️', text: t('welcome.moderated') }
    : { emoji: '⚡', text: t('welcome.instant') },
])
</script>

<template>
  <AppDialog v-model:open="open" :title="t('welcome.title')">
    <ul class="space-y-2.5">
      <li v-for="step in steps" :key="step.emoji" class="flex items-start gap-3">
        <span class="grid size-8 shrink-0 place-items-center rounded-full bg-pink-wash text-lg" aria-hidden="true">{{ step.emoji }}</span>
        <span class="pt-1">{{ step.text }}</span>
      </li>
    </ul>

    <form class="mt-6 border-t border-line pt-5" @submit.prevent="done">
      <IdentityPicker ref="picker" v-model:name="identity.name" v-model:animal="identity.animal" compact />
      <AppButton type="submit" block size="lg" class="mt-5" :loading="saving">{{ t('welcome.start') }}</AppButton>
    </form>
  </AppDialog>
</template>
