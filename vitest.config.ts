import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      './src/**/*.{test,spec}.{ts,tsx}',
    ],
    globals: true,
    environment: "jsdom",
    setupFiles: [
      //    './src/test/setup.ts'
    ],
    coverage: {
      reporter: ["text", "json", "html"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
