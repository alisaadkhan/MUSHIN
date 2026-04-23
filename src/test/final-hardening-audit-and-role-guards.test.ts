import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "..", "..");

function read(file: string) {
  return fs.readFileSync(path.join(ROOT, file), "utf8");
}

describe("FINAL HARDENING: audit logging + role guards (Edge)", () => {
  it("admin/superadmin Edge functions enforce server-side role checks", () => {
    const adminEdges = [
      "supabase/functions/admin-support-tickets/index.ts",
      "supabase/functions/admin-dashboard/index.ts",
      "supabase/functions/admin-analytics/index.ts",
      "supabase/functions/admin-impersonation-control/index.ts",
      "supabase/functions/update-security-flag-status/index.ts",
    ];

    for (const f of adminEdges) {
      const c = read(f);
      const hasGuard = /requireSystemAdmin\(|isSuperAdmin\(|requireJwt\(/.test(c);
      expect(hasGuard, `${f} missing role/JWT guard`).toBe(true);
    }
  });

  it("support Edge functions log to system audit (via audit_logger)", () => {
    const supportEdges = [
      "supabase/functions/support-users-search/index.ts",
      "supabase/functions/support-tickets/index.ts",
      "supabase/functions/support-activity/index.ts",
      "supabase/functions/support-diagnostics/index.ts",
      "supabase/functions/support-impersonate-user/index.ts",
    ];

    for (const f of supportEdges) {
      const c = read(f);
      expect(/logUserAction\(/.test(c), `${f} missing logUserAction()`).toBe(true);
    }
  });

  it("superadmin actions are audited", () => {
    const superAdminEdges = [
      "supabase/functions/admin-impersonation-control/index.ts",
      "supabase/functions/update-security-flag-status/index.ts",
    ];
    for (const f of superAdminEdges) {
      const c = read(f);
      expect(/logAdminAction\(/.test(c), `${f} missing logAdminAction()`).toBe(true);
    }
  });
});

