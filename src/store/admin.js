import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useAdminStore = defineStore('admin', () => {
  // state
  const stats = ref(null)
  const users = ref([])
  const loading = ref(false)
  const error = ref(null)

  // actions
  async function fetchStats() {
    loading.value = true
    error.value = null
    try {
      const res = await axios.get('/api/admin/stats')
      stats.value = res.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Could not load stats.'
    } finally {
      loading.value = false
    }
  }

  async function fetchUsers() {
    loading.value = true
    error.value = null
    try {
      const res = await axios.get('/api/admin/users')
      users.value = res.data
    } catch (err) {
      error.value = err.response?.data?.error || 'Could not load users.'
    } finally {
      loading.value = false
    }
  }

  async function updateRole(firebaseUid, role) {
    const res = await axios.put(`/api/admin/users/${firebaseUid}/role`, { role })
    const u = users.value.find(function (u) { return u.firebaseUid === firebaseUid })
    if (u) u.role = res.data.role
  }

  return { stats, users, loading, error, fetchStats, fetchUsers, updateRole }
})
