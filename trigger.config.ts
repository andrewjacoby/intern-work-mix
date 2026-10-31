import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Trigger.dev project: Good Shepherd intern work mix
  project: "proj_nvccfhuargvsmamwgpdl",
  dirs: ["./src/trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 4, minTimeoutInMs: 2000, maxTimeoutInMs: 60000, factor: 2, randomize: true },
  },
});
