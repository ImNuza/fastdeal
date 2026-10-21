import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './services/http.js'
import './assets/tokens.css'
import './assets/app.css'

createApp(App).use(router).mount('#app')
