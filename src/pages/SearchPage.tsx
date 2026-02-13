import { useState } from "react";
import { motion } from "framer-motion";
import { Search, SlidersHorizontal, Instagram, Youtube } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAKISTAN_CITIES = [
  "All Pakistan",
  "Karachi",
  "Lahore",
  "Islamabad",
  "Rawalpindi",
  "Faisalabad",
  "Peshawar",
  "Multan",
];

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: SlidersHorizontal },
  { value: "youtube", label: "YouTube", icon: Youtube },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [city, setCity] = useState("All Pakistan");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="text-muted-foreground mt-1">
          Search for influencers across platforms
        </p>
      </div>

      {/* Search Form */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="niche" className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Niche / Keyword
                </Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="niche"
                    placeholder='e.g. "fashion blogger", "fitness coach"'
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-10 bg-background/50"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Platform
                </Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          <p.icon className="h-3.5 w-3.5" />
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                  Location
                </Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="bg-background/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAKISTAN_CITIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button className="btn-shine gap-2" disabled={!query.trim()}>
                <Search className="h-4 w-4" />
                Search Influencers
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Results placeholder */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl aurora-gradient mb-4">
              <Search className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Start Your Search</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter a niche keyword, select a platform and location to discover
              real influencers with verified metrics.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
