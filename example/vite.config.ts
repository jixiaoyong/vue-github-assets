import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@jixiaoyong/vue-github-assets': path.resolve(__dirname, '../src/index.ts'),
      '@': path.resolve(__dirname, '../src')
    }
  }
})
