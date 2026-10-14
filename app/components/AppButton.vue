<script setup lang="ts">
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(defineProps<{
  variant?: 'primary' | 'soft' | 'ghost' | 'danger' | 'success' | 'pink'
  size?: 'sm' | 'md' | 'lg'
  to?: RouteLocationRaw
  href?: string
  type?: 'button' | 'submit'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button',
})

const classes = computed(() => [
  'inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap select-none',
  'transition-[transform,background-color,box-shadow,opacity] duration-150 active:scale-[0.97]',
  'disabled:pointer-events-none disabled:opacity-50',
  {
    sm: 'px-3.5 py-1.5 text-sm [&_svg]:size-4',
    md: 'px-5 py-2.5 text-base [&_svg]:size-5',
    lg: 'px-7 py-3.5 text-lg [&_svg]:size-6',
  }[props.size],
  {
    primary: 'bg-ink text-pink shadow-(--shadow-card) hover:bg-ink-deep hover:shadow-(--shadow-lift)',
    pink: 'bg-pink text-ink-deep hover:bg-pink-soft',
    soft: 'bg-ink-soft text-ink-deep hover:bg-ink-soft/70',
    ghost: 'text-ink hover:bg-ink-soft/60',
    danger: 'bg-berry-soft text-berry hover:bg-berry hover:text-white',
    success: 'bg-mint-soft text-mint hover:bg-mint hover:text-white',
  }[props.variant],
  props.block ? 'w-full' : '',
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <slot />
  </NuxtLink>
  <a v-else-if="href" :href="href" :class="classes" target="_blank" rel="noopener">
    <slot />
  </a>
  <button v-else :type="type" :class="classes" :disabled="disabled || loading" :aria-busy="loading">
    <span v-if="loading" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>
