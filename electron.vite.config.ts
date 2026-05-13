import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        // Two entries: `index` is the Electron main process; `sidecar` is
        // forked via utilityProcess.fork() and hosts the opencode HTTP server.
        input: {
          index: "src/main/index.ts",
          sidecar: "src/main/sidecar.ts",
        },
        output: {
          chunkFileNames: "chunks/[name]-[hash].js",
          assetFileNames: "chunks/[name]-[hash][extname]",
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: "src/preload/index.ts" },
        output: {
          format: "cjs",
          entryFileNames: "[name].cjs",
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
    root: "src/renderer",
    build: {
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
  },
});
