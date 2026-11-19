import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // O back ainda não libera CORS: no "npm run dev", o front chama /api/v1 no próprio endereço
      // e o Vite repassa para o back. O endereço do back vem de VITE_PROXY_BACK (padrão: 8080).
      proxy: {
        '/api/v1': { target: env.VITE_PROXY_BACK || 'http://localhost:8080', changeOrigin: true },
      },
    },
  };
});
