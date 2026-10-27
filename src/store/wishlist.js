import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

export const useWishlistStore = defineStore('wishlist', () => {
  // state
  const friendOverlap = ref({})
  const buyItem = ref(null)
  const selected = ref([])
  const inviting = ref(false)
  const inviteSent = ref(false)
  const error = ref('')

  // actions
  async function fetchFriendOverlap() {
    try {
      const res = await axios.get('/api/wishlist/friends')
      friendOverlap.value = res.data
    } catch (err) {
      friendOverlap.value = {}
    }
  }

  function friendsFor(productKey) {
    return friendOverlap.value[productKey] || []
  }

  function allInvited(productKey) {
    const friends = friendsFor(productKey)
    return friends.length > 0 && friends.every(function (f) { return f.invited })
  }

  function openBuyTogether(item) {
    buyItem.value = item
    selected.value = friendsFor(item.productKey)
      .filter(function (f) { return !f.invited })
      .map(function (f) { return f.firebaseUid })
    inviteSent.value = false
    error.value = ''
  }

  function closeBuyTogether() {
    buyItem.value = null
  }

  async function sendInvites() {
    if (!buyItem.value || !selected.value.length) return
    inviting.value = true
    error.value = ''
    try {
      await axios.post('/api/buy-together/invite', {
        friendUids: selected.value,
        productKey: buyItem.value.productKey
      })
      inviteSent.value = true
      await fetchFriendOverlap()
    } catch (err) {
      error.value = err.response?.data?.error || 'Could not send invites. Try again.'
    } finally {
      inviting.value = false
    }
  }

  return {
    friendOverlap, buyItem, selected, inviting, inviteSent, error,
    fetchFriendOverlap, friendsFor, allInvited, openBuyTogether, closeBuyTogether, sendInvites
  }
})
