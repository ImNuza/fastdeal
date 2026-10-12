import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'
import { auth } from '../firebase.js'

const googleProvider = new GoogleAuthProvider()

// Sign in with Google popup
export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  return result.user
}

// Sign in with email and password
export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password)
  return result.user
}

// Create account with email and password
export async function signUpWithEmail(email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password)
  return result.user
}

// Send password reset email
export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email)
}

// Sign out
export async function signOutUser() {
  await signOut(auth)
}

// Listen to auth state changes — call onAuthStateChanged and pass a callback
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
