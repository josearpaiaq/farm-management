import {
  defineConfig,
  minimal2023Preset,
} from "@vite-pwa/assets-generator/config";

// App icons generated from public/logo.svg: pnpm generate-pwa-assets
// Maskable and Apple icons are padded, so fill the padding with the brand
// green instead of the default white.
const background = "#7c9070";

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background } },
  },
  images: ["public/logo.svg"],
});
