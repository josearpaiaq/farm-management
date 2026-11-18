import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    plugins: [
      react(),
      tailwindcss(),
      // Installable app (Android "Install app", iOS "Add to Home Screen").
      // The service worker only precaches the built app shell; API calls
      // always go to the network.
      VitePWA({
        registerType: "autoUpdate",
        manifest: {
          name: "Gestión de fincas",
          short_name: "Fincas",
          description: "Registro del hato: animales, pesos, salud y fincas.",
          lang: "es",
          start_url: "/",
          display: "standalone",
          background_color: "#fdf6ec",
          theme_color: "#7c9070",
          icons: [
            { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
            { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Client-side routes fall back to index.html, but never /api/*
          // (Swagger, file downloads) which the server must answer.
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    // Same-origin API in dev so the refresh token cookie (sameSite=strict,
    // path /api/v1/auth) just works. If your API listens on a non-default
    // port, set API_PROXY_TARGET in a local web/.env (gitignored).
    server: {
      proxy: {
        "/api": env.API_PROXY_TARGET || "http://localhost:3000",
      },
    },
    // Unit/component tests: jsdom + Testing Library, API mocked with MSW
    // (see src/test/setup.ts).
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
