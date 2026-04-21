import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function parseTokenFile(path) {
  const buf = fs.readFileSync(path);
  const raw = buf.includes(0) ? buf.toString("utf16le") : buf.toString("utf8");
  const start = raw.indexOf("\n{");
  if (start < 0) throw new Error("Token JSON start not found");
  return JSON.parse(raw.slice(start + 1));
}

const supabaseUrl = requireEnv("SUPABASE_URL");
const serviceRole = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const tokenPath = fileURLToPath(new URL("../.tmp_test_tokens.json", import.meta.url));
const tokenJson = parseTokenFile(tokenPath);
const userId = tokenJson.normal_user.userId;

const client = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: wm, error: wmErr } = await client
  .from("workspace_members")
  .select("workspace_id")
  .eq("user_id", userId)
  .limit(1)
  .maybeSingle();
if (wmErr) throw wmErr;
const workspaceId = wm?.workspace_id ?? null;

const { data: credit, error: cErr } = await client
  .from("user_credits")
  .select("balance, updated_at")
  .eq("user_id", userId)
  .eq("workspace_id", workspaceId)
  .eq("credit_type", "search")
  .maybeSingle();
if (cErr) throw cErr;

const { count: txCount, error: tErr } = await client
  .from("credit_transactions")
  .select("*", { count: "exact", head: true })
  .eq("user_id", userId)
  .eq("workspace_id", workspaceId)
  .eq("credit_type", "search");
if (tErr) throw tErr;

console.log(
  JSON.stringify(
    { userId, workspaceId, searchCredits: credit?.balance ?? 0, txCount: txCount ?? 0 },
    null,
    2,
  ),
);

