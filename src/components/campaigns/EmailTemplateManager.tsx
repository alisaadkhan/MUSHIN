import { useState } from "react";
import { Plus, Pencil, Trash2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useEmailTemplates, type EmailTemplate } from "@/hooks/useEmailTemplates";
import { useToast } from "@/hooks/use-toast";

const VARIABLES = ["username", "platform", "campaign_name"];

export function EmailTemplateManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate } = useEmailTemplates();
  const { toast } = useToast();

  const [editOpen, setEditOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setEditingTemplate(null);
    setName("");
    setSubject("");
    setBody("");
    setEditOpen(true);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setName(t.name);
    setSubject(t.subject);
    setBody(t.body);
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }
    try {
      if (editingTemplate) {
        await updateTemplate.mutateAsync({ id: editingTemplate.id, name: name.trim(), subject: subject.trim(), body: body.trim() });
        toast({ title: "Template updated" });
      } else {
        await createTemplate.mutateAsync({ name: name.trim(), subject: subject.trim(), body: body.trim() });
        toast({ title: "Template created" });
      }
      setEditOpen(false);
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTemplate.mutateAsync(deleteId);
      toast({ title: "Template deleted" });
    } catch {
      toast({ title: "Failed to delete", variant: "destructive" });
    }
    setDeleteId(null);
  };

  const insertVariable = (v: string, field: "subject" | "body") => {
    const tag = `{{${v}}}`;
    if (field === "subject") setSubject((s) => s + tag);
    else setBody((b) => b + tag);
  };

  if (isLoading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading templates…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Email Templates</h3>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> New Template
        </Button>
      </div>

      {(!templates || templates.length === 0) ? (
        <p className="text-sm text-muted-foreground">No templates yet. Create one to speed up outreach.</p>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{t.name}</p>
                <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(t.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Edit Template" : "New Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Template Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Initial Outreach" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Subject</Label>
                <div className="flex gap-1">
                  {VARIABLES.map((v) => (
                    <Badge key={v} variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10" onClick={() => insertVariable(v, "subject")}>
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Collaboration with {{username}}" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs">Body</Label>
                <div className="flex gap-1">
                  {VARIABLES.map((v) => (
                    <Badge key={v} variant="outline" className="text-[9px] cursor-pointer hover:bg-primary/10" onClick={() => insertVariable(v, "body")}>
                      {`{{${v}}}`}
                    </Badge>
                  ))}
                </div>
              </div>
              <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Hi {{username}}, we'd love to collaborate…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingTemplate ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template?</AlertDialogTitle>
            <AlertDialogDescription>This template will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
