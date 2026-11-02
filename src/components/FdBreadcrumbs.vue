<script setup>
// The trail above a page title: FastDeal / search / store.
// items: [{ label, to }]. Every item but the last is a link; the last is the page you are on.
defineProps({
  items: {
    type: Array,
    required: true
  }
})
</script>

<template>
  <nav class="fd-breadcrumbs" aria-label="Breadcrumb">
    <ol>
      <li v-for="(item, i) in items" :key="i">
        <router-link v-if="i < items.length - 1 && item.to" :to="item.to">{{ item.label }}</router-link>
        <span v-else aria-current="page">{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.fd-breadcrumbs ol {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin: 0 0 2.5rem;
  padding: 0;
  list-style: none;
  /* Table header type, like the Friends tabs: small bold capitals. */
  font-size: var(--fd-table-header);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* A slash between items, drawn by CSS so screen readers do not read it out. */
.fd-breadcrumbs li + li::before {
  content: '/';
  margin: 0 0.5rem;
  color: var(--fd-text-muted);
}

.fd-breadcrumbs a {
  color: var(--fd-text);
  text-decoration: none;
}

/* Hover turns it blue, like the tabs; no underline. */
.fd-breadcrumbs a:hover {
  color: var(--fd-blue);
}

/* Only the page you are on is blue and underlined. */
.fd-breadcrumbs [aria-current='page'] {
  color: var(--fd-blue);
  text-decoration: underline;
  text-underline-offset: 0.2em;
}
</style>
