// Usage analytics for the bridge: which tools are called, from which client, how
// long they take and whether they fail. Never what was asked or returned. Search
// queries, URLs, prompts and results are customer data, and for organisations on
// zero data retention they must not reach an analytics vendor at all.
//
// @posthog/mcp captures content by default: the tool arguments ($mcp_parameters),
// the results ($mcp_response), the agent's stated reason for the call
// ($mcp_intent) and a failed call's error text ($mcp_error_message, which echoes
// input such as "Error fetching <url>"). So events pass an allowlist in
// beforeSend: three event types, and only the properties listed below, every
// one of them a name, count, flag or version. Anything else, including whatever
// a later SDK version adds, is dropped.
// The options below also stop the SDK adding `context` and `conversation_id`
// arguments to the tool schemas the hosted server publishes, and stop its
// exception events, whose messages can carry the same error text.
// test/posthog.test.js drives real tool calls through instrument() and fails if
// a query, URL, prompt, result or error text reaches the PostHog request body.

import { instrument } from "@posthog/mcp";
import { PostHog } from "posthog-node";

export const KEPT_EVENTS = new Set(["$mcp_initialize", "$mcp_tools_list", "$mcp_tool_call"]);

export const KEPT_PROPERTIES = new Set([
  "$mcp_client_name",
  "$mcp_client_version",
  "$mcp_duration_ms",
  "$mcp_error_type",
  "$mcp_input_keys",
  "$mcp_interface",
  "$mcp_is_error",
  "$mcp_listed_tool_names",
  "$mcp_protocol_version",
  "$mcp_resource_name",
  "$mcp_server_name",
  "$mcp_server_version",
  "$mcp_source",
  "$mcp_tool_description",
  "$mcp_tool_name",
  "$geoip_disable",
  "$is_server",
  "$lib",
  "$lib_version",
  "$process_person_profile",
  "$session_id",
]);

export function dropContent(event) {
  if (!event || !KEPT_EVENTS.has(event.event)) return null;
  const properties = event.properties ?? {};
  for (const key of Object.keys(properties)) {
    if (!KEPT_PROPERTIES.has(key)) delete properties[key];
  }
  return event;
}

export const INSTRUMENT_OPTIONS = {
  context: false,
  captureModel: false,
  enableConversationId: false,
  enableExceptionAutocapture: false,
  beforeSend: dropContent,
};

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
        enableExceptionAutocapture: false,
      })
    : null;

export function instrumentServer(server, client = posthog) {
  return client ? instrument(server, client, INSTRUMENT_OPTIONS) : null;
}

if (posthog) {
  process.on("SIGTERM", async () => {
    await posthog.shutdown();
    process.exit(0);
  });
}
