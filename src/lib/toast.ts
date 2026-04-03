import { toast } from "@/hooks/use-toast";

export function showErrorToast(err: unknown, fallbackTitle = "Error") {
  const message = err instanceof Error ? err.message : "Something went wrong";
  toast({ title: fallbackTitle, description: message, variant: "destructive" });
}
