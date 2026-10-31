import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Your Trigger.dev project ref ("proj_..."), from the project's Settings page.
  project: process.env.TRIGGER_PROJECT_REF ?? "proj_REPLACE_ME",
  dirs: ["./src/trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 4, minTimeoutInMs: 2000, maxTimeoutInMs: 60000, factor: 2, randomize: true },
  },
});
