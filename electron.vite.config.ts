import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import arabicLocale from './src/renderer/src/i18n/locales/ar.json'

const appName = arabicLocale.app.subtitle

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src')
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'app-html-title',
        transformIndexHtml(html) {
          return html.replace('%APP_NAME%', appName)
        }
      }
    ]
  }
})
