<script setup lang="ts">
import { EnvelopeIcon, KeyIcon } from '@heroicons/vue/24/outline'
import { toast } from 'vue-sonner'

const { t } = useI18n()
const route = useRoute()
const showError = useErrorToast()
const { user, requestCode, verifyCode, logout } = useAuth()
const { config, load: loadConfig } = useInstanceConfig()
onMounted(loadConfig)

useHead({ title: () => t('login.metaTitle') })

const email = ref('')
const code = ref('')
const otpId = ref<string | null>(null)
const busy = ref(false)

// Only allow internal redirects.
const next = computed(() => {
  const value = String(route.query.next || '/events')
  return value.startsWith('/') && !value.startsWith('//') ? value : '/events'
})

async function sendCode() {
  busy.value = true
  try {
    otpId.value = await requestCode(email.value.trim())
    toast.success(t('login.codeSent'))
  } catch (err) {
    showError(err)
  } finally {
    busy.value = false
  }
}

async function verify() {
  if (!otpId.value) return
  busy.value = true
  try {
    await verifyCode(otpId.value, code.value.replace(/\s/g, ''))
    toast.success(t('login.welcome'))
    await navigateTo(next.value)
  } catch (err) {
    showError(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="container-app max-w-md py-12">
    <div class="card p-6 sm:p-8">
      <template v-if="user">
        <EmptyState emoji="👋" :title="t('login.loggedInTitle')" :text="t('login.loggedInText', { email: user.email })">
          <div class="flex flex-wrap justify-center gap-2">
            <AppButton to="/events">{{ t('nav.myEvents') }}</AppButton>
            <AppButton variant="ghost" @click="logout">{{ t('nav.logout') }}</AppButton>
          </div>
        </EmptyState>
      </template>

      <EmptyState v-else-if="config && !config.mailEnabled" emoji="📭" :title="t('login.unavailableTitle')" :text="t('errors.mail_not_configured')" />

      <template v-else>
        <h1 class="text-4xl font-bold text-ink">{{ t('login.title') }}</h1>
        <p class="mt-1 text-muted">{{ t('login.intro') }}</p>

        <form v-if="!otpId" class="mt-6 space-y-4" @submit.prevent="sendCode">
          <div>
            <label for="email" class="label">{{ t('login.email') }}</label>
            <input id="email" v-model="email" type="email" class="field" required autocomplete="email" autofocus>
          </div>
          <AppButton type="submit" block :loading="busy"><EnvelopeIcon />{{ t('login.sendCode') }}</AppButton>
          <p v-if="config?.registration === 'closed'" class="hint text-center">{{ t('login.inviteOnly') }}</p>
        </form>

        <form v-else class="mt-6 space-y-4" @submit.prevent="verify">
          <p class="rounded-xl bg-pink-wash px-4 py-3 text-sm text-ink-deep">{{ t('login.checkInbox', { email }) }}</p>
          <div>
            <label for="code" class="label">{{ t('login.code') }}</label>
            <input
              id="code"
              v-model="code"
              class="field text-center font-mono text-3xl tracking-[0.5em]"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="7"
              required
              autofocus
            >
          </div>
          <AppButton type="submit" block :loading="busy"><KeyIcon />{{ t('login.verify') }}</AppButton>
          <button type="button" class="w-full text-center text-sm font-bold text-ink hover:underline" @click="otpId = null; code = ''">
            {{ t('login.otherEmail') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
