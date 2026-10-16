<template>
  <div class="max-w-[1280px] font-normal mx-auto p-8 max-w-screen-lg mx-auto">
    <header>
      <nav
        class="w-full text-[12px] text-center mt-4 max-w-[1280px] mx-auto lg:text-left lg:-ml-4 lg:text-base lg:py-4"
      >
        <RouterLink
          :to="{ name: 'trends' }"
          class="inline-block px-4 no-underline text-text transition-colors hover:bg-[hsla(160,100%,37%,0.2)]"
          exact-active-class="font-semibold !text-[hsl(160,100%,37%)]"
        >
          Trending
        </RouterLink>
        <RouterLink
          :to="{ name: 'search' }"
          class="inline-block px-4 no-underline text-text transition-colors hover:bg-[hsla(160,100%,37%,0.2)] border-l border-dividerDark2"
          exact-active-class="font-semibold border-l border-dividerDark2 !text-[hsl(160,100%,37%)]"
        >
          Search
        </RouterLink>
      </nav>
    </header>

    <main class="mt-2">
      <RouterView />
    </main>

    <footer class="mt-8 text-center text-[12px] opacity-70">
      <a href="https://giphy.com" target="_blank" rel="noopener noreferrer">Powered by GIPHY</a>
    </footer>
  </div>
</template>
