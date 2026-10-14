<script setup lang="ts">
import { renderSVG } from 'uqr'

const props = defineProps<{ value: string, color?: string, background?: string }>()

const svg = computed(() =>
  renderSVG(props.value, {
    border: 1,
    ecc: 'M',
    blackColor: props.color || '#2a0099',
    whiteColor: props.background || '#ffffff',
  }),
)
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- SVG generated locally from the URL -->
  <div class="[&>svg]:h-full [&>svg]:w-full" role="img" :aria-label="value" v-html="svg" />
</template>
