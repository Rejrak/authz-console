import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { proxy: Object.fromEntries([
    ['/alpha-rpc', 'ALPHA_RPC_PROXY_TARGET', 'http://127.0.0.1:26657'],
    ['/alpha-rest', 'ALPHA_REST_PROXY_TARGET', 'http://127.0.0.1:1317'],
    ['/api', 'MIDDLEWARE_API_PROXY_TARGET', 'https://127.0.0.1:8080'],
  ].map(([path, key, fallback]) => [path, { target: loadEnv(mode, process.cwd(), '')[key] || fallback, changeOrigin: true, secure: false, rewrite: (url: string) => path === '/api' ? url : url.replace(new RegExp(`^${path}`), '') || '/' }])) },
}))
