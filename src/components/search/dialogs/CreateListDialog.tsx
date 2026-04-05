import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface CreateListDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newListName: string;
  setNewListName: (v: string) => void;
  onCreate: () => void;
}

export default function CreateListDialog({ open, onOpenChange, newListName, setNewListName, onCreate }: CreateListDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Create New List</DialogTitle></DialogHeader>
        <Input placeholder="e.g. Ramadan Campaign 2026" value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreate()}
          className="my-4" />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onCreate} disabled={!newListName.trim()}>Create & Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
