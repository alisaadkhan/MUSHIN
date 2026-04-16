import { useState } from "react";
import { Save, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_NICHES = [
    "Fashion", "Food", "Beauty", "Cricket", "Tech",
    "Fitness", "Travel", "Gaming", "Music", "Education",
    "Comedy", "Lifestyle", "Finance", "Health",
    "Automotive", "Photography", "Art", "Sports", "News",
];

const DEFAULT_CITIES = [
    "Karachi", "Lahore", "Islamabad", "Rawalpindi",
    "Faisalabad", "Multan", "Peshawar", "Quetta",
    "Sialkot", "Gujranwala",
];

interface FeatureFlag {
    key: string;
    label: string;
    enabled: boolean;
}

export default function AdminConfig() {
    const { toast } = useToast();
    const [niches, setNiches] = useState(DEFAULT_NICHES.join(", "));
    const [cities, setCities] = useState(DEFAULT_CITIES.join(", "));
    const [flags, setFlags] = useState<FeatureFlag[]>([
        { key: "ai_search", label: "AI-Powered Search (search-natural)", enabled: true },
        { key: "influencer_eval", label: "Influencer AI Evaluation", enabled: true },
        { key: "hubspot_sync", label: "HubSpot CRM Sync", enabled: true },
        { key: "invoice_gen", label: "Invoice Generation", enabled: true },
        { key: "seed_endpoint", label: "Seed Accounts Endpoint (disable in prod)", enabled: true },
    ]);

    const toggleFlag = (key: string) =>
        setFlags((prev) => prev.map((f) => f.key === key ? { ...f, enabled: !f.enabled } : f));

    const handleSave = () => {
        toast({ title: "Configuration saved", description: "Settings updated in memory (persistence requires DB config table)." });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground mb-1">System Configuration</h1>
                <p className="text-muted-foreground">Feature flags, niche list, and city list</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
                {/* Feature flags */}
                <div className="glass-card rounded-2xl p-6">
                    <h2 className="text-base font-semibold text-foreground mb-4">Feature Flags</h2>
                    <div className="space-y-3">
                        {flags.map((f) => (
                            <div key={f.key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                <span className="text-sm text-slate-300">{f.label}</span>
                                <button onClick={() => toggleFlag(f.key)} className="focus:outline-none">
                                    {f.enabled
                                        ? <ToggleRight className="h-6 w-6 text-violet-400" />
                                        : <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                                    }
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Niche list */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-base font-semibold text-foreground mb-3">Niche List</h2>
                        <p className="text-xs text-muted-foreground mb-2">Comma-separated</p>
                        <textarea
                            className="w-full h-28 px-3 py-2 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 resize-none focus:outline-none focus:border-violet-500"
                            value={niches}
                            onChange={(e) => setNiches(e.target.value)}
                        />
                    </div>

                    {/* City list */}
                    <div className="glass-card rounded-2xl p-6">
                        <h2 className="text-base font-semibold text-foreground mb-3">City List (Pakistan)</h2>
                        <p className="text-xs text-muted-foreground mb-2">Comma-separated</p>
                        <textarea
                            className="w-full h-24 px-3 py-2 rounded-lg bg-[#070707] border border-border text-sm text-slate-300 resize-none focus:outline-none focus:border-violet-500"
                            value={cities}
                            onChange={(e) => setCities(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <div className="flex justify-end">
                <Button onClick={handleSave} className="gap-2 bg-violet-600 hover:bg-violet-700 text-foreground">
                    <Save className="h-4 w-4" /> Save Configuration
                </Button>
            </div>
        </div>
    );
}
