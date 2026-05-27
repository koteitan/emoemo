import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Content-Security-Policy injected into index.html for production builds only
// (dev is skipped so Vite HMR's inline scripts keep working).
//   img-src https: data:  -> emoji/avatar images from any https host
//   connect-src wss: https: -> rx-nostr relays (wss) and nostr.build upload (https)
//   script-src 'self'     -> only our bundled JS
//   style-src 'unsafe-inline' -> React inline style attributes
const CSP = [
  "default-src 'self'",
  "img-src 'self' data: https:",
  "connect-src 'self' wss: https:",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// Published at https://koteitan.github.io/emoemo/
export default defineConfig({
  base: '/emoemo/',
  plugins: [react(), cspMeta()],
  // Bind to 0.0.0.0 so the WSL2 dev server is reachable from the Windows browser.
  server: { host: true },
});
