<script setup>
import proposal from '../../data/proposal.json'
import FdLogo from './FdLogo.vue'

// The proposal stores names in capitals; show them in normal case.
function displayName(name) {
  return name
    .toLowerCase()
    .split(' ')
    .map(function (part) {
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(' ')
}

const members = proposal.members.map(function (member) {
  return displayName(member.name)
})

const year = new Date().getFullYear()
</script>

<template>
  <footer class="fd-footer">
    <div class="container">
      <div class="fd-footer-grid">
        <div class="fd-footer-brand">
          <router-link to="/" class="fd-footer-logo" aria-label="FastDeal home"><FdLogo /></router-link>
          <p class="fd-footer-tagline">Know the best deal before you buy.</p>
          <p class="fd-footer-course">
            IS216 Web Application Development II<br />
            Section {{ proposal.section }} · Team {{ proposal.teamName }}
          </p>
        </div>

        <div class="fd-footer-col fd-footer-team">
          <h2 class="fd-footer-heading">The team</h2>
          <ul class="fd-footer-list fd-footer-members">
            <li v-for="name in members" :key="name">{{ name }}</li>
          </ul>
        </div>
      </div>

      <p class="fd-footer-legal">
        © {{ year }} {{ proposal.teamName }}
      </p>
    </div>
  </footer>
</template>

<style scoped>
.fd-footer {
  padding: 3.5rem 0 2rem;
  background: var(--fd-blue-dark);
  color: var(--fd-beige);
}

.fd-footer-grid {
  display: grid;
  gap: 2.5rem;
}

@media (min-width: 768px) {
  .fd-footer-grid {
    grid-template-columns: 1fr 1fr;
  }
}

.fd-footer-logo {
  display: flex;
  width: fit-content;
  /* Anton level 3, same as the navbar logo. */
  font-size: var(--fd-section-title);
  line-height: 1;
  text-decoration: none;
}

.fd-footer-tagline {
  margin: 0.75rem 0 1.25rem;
  font-size: var(--fd-body);
}

.fd-footer-course {
  margin: 0;
  color: rgb(244 237 227 / 80%);
  font-size: var(--fd-small);
  line-height: 1.6;
}

.fd-footer-heading {
  margin-bottom: 1rem;
  color: var(--fd-vanilla);
  font-family: var(--fd-font-display);
  /* Same size as section titles such as "Trending products": 24px, 28px from 768px. */
  font-size: var(--fd-section-title);
  font-weight: 400;
  line-height: 1.1;
  letter-spacing: 0.01em;
  text-transform: uppercase;
}

.fd-footer-list {
  display: grid;
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 576px) {
  .fd-footer-members {
    grid-template-columns: 1fr 1fr;
    column-gap: 1.5rem;
  }
}

.fd-footer-legal {
  margin: 3rem 0 0;
  padding-top: 1.5rem;
  border-top: var(--fd-border) solid rgb(244 237 227 / 20%);
  color: rgb(244 237 227 / 75%);
  font-size: var(--fd-small);
  text-align: center;
}
</style>
