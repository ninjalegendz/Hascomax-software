import React from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronLeft, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "./ui/button";
import { navItems } from "@/constants/navigation";

interface SidebarProps {
  isCollapsed: boolean;
  toggleSidebar: () => void;
  unreadMessages: number;
}

export function Sidebar({ isCollapsed, toggleSidebar, unreadMessages }: SidebarProps) {
  const location = useLocation();
  const { profile } = useAuth();
  const userPermissions = new Set(profile?.permissions || []);

  const accessibleNavItems = navItems.filter(item => userPermissions.has(item.permission));

  return (
    <div className={cn("hidden border-r bg-muted/40 md:block transition-all duration-300", isCollapsed ? "w-14" : "w-60")}>
      <div className="flex h-full max-h-screen flex-col">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px]">
          <Link to="/" className="flex items-center gap-2 font-semibold whitespace-nowrap overflow-hidden">
            <Package className="h-6 w-6" />
            {!isCollapsed && <span className="transition-opacity">BizManager</span>}
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto">
          <nav className={cn("grid items-start gap-1 text-sm font-medium py-2", isCollapsed ? "px-2" : "px-4")}>
            {accessibleNavItems.map((item) => {
              const isMessages = item.label === 'Messages';
              return isCollapsed ? (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Link
                      to={item.href}
                      className={cn(
                        "relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary",
                        (location.pathname.startsWith(item.href) && item.href !== "/") && "bg-muted text-primary",
                        (location.pathname === "/" && item.href === "/") && "bg-muted text-primary"
                      )}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="sr-only">{item.label}</span>
                      {isMessages && unreadMessages > 0 && (
                        <span className="absolute top-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white transform translate-x-1/4 -translate-y-1/4">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                    (location.pathname.startsWith(item.href) && item.href !== "/") && "bg-muted text-primary",
                    (location.pathname === "/" && item.href === "/") && "bg-muted text-primary"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                  {isMessages && unreadMessages > 0 && (
                    <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>
        <div className="mt-auto p-2 border-t">
            <Button variant="ghost" onClick={toggleSidebar} className="w-full justify-center">
                <ChevronLeft className={cn("h-4 w-4 transition-transform", isCollapsed && "rotate-180")} />
                <span className="sr-only">{isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}</span>
            </Button>
        </div>
      </div>
    </div>
  );
}