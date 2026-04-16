import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    screenshot: "on",
  },
  projects: [
    {
      name: "setup",
      testMatch: "**/local.setup.ts",
    },
    {
      name: "chromium",
      use: { 
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/local_state.json",
      },
      dependencies: ["setup"],
      testIgnore: "**/local.setup.ts",
    },
  ],
});
