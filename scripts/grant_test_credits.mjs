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
  // PowerShell redirection may write UTF-16LE by default.
  const raw = buf.includes(0) ? buf.toString("utf16le") : buf.toString("utf8");
  const pos = raw.indexOf("system_admin");
  if (pos < 0) {
    const preview = raw.slice(0, 250);
    throw new Error(`Token JSON marker not found. path=${path} len=${raw.length} preview=${JSON.stringify(preview)}`);
  }
  const start = raw.lastIndexOf("{", pos);
  if (start < 0) throw new Error("Token JSON start not found");
  return JSON.parse(raw.slice(start));
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
let workspaceId = wm?.workspace_id ?? null;
if (!workspaceId) {
  // Local auth admin user creation may bypass the signup trigger in some setups.
  const { data: ws, error: wsErr } = await client
    .from("workspaces")
    .insert({ owner_id: userId, name: "MUSHIN Test Workspace", plan: "free" })
    .select("id")
    .single();
  if (wsErr) throw wsErr;
  workspaceId = ws.id;

  const { error: mErr } = await client
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, user_id: userId, role: "owner" });
  if (mErr) throw mErr;
}

const { data, error } = await client.rpc("grant_user_credits", {
  p_user_id: userId,
  p_workspace_id: workspaceId,
  p_credit_type: "search",
  p_amount: 3,
  p_action: "seed_test",
  p_idempotency_key: "seed_test_search_3",
  p_metadata: {},
});
if (error) throw error;

console.log(
  JSON.stringify(
    { userId, workspaceId, grant: data },
    null,
    2,
  ),
);

