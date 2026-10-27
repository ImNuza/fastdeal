<script setup>
import { onMounted } from 'vue'
import { useAdminStore } from '../store/admin.js'
import { useAuthStore } from '../store/auth.js'
import { storeToRefs } from 'pinia'

const adminStore = useAdminStore()
const { stats, users, loading, error } = storeToRefs(adminStore)
const { fetchStats, fetchUsers, updateRole } = adminStore

const auth = useAuthStore()

onMounted(async () => {
  await Promise.all([fetchStats(), fetchUsers()])
})

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}

async function onRoleChange(firebaseUid, newRole) {
  try {
    await updateRole(firebaseUid, newRole)
  } catch (err) {
    alert(err.response?.data?.error || 'Could not update role.')
  }
}
</script>

<template>
  <div>
    <h1 class="fd-page-title">Admin Dashboard</h1>
    <p class="fd-page-subtitle">Manage FastDeal users and monitor platform activity.</p>

    <div v-if="loading && !stats" class="text-secondary">Loading…</div>
    <div v-if="error" class="alert alert-danger">{{ error }}</div>

    <!-- Stat cards -->
    <div v-if="stats" class="row g-3 mb-5">
      <div class="col-6 col-md-3">
        <div class="card h-100 p-3 text-center">
          <p class="text-secondary small mb-1">Total Users</p>
          <p class="mb-0" style="font-family: var(--fd-font-display); font-size: var(--fd-page-title); color: var(--fd-blue);">{{ stats.totalUsers }}</p>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100 p-3 text-center">
          <p class="text-secondary small mb-1">Wishlist Items</p>
          <p class="mb-0" style="font-family: var(--fd-font-display); font-size: var(--fd-page-title); color: var(--fd-blue);">{{ stats.totalWishlistItems }}</p>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100 p-3 text-center">
          <p class="text-secondary small mb-1">Active This Week</p>
          <p class="mb-0" style="font-family: var(--fd-font-display); font-size: var(--fd-page-title); color: var(--fd-blue);">{{ stats.activeThisWeek }}</p>
        </div>
      </div>
      <div class="col-6 col-md-3">
        <div class="card h-100 p-3">
          <p class="text-secondary small mb-2">Top Saved Products</p>
          <ol class="mb-0 ps-3" style="font-size: var(--fd-small);">
            <li v-for="p in stats.topProducts" :key="p.name" class="mb-1">
              <span class="fw-semibold">{{ p.name }}</span>
              <span class="text-secondary"> · {{ p.count }}</span>
            </li>
          </ol>
        </div>
      </div>
    </div>

    <!-- Manage users -->
    <h2 class="fd-section-title">Manage Users</h2>
    <div class="row g-3">
      <div class="col-12 col-md-6 col-lg-4" v-for="u in users" :key="u.firebaseUid">
        <div class="card p-3 h-100">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <p class="fw-bold mb-0" style="font-family: var(--fd-font-display); letter-spacing: 0.04em;">
                {{ u.username ? u.username.toUpperCase() : '(no username)' }}
              </p>
              <p class="small text-secondary mb-0">{{ u.email }}</p>
            </div>
            <span class="badge" :class="u.role === 'admin' ? 'bg-dark' : 'bg-secondary'">
              {{ u.role }}
            </span>
          </div>

          <div class="d-flex gap-3 small text-secondary mb-3">
            <span>{{ u.wishlistCount }} saved</span>
            <span>Joined {{ formatDate(u.createdAt) }}</span>
          </div>

          <div class="d-flex gap-2 mt-auto" v-if="u.firebaseUid !== auth.user?.uid">
            <button
              v-if="u.role !== 'admin'"
              class="btn btn-sm btn-dark"
              type="button"
              @click="onRoleChange(u.firebaseUid, 'admin')"
            >Promote</button>
            <button
              v-if="u.role === 'admin'"
              class="btn btn-sm btn-outline-dark"
              type="button"
              @click="onRoleChange(u.firebaseUid, 'user')"
            >Demote</button>
          </div>
          <p v-else class="small text-secondary mt-auto mb-0">You</p>
        </div>
      </div>
    </div>
  </div>
</template>
