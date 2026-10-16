<script setup lang="ts">
import { RouteName } from '@/router/names'

const goHome = { name: RouteName.Trends } as const
</script>

<template>
  <section
    class="flex flex-col items-center justify-center text-center min-h-[60vh] p-8 min-w-[320px]"
  >
    <h1 class="text-4xl font-bold">404</h1>
    <p class="mt-2 text-lg opacity-80">Page not found</p>
    <RouterLink
      :to="goHome"
      class="mt-6 inline-block px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700"
    >
      Go back home
    </RouterLink>
  </section>
</template>
