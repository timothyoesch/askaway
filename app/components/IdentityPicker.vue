<script setup lang="ts">
// Name + animal picker, used in the welcome dialog and the "who are you" dialog.
const name = defineModel<string>('name', { required: true })
const animal = defineModel<string>('animal', { required: true })
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const { t } = useI18n()
const displayName = useDisplayName()
const id = useId()

// Keep the selected animal visible in the swipeable row.
const row = ref<HTMLElement | null>(null)
function revealSelected() {
  row.value?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' })
}
watch(animal, revealSelected, { flush: 'post' })
defineExpose({ revealSelected })

function shuffle() {
  const others = ANIMALS.filter(a => a !== animal.value)
  animal.value = others[Math.floor(Math.random() * others.length)]!
}
</script>

<template>
  <div class="space-y-4">
    <div>
      <label :for="id" class="label">{{ t('identity.nameLabel') }}</label>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="grid size-12 shrink-0 place-items-center rounded-2xl bg-pink-wash text-2xl transition-transform hover:scale-110 active:scale-95"
          :aria-label="t('identity.shuffle')"
          :title="t('identity.shuffle')"
          @click="shuffle"
        >
          <span :key="animal" class="animate-pop" aria-hidden="true">{{ animalEmoji(animal) }}</span>
        </button>
        <input :id="id" v-model="name" class="field" maxlength="40" :placeholder="displayName({ animal })" autocomplete="nickname">
      </div>
      <p class="hint">{{ t('identity.nameHint') }}</p>
    </div>
    <div>
      <p class="label">{{ t('identity.animalLabel') }}</p>
      <!-- Compact: one swipeable row, so the dialog stays short on phones. -->
      <div
        ref="row"
        class="gap-1.5"
        :class="compact ? '-mx-1 flex snap-x overflow-x-auto px-1 pt-1 pb-2' : 'grid grid-cols-6'"
      >
        <button
          v-for="option in ANIMALS"
          :key="option"
          type="button"
          class="grid shrink-0 snap-start place-items-center rounded-xl transition-transform hover:scale-110"
          :class="[
            compact ? 'size-11 text-2xl' : 'aspect-square text-2xl',
            animal === option ? 'bg-ink-soft ring-2 ring-ink' : 'bg-pink-wash',
          ]"
          :aria-label="t(`animals.${option}`)"
          :aria-pressed="animal === option"
          @click="animal = option"
        >
          {{ animalEmoji(option) }}
        </button>
      </div>
    </div>
  </div>
</template>
