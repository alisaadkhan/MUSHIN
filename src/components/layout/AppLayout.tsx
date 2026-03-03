import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Search, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Purple glow blobs */}
      <div className="fixed top-0 right-0 w-[500px] h-[500px] rounded-full bg-primary opacity-[0.05] blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary opacity-[0.04] blur-[120px] -z-10 pointer-events-none" />

      <AppSidebar isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-background/80 backdrop-blur-md flex items-center px-4 gap-4 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-muted-foreground hover:text-foreground"
          >
            {sidebarOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </Button>

          <div className="flex-1 max-w-md ml-2">
            <div className="relative">
              <Search
                size={15}
                strokeWidth={1.5}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search creators, campaigns..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-muted/40 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <NotificationCenter />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
