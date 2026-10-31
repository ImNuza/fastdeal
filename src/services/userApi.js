import axios from 'axios'

// The server reads who I am from the login token (see http.js), so no uid is sent.

// Create or return my MongoDB user after Firebase signup/login.
// Pass username only on first email signup; Google users set it via /set-username.
export async function createOrGetUser(username) {
  const body = {}
  if (username) body.username = username
  const { data } = await axios.post('/api/users', body)
  return data
}

// Get my profile from MongoDB.
export async function getUser() {
  const { data } = await axios.get('/api/users/me')
  return data
}

// Patch my profile. Allowed fields: emailAlertsOn, username, telegramUsername.
export async function updateUser(patch) {
  const { data } = await axios.put('/api/users/me', patch)
  return data
}

// Username login: Firebase signs in with an email, so the server returns the email,
// but only when the password is right.
export async function loginEmail(username, password) {
  const { data } = await axios.post('/api/users/login-email', { username, password })
  return data.email
}

// Plan a budget drafts. Each call returns my full list of drafts, newest first.
export async function createBudget(draft) {
  const { data } = await axios.post('/api/users/me/budgets', draft)
  return data
}

export async function updateBudget(id, draft) {
  const { data } = await axios.put('/api/users/me/budgets/' + encodeURIComponent(id), draft)
  return data
}

export async function deleteBudget(id) {
  const { data } = await axios.delete('/api/users/me/budgets/' + encodeURIComponent(id))
  return data
}
