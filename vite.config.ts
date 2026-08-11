import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: {
    port: 4180,
    strictPort: true,
  },
  preview: {
    port: 4181,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/examples/jsm/')) return 'three-addons';
          if (id.includes('/node_modules/three/')) return 'three';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
  },
});
