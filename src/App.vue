<script setup>
import { useRouter } from 'vue-router'
import { user, logout } from './mock/session.js'

const router = useRouter()

function onLogout() {
  logout()
  router.push('/')
}
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark fd-nav">
    <div class="container">
      <router-link class="navbar-brand" to="/">FastDeal</router-link>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#fdNav">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="fdNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <router-link class="nav-link" to="/" exact-active-class="active">Search</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/trending" exact-active-class="active">Trending</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/wishlist" exact-active-class="active">Wishlist</router-link>
          </li>
          <li class="nav-item">
            <router-link class="nav-link" to="/sleep" exact-active-class="active">Sleep</router-link>
          </li>
        </ul>
        <div class="d-flex align-items-center gap-2 py-2 py-lg-0">
          <span v-if="user" class="text-white-50 small">{{ user.email }}</span>
          <router-link v-if="!user" class="btn btn-sm btn-outline-light" to="/login">Log in</router-link>
          <button v-else class="btn btn-sm btn-outline-light" type="button" @click="onLogout">Log out</button>
        </div>
      </div>
    </div>
  </nav>
  <main class="container py-4">
    <router-view :key="$route.fullPath" />
  </main>
</template>
