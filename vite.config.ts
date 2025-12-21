import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import process from 'node:process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // We pass '' as the third argument to load all env variables regardless of prefix
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Shims process.env.API_KEY so the existing code works without modification.
      // Prioritize system environment (Vercel) over local .env files.
      'process.env.API_KEY': JSON.stringify(env.API_KEY || env.VITE_API_KEY)
    },
    // Ensure build is optimized for production
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});
