
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode`. The third parameter '' loads all variables.
  const env = loadEnv(mode, process.cwd(), '');
  
  // In production (Vercel), environment variables are in process.env
  // In local development, they might be in the .env file (env)
  const apiKey = env.API_KEY || env.VITE_API_KEY || process.env.API_KEY || "";

  return {
    plugins: [react()],
    define: {
      // Replaces all occurrences of process.env.API_KEY in the source code
      'process.env.API_KEY': JSON.stringify(apiKey)
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 1600
    }
  };
});
