import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  root: ".",
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        login: resolve(__dirname, "pages/login.html"),
        register: resolve(__dirname, "pages/register.html"),
        dashboard: resolve(__dirname, "pages/dashboard.html"),
        errand: resolve(__dirname, "pages/errand-request.html"),
      },
    },
    outDir: "dist",
  },
  server: {
    port: 5173,
    open: true,
  },
});
