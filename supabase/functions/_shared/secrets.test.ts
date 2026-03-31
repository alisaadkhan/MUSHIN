import { assertNoSecretsInRequestBody } from "./secrets.ts";

Deno.test("assertNoSecretsInRequestBody allows safe payload", () => {
  const payload = {
    workspace_id: "ws_123",
    query: "pakistani creators",
    filters: { platform: "instagram", min_followers: 1000 },
  };

  assertNoSecretsInRequestBody(payload, "test-safe-payload");
});

Deno.test("assertNoSecretsInRequestBody blocks secret-like fields", () => {
  const payload = {
    workspace_id: "ws_123",
    credentials: {
      apiKey: "should-not-be-sent",
    },
  };

  let threw = false;
  try {
    assertNoSecretsInRequestBody(payload, "test-secret-payload");
  } catch (err) {
    threw = err instanceof Error && err.message.includes("Secrets must not be provided in request body");
  }

  if (!threw) {
    throw new Error("Expected assertNoSecretsInRequestBody to reject secret-like keys");
  }
});
