<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import FdError from '../components/FdError.vue'
import { errorInfo } from '../services/errors.js'

const route = useRoute()

// /error/403 shows that code. A catch-all route (unknown URL) has no code, so it is a 404.
// ?message=... replaces the default text. The list of codes is in services/errors.js.
const info = computed(() => errorInfo(route.params.code || 404))
</script>

<template>
  <FdError
    :code="info.label"
    :title="info.title"
    :message="route.query.message || info.message"
    :retry="!!info.retry"
  />
</template>
