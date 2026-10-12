import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'
import HomeView from '../views/HomeView.vue'
import CompareView from '../views/CompareView.vue'
import TrendingView from '../views/TrendingView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import ForgotPasswordView from '../views/ForgotPasswordView.vue'
import WishlistView from '../views/WishlistView.vue'
import SleepView from '../views/SleepView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: LandingView, meta: { fullBleed: true } },
    { path: '/search', component: HomeView },
    { path: '/compare', component: CompareView },
    { path: '/trending', component: TrendingView },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignupView },
    { path: '/forgot-password', component: ForgotPasswordView },
    { path: '/wishlist', component: WishlistView },
    { path: '/sleep', component: SleepView }
  ]
})

export default router
