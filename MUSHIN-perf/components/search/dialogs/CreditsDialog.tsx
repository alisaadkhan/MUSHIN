import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import type { useNavigate } from "react-router-dom";

interface CreditsDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  isFreePlan: boolean;
  creditsResetAt: string | undefined;
  navigate: ReturnType<typeof useNavigate>;
}

export default function CreditsDialog({ open, onOpenChange, isFreePlan, creditsResetAt, navigate }: CreditsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm text-center">
        <DialogHeader>
          <DialogTitle className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            Daily Credits Used Up
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          You've used all your search credits.
          {isFreePlan ? " Upgrade to Pro for more credits." : ""}
        </p>
        {creditsResetAt && (
          <p className="text-xs text-muted-foreground">
            Credits reset on {format(new Date(creditsResetAt), "MMMM d, yyyy")}
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
          {isFreePlan && (
            <Button className="w-full btn-shine" onClick={() => { onOpenChange(false); navigate("/billing"); }}>
              Upgrade to Pro · ₨4,999/mo
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
