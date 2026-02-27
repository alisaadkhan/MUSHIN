import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Users, Trash2, Eye, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useInfluencerLists } from "@/hooks/useInfluencerLists";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Checkbox } from "@/components/ui/checkbox";

export default function ListsPage() {
  const { data: lists, isLoading, createList, deleteList } = useInfluencerLists();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createList.mutateAsync(newName.trim());
      toast({ title: "List created" });
      setShowCreate(false);
      setNewName("");
    } catch {
      toast({ title: "Failed to create list", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteList.mutateAsync(deleteId);
      toast({ title: "List deleted" });
    } catch {
      toast({ title: "Failed to delete list", variant: "destructive" });
    }
    setDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-foreground">Lists</h1>
          <p className="text-sm text-muted-foreground mt-1">Organize creators into curated lists</p>
        </div>
        <Button className="rounded-lg btn-shine" onClick={() => setShowCreate(true)}>
          <Plus size={16} strokeWidth={1.5} className="mr-1" /> Create List
        </Button>
      </div>

      {isLoading && (
        <div className="bg-white/50 backdrop-blur-sm border border-border/50 rounded-2xl p-6 h-48 animate-pulse" />
      )}

      {!isLoading && lists && lists.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-white/80 backdrop-blur-md border border-white/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 whitespace-nowrap">
                      <div className="flex items-center">
                        <Checkbox className="rounded border-border mr-3 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground" />
                        Name
                      </div>
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 whitespace-nowrap">Creators</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell whitespace-nowrap">Created</th>
                    <th className="text-left text-xs font-medium text-muted-foreground px-5 py-3 hidden md:table-cell whitespace-nowrap">Updated</th>
                    <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((list) => {
                    const itemCount = (list as any).list_items?.[0]?.count ?? 0;
                    return (
                      <tr key={list.id} className="border-b border-border hover:bg-muted/30 transition-colors last:border-0">
                        <td className="px-5 py-4">
                          <div className="flex items-center">
                            <Checkbox className="rounded border-border mr-3" />
                            <Link to={`/lists/${list.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                              {list.name}
                            </Link>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground">{itemCount}</td>
                        <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                          {format(new Date(list.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-4 text-sm text-muted-foreground hidden md:table-cell">
                          {format(new Date(list.updated_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" asChild>
                              <Link to={`/lists/${list.id}`}>
                                <Eye size={14} strokeWidth={1.5} />
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteId(list.id)}
                            >
                              <Trash2 size={14} strokeWidth={1.5} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                              <MoreHorizontal size={14} strokeWidth={1.5} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {!isLoading && (!lists || lists.length === 0) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white/50 backdrop-blur-sm border border-white/50 shadow-sm rounded-2xl">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-foreground mb-1">No Lists Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Create your first list to start organizing influencers for campaigns.
            </p>
            <Button className="mt-4 gap-2 rounded-lg btn-shine" onClick={() => setShowCreate(true)}>
              <Plus size={16} strokeWidth={1.5} />
              Create List
            </Button>
          </div>
        </motion.div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="e.g. Summer Campaign 2026"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="my-4"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || createList.isPending}>
              {createList.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete List</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the list and all its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
