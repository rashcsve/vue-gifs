<script setup lang="ts">
// Visible error with a retry button. Screen readers hear the error from GifStatus.
defineProps<{
  message: string
  /** Disables "Try again" while a request is pending */
  busy: boolean
}>()

const emit = defineEmits<{ (e: 'retry'): void }>()
</script>

<template>
  <p class="text-red-600">
    {{ message }}
    <button class="underline ml-2" :disabled="busy" @click="emit('retry')">Try again</button>
  </p>
</template>
