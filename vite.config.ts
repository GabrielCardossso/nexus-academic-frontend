import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      // O CORS do back só libera http://localhost:5173, e o navegador manda essa origem também pelo
      // proxy: em outra porta, cadastrar/editar/excluir dá 403. Por isso a porta é fixa (strictPort).
      port: 5173,
      strictPort: true,
      // No "npm run dev", o front chama /api/v1 no próprio endereço e o Vite repassa para o back
      // (VITE_PROXY_BACK, padrão 8080).
      proxy: {
        '/api/v1': { target: env.VITE_PROXY_BACK || 'http://localhost:8080', changeOrigin: true },
      },
    },
  };
});
