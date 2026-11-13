import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`             → client classique servi par le serveur Node (client/dist)
// `npm run build:standalone`  → un seul fichier HTML autonome (mode local jouable sans serveur)
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'standalone' ? [viteSingleFile()] : [])],
  build: { outDir: mode === 'standalone' ? 'dist-standalone' : 'dist' },
  server: {
    fs: { allow: ['..'] }, // autorise l'import de ../shared
    proxy: { '/socket.io': { target: 'http://localhost:3001', ws: true } },
  },
}));
