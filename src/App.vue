<template>
  <nav>
    <RouterLink to="/">Trending</RouterLink>
    <RouterLink to="/search">Search</RouterLink>
  </nav>
  <div class="wrapper">
    <RouterView />
  </div>
</template>

<style scoped>
@media (min-width: 1024px) {
  .wrapper {
    width: 1024px;
  }
}
</style>
