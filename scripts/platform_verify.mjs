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
    if (rel.startsWith(".git/")) continue;
    if (rel.endsWith(".png") || rel.endsWith(".jpg") || rel.endsWith(".jpeg") || rel.endsWith(".gif") || rel.endsWith(".woff") || rel.endsWith(".woff2")) continue;

    const text = readFileSync(file, "utf8");
    if (text.includes("SUPABASE_SERVICE_ROLE_KEY") || /service_role[^\n]{0,120}eyJ/.test(text)) {
      leaked.push(rel);
    }
  }

  if (leaked.length > 0) {
    throw new Error(`Service-role key reference found outside gateway:\n${leaked.join("\n")}`);
  }
}

function assertMigrationParity() {
  console.log("\n[platform:verify] Migration parity check");
  const out = execSync("npx supabase migration list", { cwd: root, env: process.env }).toString();
  const lines = out.split(/\r?\n/);
  const mismatches = [];
  for (const line of lines) {
    if (!/^\s*\d/.test(line) && !/^\s*\|\s*\d/.test(line)) continue;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 2) continue;
    const local = parts[0];
    const remote = parts[1];
    if (!local || !remote || local !== remote) {
      mismatches.push(line.trim());
    }
  }

  if (mismatches.length > 0) {
    throw new Error(`Migration mismatch detected:\n${mismatches.join("\n")}`);
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
    run("npx eslint supabase/functions --ext .ts", "Edge function linting");
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
