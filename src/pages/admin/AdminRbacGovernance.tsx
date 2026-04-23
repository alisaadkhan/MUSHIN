import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeAuthed } from "@/lib/edge";
import { Loader2, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type RoleRow = { id: string; name: string; description: string | null; is_system: boolean };
type PermissionRow = { id: string; action: string; description: string | null };
type AssignmentRow = {
  id: string;
  user_id: string;
  role_id: string;
  granted_at: string;
  revoked_at: string | null;
  roles?: { name: string } | null;
};

export default function AdminRbacGovernance() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newPermAction, setNewPermAction] = useState("");
  const [newPermDesc, setNewPermDesc] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [rolePermIds, setRolePermIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const [userId, setUserId] = useState("");

  const { data: roles = [], isLoading: rolesLoading } = useQuery<RoleRow[]>({
    queryKey: ["superadmin-rbac-roles"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ roles: RoleRow[] }>("superadmin-rbac", {
        body: { action: "list_roles" },
      } as any);
      if (error) throw error;
      return (data as any)?.roles ?? [];
    },
    staleTime: 15_000,
  });

  const { data: permissions = [], isLoading: permsLoading } = useQuery<PermissionRow[]>({
    queryKey: ["superadmin-rbac-perms"],
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed<{ permissions: PermissionRow[] }>("superadmin-rbac", {
        body: { action: "list_permissions" },
      } as any);
      if (error) throw error;
      return (data as any)?.permissions ?? [];
    },
    staleTime: 15_000,
  });

  const { data: rolePerms = [], isLoading: rolePermsLoading } = useQuery<Array<{ permission_id: string }>>({
    queryKey: ["superadmin-role-perms", selectedRoleId],
    enabled: !!selectedRoleId,
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-rbac", {
        body: { action: "get_role_permissions", role_id: selectedRoleId },
      } as any);
      if (error) throw error;
      return ((data as any)?.permissions ?? []) as any[];
    },
  });

  useMemo(() => {
    if (!selectedRoleId) return;
    const ids = new Set((rolePerms ?? []).map((p: any) => String(p.permission_id)));
    setRolePermIds(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoleId, rolePermsLoading]);

  const createRole = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-rbac", {
        body: { action: "create_role", name: newRoleName.trim(), description: newRoleDesc.trim() || null },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setNewRoleName("");
      setNewRoleDesc("");
      await qc.invalidateQueries({ queryKey: ["superadmin-rbac-roles"] });
      toast({ title: "Role created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const createPerm = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-rbac", {
        body: { action: "create_permission", action_name: newPermAction.trim(), description: newPermDesc.trim() || null },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setNewPermAction("");
      setNewPermDesc("");
      await qc.invalidateQueries({ queryKey: ["superadmin-rbac-perms"] });
      toast({ title: "Permission created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const saveRolePerms = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-rbac", {
        body: {
          action: "set_role_permissions",
          role_id: selectedRoleId,
          permission_ids: Array.from(rolePermIds),
          reason: reason.trim(),
        },
      } as any);
      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      setReason("");
      await qc.invalidateQueries({ queryKey: ["superadmin-role-perms", selectedRoleId] });
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;
  const permById = useMemo(() => new Map(permissions.map((p) => [p.id, p])), [permissions]);

  const { data: effective, isLoading: effectiveLoading, error: effectiveError } = useQuery<{
    roles: Array<{ role_id: string; name: string | null }>;
    effective_permissions: string[];
  }>({
    queryKey: ["superadmin-effective-perms", userId],
    enabled: userId.trim().length > 0,
    queryFn: async () => {
      const { data, error } = await invokeEdgeAuthed("superadmin-effective-permissions", {
        body: { user_id: userId.trim() },
      } as any);
      if (error) throw error;
      return (data as any) ?? { roles: [], effective_permissions: [] };
    },
    staleTime: 10_000,
    retry: 1,
  });

  return (
    <div className="p-8 space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">RBAC Governance</h1>
          <p className="section-subtitle">Roles · Permissions · Assignments (super admin only)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="app-card p-5 space-y-4">
          <div className="flex items-center gap-2 text-white/70">
            <ShieldCheck size={14} />
            <h2 className="text-[13px] font-medium">Roles</h2>
          </div>

          {rolesLoading ? (
            <div className="py-10 text-center text-white/30">
              <Loader2 size={16} className="animate-spin mx-auto" />
            </div>
          ) : (
            <div className="space-y-1.5">
              {roles.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRoleId(r.id)}
                  className={`w-full text-left px-3 py-2 rounded border text-[12px] transition-colors ${
                    selectedRoleId === r.id
                      ? "bg-white/8 border-white/15 text-white"
                      : "bg-white/[0.02] border-white/6 text-white/55 hover:bg-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{r.name}</span>
                    {r.is_system ? <span className="text-[10px] text-white/35 mono">system</span> : null}
                  </div>
                  {r.description ? <div className="text-[11px] text-white/35 mt-0.5">{r.description}</div> : null}
                </button>
              ))}
            </div>
          )}

          <div className="pt-3 border-t border-white/6 space-y-2">
            <div className="text-[10px] text-white/25 uppercase tracking-widest">Create role</div>
            <input
              className="input-sharp"
              placeholder="Role name"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
            />
            <input
              className="input-sharp"
              placeholder="Description (optional)"
              value={newRoleDesc}
              onChange={(e) => setNewRoleDesc(e.target.value)}
            />
            <button
              className="btn-secondary w-full justify-center"
              disabled={createRole.isPending || newRoleName.trim().length < 3}
              onClick={() => createRole.mutate()}
            >
              {createRole.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </div>

        <div className="app-card p-5 space-y-4 lg:col-span-2">
          <div className="flex items-center gap-2 text-white/70">
            <Users size={14} />
            <h2 className="text-[13px] font-medium">Permissions</h2>
            {selectedRole ? (
              <span className="text-[11px] text-white/35">
                for <span className="mono text-white/60">{selectedRole.name}</span>
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] text-white/25 uppercase tracking-widest">All permissions</div>
              <div className="max-h-[420px] overflow-auto pr-1 space-y-1">
                {permsLoading || rolePermsLoading ? (
                  <div className="py-10 text-center text-white/30">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </div>
                ) : (
                  permissions.map((p) => {
                    const checked = rolePermIds.has(p.id);
                    const disabled = !selectedRoleId;
                    return (
                      <label
                        key={p.id}
                        className={`flex items-start gap-2 px-3 py-2 rounded border ${
                          disabled
                            ? "bg-white/[0.01] border-white/4 text-white/25"
                            : "bg-white/[0.02] border-white/6 text-white/55 hover:bg-white/5 hover:border-white/10"
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={(e) => {
                            const next = new Set(rolePermIds);
                            if (e.target.checked) next.add(p.id);
                            else next.delete(p.id);
                            setRolePermIds(next);
                          }}
                          className="mt-0.5"
                        />
                        <div className="min-w-0">
                          <div className="mono text-[11px] truncate">{p.action}</div>
                          {p.description ? <div className="text-[11px] text-white/35">{p.description}</div> : null}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="app-card p-4 space-y-2 border border-white/6 bg-white/[0.02]">
                <div className="text-[10px] text-white/25 uppercase tracking-widest">Create permission</div>
                <input
                  className="input-sharp"
                  placeholder="e.g. user.read"
                  value={newPermAction}
                  onChange={(e) => setNewPermAction(e.target.value)}
                />
                <input
                  className="input-sharp"
                  placeholder="Description (optional)"
                  value={newPermDesc}
                  onChange={(e) => setNewPermDesc(e.target.value)}
                />
                <button
                  className="btn-secondary w-full justify-center"
                  disabled={createPerm.isPending || newPermAction.trim().length < 3}
                  onClick={() => createPerm.mutate()}
                >
                  {createPerm.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Create
                </button>
              </div>

              <div className="app-card p-4 space-y-2 border border-white/6 bg-white/[0.02]">
                <div className="text-[10px] text-white/25 uppercase tracking-widest">Save changes</div>
                <textarea
                  className="w-full h-20 input-sharp"
                  placeholder="Reason (required, min 10 chars)…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="btn-secondary w-full justify-center"
                  disabled={!selectedRoleId || saveRolePerms.isPending || reason.trim().length < 10}
                  onClick={() => saveRolePerms.mutate()}
                >
                  {saveRolePerms.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save role permissions
                </button>
                <div className="text-[11px] text-white/35">
                  Selected permissions:{" "}
                  <span className="mono text-white/60">
                    {Array.from(rolePermIds)
                      .map((id) => permById.get(id)?.action ?? id)
                      .slice(0, 12)
                      .join(", ")}
                    {rolePermIds.size > 12 ? "…" : ""}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-white/6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <div className="text-[13px] font-medium">User effective permissions</div>
                <div className="text-[11px] text-white/35">Computed server-side from RBAC assignments.</div>
              </div>
              <input
                className="input-sharp mono w-[420px]"
                placeholder="User id (uuid)…"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="app-card p-4 border border-white/6 bg-white/[0.02]">
                <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Assigned roles</div>
                {effectiveLoading ? (
                  <div className="py-8 text-center text-white/30">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </div>
                ) : effectiveError ? (
                  <div className="text-[12px] text-red-200/80">{(effectiveError as any)?.message ?? "Failed"}</div>
                ) : (
                  <div className="space-y-1">
                    {(effective?.roles ?? []).length === 0 ? (
                      <div className="text-[12px] text-white/35">No roles assigned.</div>
                    ) : (
                      effective!.roles.map((r) => (
                        <div key={r.role_id} className="text-[12px] text-white/55 flex items-center justify-between">
                          <span className="mono">{r.name ?? r.role_id.slice(0, 8) + "…"}</span>
                          <span className="mono text-white/25">{r.role_id.slice(0, 8)}…</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="app-card p-4 border border-white/6 bg-white/[0.02]">
                <div className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Effective permissions</div>
                {effectiveLoading ? (
                  <div className="py-8 text-center text-white/30">
                    <Loader2 size={16} className="animate-spin mx-auto" />
                  </div>
                ) : effectiveError ? (
                  <div className="text-[12px] text-red-200/80">{(effectiveError as any)?.message ?? "Failed"}</div>
                ) : (
                  <div className="max-h-[240px] overflow-auto pr-1 space-y-1">
                    {(effective?.effective_permissions ?? []).length === 0 ? (
                      <div className="text-[12px] text-white/35">No permissions.</div>
                    ) : (
                      effective!.effective_permissions.map((p) => (
                        <div key={p} className="mono text-[11px] text-white/55 border border-white/6 bg-white/[0.02] rounded px-2 py-1">
                          {p}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

