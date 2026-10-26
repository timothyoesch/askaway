<script setup lang="ts">
import { ArrowPathIcon, UserPlusIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'
import type { AdminEvent, Role } from '~/utils/types'

const props = defineProps<{
  code: string
  role: Role
  event: AdminEvent
  accessKey: string | null
  post: <T>(path: string) => Promise<T | null>
}>()
const emit = defineEmits<{ claimed: [event: AdminEvent] }>()

const { t } = useI18n()
const { user } = useAuth()
const saved = useSavedEvents()
const route = useRoute()

const origin = ref('')
onMounted(() => (origin.value = window.location.origin))

const modKey = ref<string | null>(null)
onMounted(() => (modKey.value = saved.find(props.code)?.modKey || null))

const participantUrl = computed(() => `${origin.value}/e/${props.code}`)
const presentUrl = computed(() => `${origin.value}/e/${props.code}/present`)
const modUrl = computed(() => (modKey.value ? `${origin.value}/e/${props.code}/admin#key=${modKey.value}` : ''))
const ownerKey = computed(() => (props.role === 'owner' ? saved.find(props.code)?.ownerKey : null))
const ownerUrl = computed(() => (ownerKey.value ? `${origin.value}/e/${props.code}/admin#key=${ownerKey.value}` : ''))

const rotating = ref(false)
async function newModLink() {
  if (modKey.value && !confirm(t('share.rotateConfirm'))) return
  rotating.value = true
  const result = await props.post<{ modKey: string }>('/mod-key')
  rotating.value = false
  if (result) {
    modKey.value = result.modKey
    saved.save({ code: props.code, modKey: result.modKey })
    toast.success(t('share.rotated'))
  }
}

const claiming = ref(false)
async function claim() {
  claiming.value = true
  const result = await props.post<{ event: AdminEvent }>('/claim')
  claiming.value = false
  if (result) {
    emit('claimed', result.event)
    toast.success(t('share.claimed'))
  }
}
</script>

<template>
  <div class="space-y-6">
    <section class="card space-y-4 p-5" data-tour="share-public">
      <h3 class="text-2xl font-bold text-ink">{{ t('share.forEveryone') }}</h3>
      <CopyField :label="t('share.participantLink')" :value="participantUrl" :hint="t('share.participantHint')" />
      <CopyField :label="t('share.presentLink')" :value="presentUrl" :hint="t('share.presentHint')" />
    </section>

    <section v-if="role === 'owner'" class="card space-y-4 p-5" data-tour="share-team">
      <h3 class="text-2xl font-bold text-ink">{{ t('share.forTeam') }}</h3>
      <CopyField v-if="modUrl" :label="t('share.modLink')" :value="modUrl" :hint="t('share.modHint')" secret />
      <p v-else class="text-muted">{{ t('share.noModLink') }}</p>
      <AppButton variant="soft" size="sm" :loading="rotating" @click="newModLink">
        <ArrowPathIcon />{{ modUrl ? t('share.rotate') : t('share.createModLink') }}
      </AppButton>

      <div v-if="ownerUrl" class="rounded-2xl bg-honey-soft p-4">
        <CopyField :label="t('share.ownerLink')" :value="ownerUrl" secret />
        <p class="mt-2 text-sm text-honey">{{ t('share.ownerWarning') }}</p>
      </div>
    </section>

    <section v-if="role === 'owner' && !event.hasOwner" class="card p-5" data-tour="share-account">
      <h3 class="text-2xl font-bold text-ink">{{ t('share.accountTitle') }}</h3>
      <p class="mt-1 text-muted">{{ t('share.accountText') }}</p>
      <AppButton v-if="user" class="mt-4" :loading="claiming" @click="claim">
        <UserPlusIcon />{{ t('share.claim') }}
      </AppButton>
      <AppButton v-else class="mt-4" variant="soft" :to="`/login?next=${encodeURIComponent(route.fullPath)}`">
        {{ t('share.loginToClaim') }}
      </AppButton>
    </section>
  </div>
</template>
