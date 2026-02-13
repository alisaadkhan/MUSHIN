import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { AuroraBackground } from "./AuroraBackground";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AuroraBackground />
      <AppSidebar />
      <main className="pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
