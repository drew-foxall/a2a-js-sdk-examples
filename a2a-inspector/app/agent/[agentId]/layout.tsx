import type { ReactNode } from "react";

import { AppSidebar, SiteHeader } from "@/components/sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

interface AgentLayoutProps {
  readonly children: ReactNode;
}

/**
 * Layout for agent pages.
 *
 * Follows the sidebar-16 pattern from shadcn/ui:
 * - Sticky site header with sidebar trigger
 * - Sidebar with agent switcher and chat history
 * - Main content area for chat/agent views
 *
 * @see https://ui.shadcn.com/blocks/sidebar#sidebar-16
 */
export default function AgentLayout({ children }: AgentLayoutProps): React.JSX.Element {
  return (
    <div className="h-screen [--header-height:calc(--spacing(14))]">
      <SidebarProvider className="flex h-full flex-col">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <AppSidebar />
          <SidebarInset className="min-h-0 min-w-0">{children}</SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
