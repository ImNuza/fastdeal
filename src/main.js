import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useErrorStore } from './store/error.js'
import './services/http.js'
import { imgLoading } from './services/imgLoading.js'
import './assets/tokens.css'
import './assets/app.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
// Product photos shimmer while they load (src/services/imgLoading.js).
app.directive('img-loading', imgLoading)

// A bug that crashes a page shows the error page instead of a blank screen.
app.config.errorHandler = function (err) {
  console.error(err)
  useErrorStore().showError(500)
}

app.mount('#app')
