#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();

function run(command, label) {
  console.log(`\n[platform:verify] ${label}`);
  execSync(command, { stdio: "inherit", cwd: root, env: process.env });
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (["node_modules", ".git", "dist", "playwright-report", "test-results"].includes(entry)) continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

function assertNoServiceKeyLeaks() {
  console.log("\n[platform:verify] Security scan for leaked service-role keys");
  const files = walk(root);
  const leaked = [];
  for (const file of files) {
    const rel = relative(root, file).replace(/\\/g, "/");
    if (rel.startsWith("supabase/functions/_shared/privileged_gateway.ts")) continue;
    if (rel === "scripts/platform_verify.mjs") continue;
    if (rel.startsWith(".git/")) continue;
    if (rel.endsWith(".png") || rel.endsWith(".jpg") || rel.endsWith(".jpeg") || rel.endsWith(".gif") || rel.endsWith(".woff") || rel.endsWith(".woff2")) continue;

    const text = readFileSync(file, "utf8");
    // Only fail if an actual JWT-like secret is present (starts with `eyJ...`),
    // not when docs mention the variable name.
    const jwtLike =
      /service_role[^\n]{0,200}eyJ/.test(text) ||
      /SUPABASE_SERVICE_ROLE_KEY\s*[:=]\s*["']?eyJ/i.test(text);

    if (jwtLike) leaked.push(rel);
  }

  if (leaked.length > 0) {
    throw new Error(`Service-role key reference found outside gateway:\n${leaked.join("\n")}`);
  }
}

function assertMigrationParity() {
  console.log("\n[platform:verify] Migration parity check");
  const out = execSync("npx supabase migration list", { cwd: root, env: process.env }).toString();
  const lines = out.split(/\r?\n/);
  // We compare both:
  //  - timestamp prefix (version family)
  //  - full identifier as reported by the Supabase CLI
  // This catches cases where a migration file name diverges even if the timestamp matches.
  const localPrefixSet = new Set();
  const remotePrefixSet = new Set();
  const localFullSet = new Set();
  const remoteFullSet = new Set();
  for (const line of lines) {
    if (!line.includes("|")) continue;
    // Expected table row shape:
    // | <local> | <remote> | <time> |
    const parts = line.split("|").map((p) => p.trim());
    const cols = parts.filter(Boolean);
    if (cols.length < 2) continue;

    const local = cols[0];
    const remote = cols[1];

    const localDigits = local?.match(/^\d+/)?.[0];
    const remoteDigits = remote?.match(/^\d+/)?.[0];

    // Only treat numeric-leading values as migration identifiers; this
    // avoids picking up header cells like "Local"/"Remote".
    if (localDigits) {
      localPrefixSet.add(localDigits);
      localFullSet.add(local);
    }
    if (remoteDigits) {
      remotePrefixSet.add(remoteDigits);
      remoteFullSet.add(remote);
    }
  }

  const missingRemotePrefix = [...localPrefixSet].filter((t) => !remotePrefixSet.has(t));
  const missingLocalPrefix = [...remotePrefixSet].filter((t) => !localPrefixSet.has(t));
  const missingRemoteFull = [...localFullSet].filter((t) => !remoteFullSet.has(t));
  const missingLocalFull = [...remoteFullSet].filter((t) => !localFullSet.has(t));

  if (
    missingRemotePrefix.length > 0 ||
    missingLocalPrefix.length > 0 ||
    missingRemoteFull.length > 0 ||
    missingLocalFull.length > 0
  ) {
    throw new Error(
      `Migration parity mismatch.\n` +
        `Missing on remote (timestamp prefix): ${missingRemotePrefix.join(", ") || "none"}\n` +
        `Missing locally (timestamp prefix): ${missingLocalPrefix.join(", ") || "none"}\n` +
        `Missing on remote (full identifier): ${missingRemoteFull.join(", ") || "none"}\n` +
        `Missing locally (full identifier): ${missingLocalFull.join(", ") || "none"}`,
    );
  }
}

function assertEndpointSmoke() {
  console.log("\n[platform:verify] Endpoint smoke tests");
  const base = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  if (!base || !anon) {
    console.log("Skipping smoke tests (SUPABASE_URL or SUPABASE_ANON_KEY not set)");
    return;
  }

  const checks = [
    `${base}/functions/v1/health`,
    `${base}/functions/v1/admin-get-audit-log?limit=1`,
  ];

  for (const url of checks) {
    const cmd = `node -e "fetch('${url}',{headers:{apikey:'${anon}'}}).then(async r=>{if(r.status>=500||r.status===404){throw new Error('bad status '+r.status+' for ${url}')}console.log('${url} -> '+r.status)}).catch(e=>{console.error(e.message);process.exit(1)})"`;
    execSync(cmd, { stdio: "inherit", cwd: root, env: process.env });
  }
}

try {
  run("npm run -s lint", "TypeScript and lint checks");
  run("npx tsc -p tsconfig.json --noEmit", "TypeScript compilation");
  if (existsSync(join(root, "supabase", "functions"))) {
    const shouldLintEdge = process.env.LINT_EDGE_FUNCTIONS === "1";
    if (shouldLintEdge) {
      run("npx eslint supabase/functions --ext .ts", "Edge function linting");
    } else {
      console.warn(
        "[platform:verify] Skipping edge-function ESLint by default. " +
          "Set LINT_EDGE_FUNCTIONS=1 to enable."
      );
    }
  }
  assertMigrationParity();
  assertNoServiceKeyLeaks();
  assertEndpointSmoke();
  console.log("\n[platform:verify] PASS");
} catch (error) {
  console.error("\n[platform:verify] FAIL");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
