<script setup lang="ts">
import { RectangleStackIcon, UserCircleIcon } from '@heroicons/vue/24/outline'

defineProps<{ transparent?: boolean }>()
const { t } = useI18n()
const { user } = useAuth()
</script>

<template>
  <header :class="transparent ? '' : 'border-b border-line bg-surface/80 backdrop-blur'">
    <div class="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <NuxtLink to="/" class="font-display text-3xl font-bold text-ink transition-transform hover:-rotate-2">
        Ask Away!
      </NuxtLink>
      <nav class="flex items-center gap-1 sm:gap-2">
        <AppButton to="/events" variant="ghost" size="sm">
          <RectangleStackIcon />
          <span class="hidden sm:inline">{{ t('nav.myEvents') }}</span>
        </AppButton>
        <AppButton v-if="!user" to="/login" variant="ghost" size="sm">
          <UserCircleIcon />
          <span class="hidden sm:inline">{{ t('nav.login') }}</span>
        </AppButton>
        <LangSwitch />
      </nav>
    </div>
  </header>
</template>
