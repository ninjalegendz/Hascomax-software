import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { showError } from "@/utils/toast";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { useQuery } from "@tanstack/react-query";
import { authenticatedFetch } from "@/lib/api";
import type { Conversation } from "@/types";
import { useSettings } from "@/contexts/SettingsContext";
import SystemAsleep from "@/pages/SystemAsleep";
import { Loader2 } from "lucide-react";

const routePermissions: { path: RegExp; permission: string }[] = [
  { path: /^\/$/, permission: 'dashboard:view' },
  { path: /^\/customers(\/.*)?$/, permission: 'customers:view' },
  { path: /^\/invoices\/new$/, permission: 'invoices:create' },
  { path: /^\/invoices\/.*\/edit$/, permission: 'invoices:edit' },
  { path: /^\/invoices(\/.*)?$/, permission: 'invoices:view' },
  { path: /^\/receipts(\/.*)?$/, permission: 'receipts:view' },
  { path: /^\/returns\/new$/, permission: 'returns:create' },
  { path: /^\/returns(\/.*)?$/, permission: 'returns:view' },
  { path: /^\/repairs\/new$/, permission: 'repairs:create' },
  { path: /^\/repairs(\/.*)?$/, permission: 'repairs:view' },
  { path: /^\/quotations\/new$/, permission: 'quotations:create' },
  { path: /^\/quotations\/.*\/edit$/, permission: 'quotations:edit' },
  { path: /^\/quotations(\/.*)?$/, permission: 'quotations:view' },
  { path: /^\/inventory(\/.*)?$/, permission: 'inventory:view' },
  { path: /^\/purchases(\/.*)?$/, permission: 'purchases:view' },
  { path: /^\/expenses(\/.*)?$/, permission: 'expenses:view' },
  { path: /^\/damages(\/.*)?$/, permission: 'damages:view' },
  { path: /^\/tasks(\/.*)?$/, permission: 'tasks:view' },
  { path: /^\/messages(\/.*)?$/, permission: 'messages:view' },
  { path: /^\/activity$/, permission: 'activity:view' },
  { path: /^\/analytics$/, permission: 'analytics:view' },
  { path: /^\/bingo$/, permission: 'accounting:view' },
  { path: /^\/settings\/roles$/, permission: 'roles:view' },
  { path: /^\/settings\/employees$/, permission: 'employees:view' },
  { path: /^\/settings\/stress-test$/, permission: 'settings:manage:stress-test' },
  { path: /^\/settings(\/.*)?$/, permission: 'settings:view' },
];

export function Layout() {
  const { profile, loading: authLoading } = useAuth();
  const { settings, isLoading: settingsLoading } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useLocalStorageState('sidebar-collapsed', false);
  
  const { data: conversationsData } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => authenticatedFetch('/api/conversations'),
    enabled: !!profile,
  });

  const totalUnreadCount = conversationsData?.reduce((sum, convo) => sum + convo.unreadCount, 0) || 0;

  const matchedRoute = routePermissions.find(route => route.path.test(location.pathname));
  const requiredPermission = matchedRoute?.permission;
  const hasPermission = usePermissions(requiredPermission || []);
  const canManageSystemStatus = usePermissions('settings:manage:system-status');

  // Check authentication status
  useEffect(() => {
    if (!authLoading && !profile) {
      navigate("/login");
    }
  }, [profile, authLoading, navigate]);

  // Check permissions for current route after authentication is confirmed
  useEffect(() => {
    if (!authLoading && profile) {
      if (requiredPermission && !hasPermission) {
        showError("You do not have permission to access this page.");
        navigate("/");
      }
    }
  }, [location.pathname, authLoading, profile, hasPermission, requiredPermission, navigate]);


  if (authLoading || settingsLoading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!profile) {
    return null; // Render nothing while redirecting
  }

  if (settings?.isSystemSleeping && !canManageSystemStatus) {
    return <SystemAsleep />;
  }

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="grid h-screen w-full md:grid-cols-[auto_1fr]">
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} unreadMessages={totalUnreadCount} />
      <div className="flex flex-col overflow-hidden">
        <Header unreadMessages={totalUnreadCount} />
        <main className="flex flex-1 flex-col gap-4 overflow-auto p-4 lg:gap-6 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}