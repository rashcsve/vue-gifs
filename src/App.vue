<script setup lang="ts">
import { ref } from 'vue'
import { RouteName } from '@/router/names'

const mainEl = ref<HTMLElement | null>(null)

/**
 * Focus main directly: a plain #main jump would go through vue-router (popstate),
 * add #main to the URL and be scrolled back to the top by scrollBehavior.
 */
const skipToMain = () => mainEl.value?.focus()
</script>

<template>
  <div class="max-w-screen-lg mx-auto p-8 font-normal">
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-10 focus:px-4 focus:py-2 focus:bg-(--color-background)"
      @click.prevent="skipToMain"
    >
      Skip to content
    </a>

    <header>
      <nav class="w-full text-[12px] text-center mt-4 lg:text-left lg:-ml-4 lg:text-base lg:py-4">
        <RouterLink
          :to="{ name: RouteName.Trends }"
          class="inline-block px-4 no-underline transition-colors hover:bg-[hsla(160,100%,37%,0.2)]"
          exact-active-class="font-semibold text-(--color-accent)!"
        >
          Trending
        </RouterLink>
        <RouterLink
          :to="{ name: RouteName.Search }"
          class="inline-block px-4 no-underline transition-colors hover:bg-[hsla(160,100%,37%,0.2)] border-l border-(--color-border)"
          exact-active-class="font-semibold text-(--color-accent)!"
        >
          Search
        </RouterLink>
      </nav>
    </header>

    <!-- tabindex="-1": the skip link can focus it; no ring, since it's not interactive -->
    <main id="main" ref="mainEl" tabindex="-1" class="mt-2 outline-none">
      <RouterView />
    </main>

    <footer class="mt-8 text-center text-[12px] text-(--color-text-muted)">
      <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Powered by GIPHY</a>
    </footer>
  </div>
</template>
