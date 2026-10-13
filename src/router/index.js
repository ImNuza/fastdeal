import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import CompareView from '../views/CompareView.vue'
import TrendingView from '../views/TrendingView.vue'
import LoginView from '../views/LoginView.vue'
import SignupView from '../views/SignupView.vue'
import WishlistView from '../views/WishlistView.vue'
import SleepView from '../views/SleepView.vue'
import FriendsView from '../views/FriendsView.vue'
import NotificationsView from '../views/NotificationsView.vue'
import AccountView from '../views/AccountView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView, meta: { fullBleed: true } },
    { path: '/search', component: HomeView, meta: { fullBleed: true } },
    { path: '/compare', component: CompareView },
    { path: '/trending', component: TrendingView },
    { path: '/friends', component: FriendsView },
    { path: '/notifications', component: NotificationsView },
    { path: '/account', component: AccountView },
    { path: '/login', component: LoginView },
    { path: '/signup', component: SignupView },
    { path: '/wishlist', component: WishlistView },
    { path: '/sleep', component: SleepView }
  ]
})

export default router
