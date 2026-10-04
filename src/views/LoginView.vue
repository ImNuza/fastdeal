<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { login } from '../mock/session.js'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const errorText = ref('')

function goNext() {
  const next = route.query.next
  if (typeof next === 'string' && next.indexOf('/') === 0) {
    router.push(next)
    return
  }
  router.push('/')
}

function onSubmit() {
  errorText.value = login(email.value, password.value)
  if (!errorText.value) {
    goNext()
  }
}

function useDemo() {
  email.value = 'demo@smu.edu.sg'
  password.value = 'demo1234'
  onSubmit()
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="h3">Log in</h1>
      <p class="text-secondary">Search works without an account. Save, alerts, and Sleep on it need a login.</p>
      <form class="card p-3" @submit.prevent="onSubmit">
        <p v-if="errorText" class="alert alert-danger">{{ errorText }}</p>
        <label class="form-label" for="email">Email</label>
        <input id="email" v-model="email" class="form-control mb-3" type="email" />
        <label class="form-label" for="password">Password</label>
        <input id="password" v-model="password" class="form-control mb-3" type="password" />
        <button class="btn btn-dark" type="submit">Log in</button>
        <button class="btn btn-outline-dark mt-2" type="button" @click="useDemo">Use demo account</button>
        <p class="small text-secondary mt-3 mb-0">Demo: demo@smu.edu.sg / demo1234</p>
        <p class="small mt-2 mb-0">No account? <router-link to="/signup">Sign up</router-link></p>
      </form>
    </div>
  </div>
</template>
