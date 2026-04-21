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
  // The file begins with a non-JSON auth_settings block, then a JSON object.
  // We locate the JSON object start at the first "{“ that begins a new line.
  const start = raw.indexOf("\n{");
  if (start < 0) throw new Error("Token JSON start not found");
  return JSON.parse(raw.slice(start + 1));
}

const baseUrl = requireEnv("SUPABASE_URL").replace(/\/$/, "");
const tokenPath = fileURLToPath(new URL("../.tmp_test_tokens.json", import.meta.url));
const tokenJson = parseTokenFile(tokenPath);
const jwt = tokenJson.normal_user.accessToken;

const payload = {
  platforms: ["instagram"],
  cities: ["Karachi"],
  niches: ["Tech & Gadgets"],
  minFollowers: 10000,
};

const resp = await fetch(`${baseUrl}/functions/v1/discover-creators`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${jwt}`,
    "x-idempotency-key": `local-test-${Date.now()}`,
  },
  body: JSON.stringify(payload),
});

const json = await resp.json().catch(() => ({}));
console.log(JSON.stringify({ status: resp.status, body: json }, null, 2));

