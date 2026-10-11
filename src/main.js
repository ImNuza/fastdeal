import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { initSession } from './mock/session.js'
import './assets/tokens.css'
import './assets/app.css'

initSession()
createApp(App).use(router).mount('#app')
