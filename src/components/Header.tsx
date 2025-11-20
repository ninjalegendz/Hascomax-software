import { Link } from "react-router-dom";
import { CircleUser, Menu, Package } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NotificationBell } from "./NotificationBell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { navItems } from "@/constants/navigation";

export function Header({ unreadMessages }: { unreadMessages: number }) {
  const { signOut, profile } = useAuth();
  const userPermissions = new Set(profile?.permissions || []);
  const accessibleNavItems = navItems.filter(item => userPermissions.has(item.permission));

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-4 lg:h-[60px] lg:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0 md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="flex flex-col">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
            <SheetDescription>
              Main navigation links for the application.
            </SheetDescription>
          </SheetHeader>
          <nav className="grid gap-2 text-lg font-medium">
            <Link to="/" className="flex items-center gap-2 text-lg font-semibold mb-4">
              <Package className="h-6 w-6" />
              <span>BizManager</span>
            </Link>
            {accessibleNavItems.map((item) => {
              const isMessages = item.label === 'Messages';
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className="mx-[-0.65rem] flex items-center gap-4 rounded-xl px-3 py-2 text-muted-foreground hover:text-foreground"
                >
                  <item.icon className="h-5 w-5" />
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
        </SheetContent>
      </Sheet>

      <div className="w-full flex-1">
        {/* Search bar removed */}
      </div>
      <NotificationBell />
      <ThemeToggle />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full">
                <CircleUser className="h-5 w-5" />
                <span className="sr-only">Toggle user menu</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>My Account</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>My Account</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings/profile">Profile</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="mailto:support@bizmanager.com">Support</a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}