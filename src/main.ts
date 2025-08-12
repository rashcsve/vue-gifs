// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './assets/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', err, info, instance)
}
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[Vue Warn]', msg, trace, instance)
}

app.mount('#app')
