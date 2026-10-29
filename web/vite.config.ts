import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  return {
    plugins: [react(), tailwindcss()],
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
