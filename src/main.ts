import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

// Restore last tab
const lastTab = localStorage.getItem('ptcg-last-tab') || 'collection'
router.replace(`/${lastTab}`).catch(() => {})

app.mount('#app')

// Register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}
