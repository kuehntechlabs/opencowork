import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/postcss";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: "src/main/index.ts" },
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
        input: {
          main: "src/renderer/index.html",
        },
      },
    },
    css: {
      postcss: {
        plugins: [tailwindcss()],
      },
    },
  },
});
