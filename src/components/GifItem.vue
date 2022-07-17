<template>
  <div
    class="gif"
    :style="`background-image: url('${gif.media[0].gif.url}')`"
  ></div>
</template>

<script>
export default {
  props: ["gif"],
};
</script>

<style scoped>
.gif {
  width: 250px;
  height: 250px;
  margin-bottom: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center;
}
</style>
