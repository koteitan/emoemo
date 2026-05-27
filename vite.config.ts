import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Published at https://koteitan.github.io/emoemo/
export default defineConfig({
  base: '/emoemo/',
  plugins: [react()],
  // Bind to 0.0.0.0 so the WSL2 dev server is reachable from the Windows browser.
  server: { host: true },
});
