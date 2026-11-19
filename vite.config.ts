import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      // No "npm run dev", o front chama /api/v1 no próprio endereço e o Vite repassa para o back
      // (VITE_PROXY_BACK, padrão 8080). Assim funciona em qualquer porta/endereço do front; chamando o
      // back direto (VITE_API_URL), o CORS do back só libera http://localhost:5173.
      proxy: {
        '/api/v1': { target: env.VITE_PROXY_BACK || 'http://localhost:8080', changeOrigin: true },
      },
    },
  };
});
