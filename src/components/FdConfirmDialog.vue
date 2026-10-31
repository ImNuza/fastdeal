<script setup>
// One confirm pop-up for every "are you sure" step: removing a friend, a wishlist item or a
// saved budget. Same look as the Admin role pop-up and the welcome prompt (dialog styles in app.css).
// The parent shows it with v-if and handles confirm (do the action) and cancel (close it).
import { ref, onMounted } from 'vue'

defineProps({
  title: { type: String, required: true },
  confirmLabel: { type: String, default: 'Confirm' },
  danger: { type: Boolean, default: false },
  busy: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
defineEmits(['confirm', 'cancel'])

// Focus Cancel when the pop-up opens, so Esc works at once and Enter does not delete by accident.
const cancelButton = ref(null)
onMounted(function () {
  if (cancelButton.value) cancelButton.value.focus()
})
</script>

<template>
  <div class="fd-entry-backdrop" @click.self="$emit('cancel')" @keydown.esc="$emit('cancel')">
    <section class="fd-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="fd-confirm-title">
      <h2 id="fd-confirm-title" class="fd-page-title">{{ title }}</h2>
      <p class="fd-entry-description">
        <slot />
      </p>

      <p v-if="error" class="alert alert-danger" role="alert">{{ error }}</p>

      <div class="fd-entry-actions">
        <button class="btn" :class="danger ? 'btn-danger' : 'btn-dark'" type="button" :disabled="busy"
          @click="$emit('confirm')">
          {{ busy ? 'Working…' : confirmLabel }}
        </button>
        <button ref="cancelButton" class="btn btn-outline-dark" type="button" :disabled="busy"
          @click="$emit('cancel')">Cancel</button>
      </div>
    </section>
  </div>
</template>
