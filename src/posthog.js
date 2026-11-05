import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";

const projectToken = process.env.POSTHOG_PROJECT_TOKEN;
const host = process.env.POSTHOG_HOST;

if (process.env.NODE_ENV === "development") {
  if (!projectToken) {
    throw new Error(
      "POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_PROJECT_TOKEN is configured",
    );
  }
  if (!host) {
    throw new Error(
      "POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once POSTHOG_HOST is configured",
    );
  }
}

const posthog =
  projectToken && host
    ? new PostHog(projectToken, {
        host,
        enableExceptionAutocapture: true,
      })
    : null;

export function instrumentServer(server) {
  return posthog ? instrument(server, posthog, { captureModel: true }) : null;
}

if (posthog) {
  process.on("SIGTERM", async () => {
    await posthog.shutdown();
    process.exit(0);
  });
}
