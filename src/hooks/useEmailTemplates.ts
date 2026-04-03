import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface EmailTemplate {
  id: string;
  workspace_id: string;
  name: string;
  subject: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export function substituteVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] || `{{${key}}}`);
}

export function useEmailTemplates() {
  const { workspace } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = workspace?.workspace_id;
  const queryKey = ["email-templates", workspaceId];

  const { data: templates, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as EmailTemplate[];
    },
    enabled: !!workspaceId,
    staleTime: 5 * 60_000,
  });

  const createTemplate = useMutation({
    mutationFn: async (t: { name: string; subject: string; body: string }) => {
      const { error } = await supabase.from("email_templates").insert({
        workspace_id: workspaceId!,
        name: t.name,
        subject: t.subject,
        body: t.body,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const updateTemplate = useMutation({
    mutationFn: async (t: { id: string; name?: string; subject?: string; body?: string }) => {
      const { id, ...updates } = t;
      const { error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return { templates, isLoading, createTemplate, updateTemplate, deleteTemplate };
}
