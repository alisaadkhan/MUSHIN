import { Link } from "react-router-dom";
import { AuroraBackground } from "@/components/layout/AuroraBackground";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <AuroraBackground />
      <div className="text-center space-y-6 relative z-10">
        <div className="text-8xl font-extrabold aurora-text" style={{ fontFamily: "'Syne', sans-serif" }}>404</div>
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Syne', sans-serif" }}>Page not found</h1>
        <p className="text-muted-foreground max-w-sm mx-auto text-sm">
          This page doesn't exist — even MUSHIN's clarity couldn't find it.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors glow-purple-sm">
          Return Home
        </Link>
      </div>
    </div>
  );
}
