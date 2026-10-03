import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Trimmed from the Figma Make export: the Figma-specific preview plugins and
// .figma/make/site.json dependency were dropped so it builds standalone.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Same-origin API calls in dev; no CORS needed. Override with VITE_API_PROXY.
  server: {
    proxy: Object.fromEntries(
      ['/prices', '/recipes', '/inventory', '/specials'].map((prefix) => [
        prefix,
        process.env.VITE_API_PROXY ?? 'http://127.0.0.1:8000',
      ]),
    ),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
