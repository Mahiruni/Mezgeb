import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["tests/**/*.test.ts","src/lib/app-update.test.ts","src/lib/export-file.test.ts"], environment: "node" } });
