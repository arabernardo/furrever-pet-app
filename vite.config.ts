import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { resolve } from 'node:path';
import process from "node:process";
import { fileURLToPath } from "node:url";

// __dirname is not available in ES modules; derive it from import.meta.url
const __dirname = fileURLToPath(new URL(".", import.meta.url));
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [vue()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    // Two pages: the pet window and the settings window
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
}));
