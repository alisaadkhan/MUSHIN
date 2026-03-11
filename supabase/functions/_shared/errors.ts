/**
 * Shared error response utilities for Supabase edge functions.
 *
 * SECURITY: Raw error messages from caught exceptions must never be forwarded to
 * API clients as they can leak internal implementation details, DB schema names,
 * stack traces, or credentials.
 *
 * This module provides a safe error handler that:
 *  - Logs the full error server-side for debugging
 *  - Returns a generic, opaque message to clients in production
 *  - Returns the full message in development to ease local debugging
 */

const IS_DEV = Deno.env.get("ENVIRONMENT") === "development";

/**
 * Returns a safe CORS-compatible error Response.
 * Always logs the real error to stderr; sends a sanitised message to clients.
 *
 * @param err       - The caught error (any type)
 * @param context   - Label for the server-side log (e.g. "[admin-list-users]")
 * @param corsHeaders - CORS headers to include in the response
 * @param status    - HTTP status code (default: 500)
 */
export function safeErrorResponse(
  err: unknown,
  context: string,
  corsHeaders: Record<string, string>,
  status = 500
): Response {
  // Always log the real error for observability
  console.error(`${context} Error:`, err instanceof Error ? err.message : err);

  // Derive a client-safe message:
  //   - In development: show the real message to ease debugging
  //   - In production:  generic message prevents information leakage
  let clientMsg = "An internal server error occurred.";
  if (IS_DEV && err instanceof Error) {
    clientMsg = err.message;
  }

  return new Response(
    JSON.stringify({ error: clientMsg }),
    {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

/**
 * Returns a safe 400 Bad-Request Response for validation failures.
 * Validation failure reasons are safe to return to clients (they don't
 * expose internal state).
 */
export function validationErrorResponse(
  message: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({ error: message }),
    {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}
