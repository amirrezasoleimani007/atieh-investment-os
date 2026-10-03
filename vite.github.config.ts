import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import path from "node:path";

const base = "/atieh-investment-os/";

export default defineConfig({
  base,
  root: "github-pages",
  publicDir: path.resolve(__dirname, "public"),
  plugins: [
    react(),
    {
      name: "github-pages-font-paths",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("app/globals.css")) return null;
        return code.replaceAll("url('/fonts/", `url('${base}fonts/`);
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "next/image": path.resolve(__dirname, "github-pages/image.tsx"),
    },
  },
  build: {
    outDir: "../github-pages-dist",
    emptyOutDir: true,
    sourcemap: false,
  },
});
