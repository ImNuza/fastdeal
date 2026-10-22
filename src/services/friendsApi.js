import axios from 'axios'

// The server reads who I am from the login token (see http.js), so no uid is sent.

// Returns all my accepted friends, with their username and email.
export async function getFriends() {
  const { data } = await axios.get('/api/friends')
  return data
}

// Returns incoming pending friend requests (other users who sent a request TO me).
export async function getIncomingRequests() {
  const { data } = await axios.get('/api/friends/requests')
  return data
}

// Search for users by username (partial match). Each result includes the
// friendship status between that user and me so the UI knows which button to show.
export async function searchUsers(q) {
  const { data } = await axios.get('/api/users/search', { params: { q } })
  return data
}

// Send a friend request to addresseeUid. Creates a pending friendship row.
export async function sendRequest(addresseeUid) {
  const { data } = await axios.post('/api/friends/request', { addresseeUid })
  return data
}

// Accept an incoming request identified by pairKey. Changes status to 'accepted'.
export async function acceptRequest(pairKey) {
  const { data } = await axios.put(`/api/friends/${pairKey}/accept`)
  return data
}

// Decline a pending request OR remove an existing friendship. Both just delete the row.
export async function declineOrRemove(pairKey) {
  const { data } = await axios.delete(`/api/friends/${pairKey}`)
  return data
}
