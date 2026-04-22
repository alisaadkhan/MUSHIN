import { ReactNode, useState, useEffect } from "react";
import { AppSidebar } from "./AppSidebar";
import { Search, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";
import { useNavigate } from "react-router-dom";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [topSearch, setTopSearch] = useState("");

  // Default sidebar open on lg+ screens
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    setSidebarOpen(mq.matches);
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Purple glow blobs */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary opacity-[0.05] blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary opacity-[0.04] blur-[120px] -z-10 pointer-events-none" />

      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          aria-hidden="true"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <AppSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <AnnouncementBanner />
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-3 sm:px-4 gap-3 flex-shrink-0 z-20">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
            aria-label={sidebarOpen ? "Close navigation" : "Open navigation"}
          >
            <Menu size={18} strokeWidth={1.5} />
          </Button>

          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search
                size={15}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search creators, campaigns..."
                value={topSearch}
                onChange={(e) => setTopSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && topSearch.trim()) {
                    navigate(`/search?q=${encodeURIComponent(topSearch.trim())}`);
                    setTopSearch("");
                  }
                }}
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-3 sm:p-5 lg:p-7">
          {children}
        </main>
      </div>
    </div>
  );
}
