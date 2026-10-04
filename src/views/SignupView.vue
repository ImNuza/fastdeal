<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { signup } from '../mock/session.js'

const router = useRouter()
const email = ref('')
const password = ref('')
const errorText = ref('')

function onSubmit() {
  errorText.value = signup(email.value, password.value)
  if (!errorText.value) {
    router.push('/wishlist')
  }
}
</script>

<template>
  <div class="row justify-content-center">
    <div class="col-md-6 col-lg-5">
      <h1 class="h3">Sign up</h1>
      <p class="text-secondary">Email and password. After sign up you are logged in.</p>
      <form class="card p-3" @submit.prevent="onSubmit">
        <p v-if="errorText" class="alert alert-danger">{{ errorText }}</p>
        <label class="form-label" for="email">Email</label>
        <input id="email" v-model="email" class="form-control mb-3" type="email" />
        <label class="form-label" for="password">Password</label>
        <input id="password" v-model="password" class="form-control mb-3" type="password" />
        <button class="btn btn-dark" type="submit">Create account</button>
        <p class="small mt-3 mb-0">Already have an account? <router-link to="/login">Log in</router-link></p>
      </form>
    </div>
  </div>
</template>
