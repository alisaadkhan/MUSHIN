import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180000,
  use: {
    baseURL: "http://localhost:8080",
    viewport: { width: 1920, height: 1080 },
    video: "on",
    screenshot: "on"
  },
});
