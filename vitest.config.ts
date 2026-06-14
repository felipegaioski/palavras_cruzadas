import { defineConfig } from "vitest/config";

process.env.DB_PATH = "./data/test.sqlite";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
