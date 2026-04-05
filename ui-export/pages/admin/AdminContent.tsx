import { useState } from "react";
import { CheckCircle, XCircle, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const MOCK_FLAGGED = [
    { id: "1", type: "profile", username: "@spammer123", platform: "Instagram", reason: "Fake followers detected", flagged_at: "2026-02-25" },
    { id: "2", type: "outreach", username: "@scampromo", platform: "TikTok", reason: "Spam outreach email", flagged_at: "2026-02-24" },
];

export default function AdminContent() {
    const { toast } = useToast();
    const [items, setItems] = useState(MOCK_FLAGGED);
    const [loading, setLoading] = useState<string | null>(null);

    const handleAction = (id: string, action: "approve" | "reject") => {
        setLoading(id);
        setTimeout(() => {
            setItems((prev) => prev.filter((i) => i.id !== id));
            toast({ title: action === "approve" ? "Content approved" : "Content rejected and removed" });
            setLoading(null);
        }, 600);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">Content Moderation</h1>
                <p className="text-muted-foreground">Review flagged profiles and outreach content</p>
            </div>

            {items.length === 0 && (
                <div className="glass-card rounded-2xl p-12 text-center">
                    <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-3" />
                    <p className="text-foreground font-semibold">All clear!</p>
                    <p className="text-muted-foreground text-sm mt-1">No flagged content to review.</p>
                </div>
            )}

            <div className="space-y-3">
                {items.map((item) => (
                    <div key={item.id} className="bg-muted/40 border border-amber-500/30 rounded-xl p-5 flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Flag className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-slate-200 font-medium">{item.username}</span>
                                    <Badge variant="outline" className="text-[10px] border-slate-600 text-muted-foreground">{item.platform}</Badge>
                                    <Badge variant="outline" className="text-[10px] border-slate-600 text-muted-foreground capitalize">{item.type}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">{item.reason}</p>
                                <p className="text-xs text-muted-foreground mt-1">Flagged: {item.flagged_at}</p>
                            </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                            <Button size="sm" variant="ghost"
                                className="h-7 text-xs text-emerald-400 hover:bg-emerald-500/10"
                                disabled={loading === item.id}
                                onClick={() => handleAction(item.id, "approve")}
                            >
                                <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                            </Button>
                            <Button size="sm" variant="ghost"
                                className="h-7 text-xs text-red-400 hover:bg-red-500/10"
                                disabled={loading === item.id}
                                onClick={() => handleAction(item.id, "reject")}
                            >
                                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
