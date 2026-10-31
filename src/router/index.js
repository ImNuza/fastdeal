import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '../store/auth.js'
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
import ErrorView from '../views/ErrorView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // heroSearch: the page has its own big search bar, so the navbar one is hidden.
    { path: '/', component: HomeView, meta: { fullBleed: true, heroSearch: true } },
    { path: '/search', component: HomeView, meta: { fullBleed: true, heroSearch: true } },
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
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresRole: 'admin' } },
    { path: '/error/:code', component: ErrorView },
    // Any URL that matches nothing above shows the 404 page. Keep this last.
    { path: '/:pathMatch(.*)*', component: ErrorView }
  ],
  // A new page opens at the top. Back and forward return to where you were.
  scrollBehavior(to, from, savedPosition) {
    return savedPosition || { top: 0 }
  }
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // Wait for Firebase to resolve on page reload before checking auth state.
  if (!auth.authReady) {
    await new Promise(resolve => {
      const stop = watch(() => auth.authReady, (ready) => {
        if (ready) { stop(); resolve() }
      })
    })
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { path: '/login', query: { next: to.fullPath } }
  }

  if (to.meta.requiresRole === 'admin' && !auth.isAdmin) {
    return { path: '/error/403', query: { message: 'This page is for admins only.' }, replace: true }
  }
})

export default router
