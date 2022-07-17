<template>
  <div
    class="gif"
    :style="`background-image: url('${gif.media[0].gif.url}')`"
  ></div>
</template>

<script>
export default {
  props: ["gif", "observer"],
  mounted() {
    if (this.observer) this.observer.observe(this.$el);
  },
};
</script>

<style scoped>
.gif {
  width: 200px;
  height: 200px;
  margin-bottom: 0.5rem;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}

@media screen and (min-width: 756px) {
  .gif {
    width: 250px;
    height: 250px;
  }
}
</style>
