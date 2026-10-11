<script setup>
defineProps({
  tone: {
    type: String,
    default: 'on-dark'
  }
})
</script>

<template>
  <span class="fd-logo" :class="'fd-logo--' + tone">
    <span class="fd-logo-speed" aria-hidden="true">
      <span></span>
      <span></span>
      <span></span>
    </span>
    <span class="fd-logo-word">Fast<span class="fd-logo-deal">Deal</span></span>
  </span>
</template>

<style scoped>
.fd-logo {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  line-height: 1;
}

.fd-logo-speed {
  display: grid;
  justify-items: end;
  gap: 0.2em;
  transform: skewX(-12deg);
}

.fd-logo-speed span {
  display: block;
  height: 0.12em;
  border-radius: 999px;
  background: var(--fd-vanilla);
}

.fd-logo-speed span:nth-child(1) {
  width: 0.55em;
}

.fd-logo-speed span:nth-child(2) {
  width: 0.85em;
}

.fd-logo-speed span:nth-child(3) {
  width: 0.4em;
}

.fd-logo-word {
  display: inline-block;
  font-family: var(--fd-font-display);
  font-weight: 400;
  letter-spacing: 0.01em;
  text-transform: uppercase;
  transform: skewX(-6deg);
}

.fd-logo-deal {
  margin-left: 0.08em;
}

.fd-logo--on-dark .fd-logo-word {
  color: var(--fd-beige);
}

.fd-logo--on-dark .fd-logo-deal {
  color: var(--fd-vanilla);
}

.fd-logo--on-light .fd-logo-word,
.fd-logo--on-light .fd-logo-deal {
  color: var(--fd-blue);
}
</style>
