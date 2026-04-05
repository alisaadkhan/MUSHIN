import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SaveSearchDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saveSearchName: string;
  setSaveSearchName: (v: string) => void;
  onSave: () => void;
  isPending: boolean;
  query: string;
  selectedPlatforms: string[];
  selectedCity: string;
}

export default function SaveSearchDialog({
  open, onOpenChange, saveSearchName, setSaveSearchName,
  onSave, isPending, query, selectedPlatforms, selectedCity,
}: SaveSearchDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Save This Search</DialogTitle></DialogHeader>
        <Input placeholder="e.g. Lahore Fashion Influencers" value={saveSearchName}
          onChange={(e) => setSaveSearchName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSave()}
          className="my-4" />
        <div className="flex gap-2 flex-wrap mb-4">
          <Badge variant="secondary" className="px-2">{query}</Badge>
          {selectedPlatforms.map(p => <Badge key={p} variant="outline" className="px-2">{p}</Badge>)}
          {selectedCity !== "All Pakistan" && <Badge variant="outline" className="px-2">{selectedCity}</Badge>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSave} disabled={!saveSearchName.trim() || isPending}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
