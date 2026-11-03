import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuthStore } from '../store/auth.js'
import HomeView from '../views/HomeView.vue'

// Home is the landing page, so it comes with the first load. Every other page is its own file,
// downloaded only when it is opened, so the first load stays small on phones.
const CompareView = () => import('../views/CompareView.vue')
const TrendingView = () => import('../views/TrendingView.vue')
const LoginView = () => import('../views/LoginView.vue')
const SignupView = () => import('../views/SignupView.vue')
const WishlistView = () => import('../views/WishlistView.vue')
const FriendsView = () => import('../views/FriendsView.vue')
const NotificationsView = () => import('../views/NotificationsView.vue')
const AccountView = () => import('../views/AccountView.vue')
const SetUsernameView = () => import('../views/SetUsernameView.vue')
const ProductView = () => import('../views/ProductView.vue')
const AdminView = () => import('../views/AdminView.vue')
const ErrorView = () => import('../views/ErrorView.vue')

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
    { path: '/set-username', component: SetUsernameView, meta: { requiresFirebase: true } },
    { path: '/wishlist', component: WishlistView, meta: { requiresAuth: true } },
    { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresRole: 'admin' } },
    { path: '/error/:code', component: ErrorView },
    // Any URL that matches nothing above shows the 404 page. Keep this last.
    { path: '/:pathMatch(.*)*', component: ErrorView }
  ],
  // A new page opens at the top. Back and forward return to where you were.
  scrollBehavior(to, from, savedPosition) {
    // A "#section" link on the same page scrolls to that section instead of the top.
    // The section's scroll-margin-top keeps it clear of the sticky navbar.
    if (to.hash && to.path === from.path) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      return { el: to.hash, behavior: still ? 'auto' : 'smooth' }
    }
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

  // An old profile with no username must pick one before using the app.
  if (auth.user && !auth.user.username && to.path !== '/set-username') {
    return { path: '/set-username' }
  }

  // Sign-up step: signed in with Firebase, but the profile is only created once a username is chosen.
  if (to.meta.requiresFirebase && !auth.firebaseUser) {
    return { path: '/login', query: { next: to.fullPath } }
  }

  if (to.meta.requiresAuth && !auth.user) {
    return { path: '/login', query: { next: to.fullPath } }
  }

  if (to.meta.requiresRole === 'admin' && !auth.isAdmin) {
    return { path: '/error/403', query: { message: 'This page is for admins only.' }, replace: true }
  }
})

export default router
