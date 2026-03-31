import { tooManyRequests } from "./rate_limit.ts";

Deno.test("tooManyRequests returns 429 with Retry-After", async () => {
  const response = tooManyRequests(17, { "Access-Control-Allow-Origin": "https://mushin.app" });

  if (response.status !== 429) {
    throw new Error(`Expected status 429, got ${response.status}`);
  }

  const retryAfter = response.headers.get("Retry-After");
  if (retryAfter !== "17") {
    throw new Error(`Expected Retry-After 17, got ${retryAfter}`);
  }

  const body = await response.json();
  if (body?.error !== "Rate limit exceeded") {
    throw new Error(`Unexpected body payload: ${JSON.stringify(body)}`);
  }
});
