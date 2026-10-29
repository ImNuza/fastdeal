<script setup>
defineEmits(['close'])
</script>

<template>
  <div class="fd-entry-backdrop" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <section class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-telegram-title">
      <h2 id="fd-telegram-title" class="fd-page-title">Set your Telegram ID</h2>
      <p class="fd-entry-description">Please set your Telegram ID first before Buy Together, so your friends can reach
        you.</p>
      <div class="fd-entry-actions">
        <router-link class="btn btn-dark" to="/account">Go to Account</router-link>
        <button class="btn btn-outline-dark" type="button" @click="$emit('close')">Close</button>
      </div>
    </section>
  </div>
</template>
