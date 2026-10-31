import { logger, task } from "@trigger.dev/sdk";

/**
 * Smoke test: run it from the Trigger.dev dashboard ("Test" tab) to confirm the
 * worker is connected. Needs no API keys.
 */
export const healthCheck = task({
  id: "health-check",
  maxDuration: 30,
  run: async (payload: { note?: string } = {}) => {
    logger.info("Trigger.dev worker is running", { note: payload.note ?? null });
    return { ok: true, at: new Date().toISOString(), node: process.version };
  },
});
