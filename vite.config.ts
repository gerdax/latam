import { defineConfig } from "vite";
export default defineConfig({
  // Polling avoids stale modules when native filesystem events are missed.
  server: { watch: { usePolling: true, interval: 150 } },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
