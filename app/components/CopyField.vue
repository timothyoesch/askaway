<script setup lang="ts">
import { ClipboardDocumentIcon, CheckIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'

const props = defineProps<{ label: string, value: string, hint?: string, secret?: boolean }>()
const { t } = useI18n()
const copied = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.value)
    copied.value = true
    toast.success(t('common.copied'))
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    toast.error(t('errors.clipboard'))
  }
}
</script>

<template>
  <div>
    <p class="label">{{ label }}</p>
    <div class="flex items-stretch gap-2">
      <input
        :value="value"
        readonly
        class="field min-w-0 flex-1 truncate py-2.5 font-mono text-sm"
        :class="{ 'blur-[3px] focus:blur-none hover:blur-none': secret }"
        @focus="($event.target as HTMLInputElement).select()"
      >
      <AppButton variant="soft" size="sm" class="!px-3" :aria-label="t('common.copy')" @click="copy">
        <component :is="copied ? CheckIcon : ClipboardDocumentIcon" />
        <span class="hidden sm:inline">{{ copied ? t('common.copied') : t('common.copy') }}</span>
      </AppButton>
    </div>
    <p v-if="hint" class="hint">{{ hint }}</p>
  </div>
</template>
