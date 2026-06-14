import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "on-first-retry"
  },
  webServer: {
    command:
      "npm run build && set PORT=3010&& set DB_PATH=./data/e2e.sqlite&& npm start",
    url: "http://127.0.0.1:3010",
    reuseExistingServer: true,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
