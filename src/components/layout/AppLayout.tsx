import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { Search, Bell, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen flex bg-background relative overflow-hidden">
      {/* Organic gradient blobs */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary opacity-10 blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-0 w-[600px] h-[600px] rounded-full bg-[#10B981] opacity-5 blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed top-1/2 right-1/4 w-[500px] h-[500px] rounded-full bg-[#F43F5E] opacity-5 blur-[120px] -z-10 pointer-events-none" />

      {/* Sidebar */}
      <AppSidebar isOpen={sidebarOpen} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Topbar */}
        <header className="h-14 border-b border-border bg-white/80 backdrop-blur-md flex items-center px-4 gap-4 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={18} strokeWidth={1.5} /> : <Menu size={18} strokeWidth={1.5} />}
          </Button>

          <div className="flex-1 max-w-md ml-4">
            <div className="relative">
              <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search creators, campaigns..."
                className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="ghost" size="icon" className="relative text-foreground">
              <Bell size={18} strokeWidth={1.5} />
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-primary border-2 border-white" />
            </Button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto w-full p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
