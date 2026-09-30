import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Keep the bundle inspectable — Checkpoint 3 greps the built output for secrets.
    sourcemap: false,
  },
});
