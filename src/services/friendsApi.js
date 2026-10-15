import axios from 'axios'

// Returns all accepted friends for myUid, with their username and email.
export async function getFriends(myUid) {
  const { data } = await axios.get('/api/friends', { params: { myUid } })
  return data
}

// Returns incoming pending friend requests (other users who sent a request TO me).
export async function getIncomingRequests(myUid) {
  const { data } = await axios.get('/api/friends/requests', { params: { myUid } })
  return data
}

// Search for users by username (partial match). Each result includes the
// friendship status between that user and myUid so the UI knows which button to show.
export async function searchUsers(q, myUid) {
  const { data } = await axios.get('/api/users/search', { params: { q, myUid } })
  return data
}

// Send a friend request from myUid to addresseeUid. Creates a pending friendship row.
export async function sendRequest(myUid, addresseeUid) {
  const { data } = await axios.post('/api/friends/request', { myUid, addresseeUid })
  return data
}

// Accept an incoming request identified by pairKey. Changes status to 'accepted'.
export async function acceptRequest(pairKey, myUid) {
  const { data } = await axios.put(`/api/friends/${pairKey}/accept`, { myUid })
  return data
}

// Decline a pending request OR remove an existing friendship — both just delete the row.
export async function declineOrRemove(pairKey, myUid) {
  const { data } = await axios.delete(`/api/friends/${pairKey}`, { data: { myUid } })
  return data
}
