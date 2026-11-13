import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    // Let HMR use whatever port/protocol the browser connects on.
    // Setting clientPort: 443 breaks HMR when accessed over non-443 tunnels.
    hmr: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        // Suppress ECONNRESET noise — these are normal when the backend
        // briefly drops or restarts; the client reconnects automatically.
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            if (
              err.message.includes('ECONNRESET') ||
              err.message.includes('ECONNREFUSED')
            ) {
              // swallow — client-side socket.io will auto-reconnect
              return;
            }
            console.error('[socket.io proxy error]', err.message);
          });
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, _res) => {
            if (
              err.message.includes('ECONNRESET') ||
              err.message.includes('ECONNREFUSED')
            ) {
              return;
            }
            console.error('[socket.io proxy error]', err.message);
          });
        },
      },
    },
  },
});
