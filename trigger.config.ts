import { defineConfig } from "@trigger.dev/sdk";

export default defineConfig({
  // Trigger.dev project: "intern work log"
  project: "proj_bfkwygwdmfnvglbcuzho",
  dirs: ["./src/trigger"],
  runtime: "node",
  logLevel: "info",
  maxDuration: 300,
  retries: {
    enabledInDev: false,
    default: { maxAttempts: 4, minTimeoutInMs: 2000, maxTimeoutInMs: 60000, factor: 2, randomize: true },
  },
});
