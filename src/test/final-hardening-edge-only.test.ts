import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function readAllFiles(dir: string): Array<{ file: string; content: string }> {
  const out: Array<{ file: string; content: string }> = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop()!;
    const entries = fs.readdirSync(cur, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.isFile() && (full.endsWith(".ts") || full.endsWith(".tsx"))) {
        out.push({ file: full, content: fs.readFileSync(full, "utf8") });
      }
    }
  }
  return out;
}

describe("FINAL HARDENING: Edge-only enforcement (admin/support UI)", () => {
  it("has ZERO supabase.from/rpc usage in admin pages", () => {
    const files = readAllFiles(path.join(ROOT, "src", "pages", "admin"));
    const hits: string[] = [];
    for (const f of files) {
      if (/supabase\.from\(/.test(f.content) || /supabase\.rpc\(/.test(f.content)) hits.push(f.file);
    }
    expect(hits, `Direct DB usage found:\n${hits.join("\n")}`).toEqual([]);
  });

  it("has ZERO supabase.from/rpc usage in support pages", () => {
    const files = readAllFiles(path.join(ROOT, "src", "pages"));
    const hits: string[] = [];
    for (const f of files) {
      const rel = path.relative(ROOT, f.file).replaceAll("\\", "/");
      if (!rel.startsWith("src/pages/Support")) continue;
      if (/supabase\.from\(/.test(f.content) || /supabase\.rpc\(/.test(f.content)) hits.push(rel);
    }
    expect(hits, `Direct DB usage found:\n${hits.join("\n")}`).toEqual([]);
  });
});

