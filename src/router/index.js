import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { user, authReady } from '../store/auth.js'
import HomeView from '../views/HomeView.vue'
import CompareView from '../views/CompareView.vue'
import TrendingView from '../views/TrendingView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import WishlistView from '../views/WishlistView.vue'
import FriendsView from '../views/FriendsView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import AccountView from '../views/AccountView.vue'
import SetUsernameView from '../views/SetUsernameView.vue'
import ProductView from '../views/ProductView.vue'
import AdminView from '../views/AdminView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView, meta: { fullBleed: true } },
    { path: '/search', component: HomeView, meta: { fullBleed: true } },
    { path: '/compare', component: CompareView },
    { path: '/product/:productId', component: ProductView },
    { path: '/trending', component: TrendingView },
    { path: '/friends', component: FriendsView, meta: { requiresAuth: true } },
    { path: '/notifications', component: NotificationsView, meta: { requiresAuth: true } },
    { path: '/account', component: AccountView, meta: { requiresAuth: true } },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignupView },
    { path: '/set-username', component: SetUsernameView, meta: { requiresAuth: true } },
    { path: '/wishlist', component: WishlistView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresRole: 'admin' } }
  ],
  // A new page opens at the top. Back and forward return to where you were.
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

router.beforeEach(async (to) => {
  // Wait for Firebase to resolve on page reload before checking auth state.
  if (!authReady.value) {
    await new Promise(resolve => {
      const stop = watch(authReady, (ready) => {
        if (ready) { stop(); resolve() }
      })
    })
  }

  if (to.meta.requiresAuth && !user.value) {
    return { path: '/login', query: { next: to.fullPath } }
  }

  if (to.meta.requiresRole === 'admin' && user.value?.role !== 'admin') {
    alert('Access denied. Admins only.')
    return false
  }
})

export default router
