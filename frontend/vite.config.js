import basicSsl from '@vitejs/plugin-basic-ssl'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// `npm run dev:phone` serves over HTTPS on the LAN: phones only allow the mic on a secure origin.
// API calls go through /api, the same path Vercel routes to the backend service.
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.HTTPS ? [basicSsl()] : [])],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000', // backend serves /api/* like it does on Vercel
    },
  },
})
