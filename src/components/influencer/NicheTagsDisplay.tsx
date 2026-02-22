import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface NicheTagsDisplayProps {
  categories: string[];
  className?: string;
}

export function NicheTagsDisplay({ categories, className }: NicheTagsDisplayProps) {
  if (!categories || categories.length === 0) return null;

  return (
    <div className={className}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
        <Tag className="h-3 w-3" /> Niche Categories
      </p>
      <div className="flex flex-wrap gap-1.5">
        {categories.map((cat) => (
          <Badge key={cat} variant="outline" className="text-[10px] bg-primary/5 border-primary/20 text-primary">
            {cat}
          </Badge>
        ))}
      </div>
    </div>
  );
}
