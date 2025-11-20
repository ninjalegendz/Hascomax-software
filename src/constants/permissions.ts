import { Home, Settings, Users, History, FileText, Package, ShoppingCart, CreditCard, ClipboardCheck, MessageSquare, FileQuestion, Receipt, ShieldX, BarChart, Undo2, Wrench, Landmark, Code } from "lucide-react";

export const navItems = [
  { href: "/", icon: Home, label: "Dashboard", permission: 'dashboard:view' },
  { href: "/customers", icon: Users, label: "Customers", permission: 'customers:view' },
  { href: "/invoices", icon: FileText, label: "Invoices", permission: 'invoices:view' },
  { href: "/receipts", icon: Receipt, label: "Sales Receipts", permission: 'receipts:view' },
  { href: "/returns", icon: Undo2, label: "Returns", permission: 'returns:view' },
  { href: "/repairs", icon: Wrench, label: "Repairs", permission: 'repairs:view' },
  { href: "/quotations", icon: FileQuestion, label: "Quotations", permission: 'quotations:view' },
  { href: "/invoices/new", icon: CreditCard, label: "New Sale", permission: 'sales:process' },
  { href: "/inventory", icon: Package, label: "Inventory", permission: 'inventory:view' },
  { href: "/purchases", icon: ShoppingCart, label: "Purchases", permission: 'purchases:view' },
  { href: "/expenses", icon: Landmark, label: "Expenses", permission: 'expenses:view' },
  { href: "/damages", icon: ShieldX, label: "Damages", permission: 'damages:view' },
  { href: "/tasks", icon: ClipboardCheck, label: "Tasks", permission: 'tasks:view' },
  { href: "/messages", icon: MessageSquare, label: "Messages", permission: 'messages:view' },
  { href: "/activity", icon: History, label: "Activity", permission: 'activity:view' },
  { href: "/analytics", icon: BarChart, label: "Analytics", permission: 'analytics:view' },
  { href: "/settings/app", icon: Settings, label: "App Settings", permission: 'settings:view' },
  { href: "/settings/api", icon: Code, label: "API", permission: 'settings:manage:api-keys' },
];

export const ALL_PERMISSIONS = [
  // Dashboard
  'dashboard:view',
  'dashboard:view:financials',

  // Customers
  'customers:view',
  'customers:view:financials',
  'customers:create',
  'customers:edit:details',
  'customers:edit:status',
  'customers:manage:links',
  'customers:delete',
  'customers:import',

  // Invoices
  'invoices:view',
  'invoices:create',
  'invoices:edit',
  'invoices:send', // future
  'invoices:delete',

  // Receipts
  'receipts:view',

  // Returns
  'returns:view',
  'returns:create',
  'returns:delete',

  // Repairs
  'repairs:view',
  'repairs:create',
  'repairs:edit',
  'repairs:delete',

  // Quotations
  'quotations:view',
  'quotations:create',
  'quotations:edit',
  'quotations:delete',
  'quotations:convert',

  // Sales & Point of Sale
  'sales:view',
  'sales:process',
  'sales:apply:discounts', // future
  'sales:process:refunds', // future

  // Inventory & Products
  'inventory:view',
  'inventory:create',
  'inventory:edit:details',
  'inventory:edit:price',
  'inventory:delete',
  'damages:view',
  'damages:create',
  'damages:edit',
  'damages:delete',

  // Purchases
  'purchases:view',
  'purchases:create',
  'purchases:edit',
  'purchases:delete',

  // Expenses
  'expenses:view',
  'expenses:create',
  'expenses:edit',
  'expenses:delete',

  // Tasks
  'tasks:view',
  'tasks:create',
  'tasks:edit',
  'tasks:delete',
  'tasks:assign',
  'tasks:send:urgent-notification',

  // Messages
  'messages:view',
  'messages:send',

  // Activity Log
  'activity:view',

  // Analytics
  'analytics:view',

  // Accounting
  'accounting:view',

  // Settings & Management
  'settings:view',
  'employees:view',
  'employees:create',
  'employees:edit',
  'employees:delete',
  'roles:view',
  'roles:create',
  'roles:edit',
  'roles:delete',
  'settings:manage:payment-methods',
  'settings:manage:couriers',
  'settings:manage:expense-categories',
  'settings:manage:clear',
  'settings:manage:stress-test',
  'settings:manage:system-status',
  'settings:manage:api-keys',
];

export const groupPermissions = (permissions: string[]) => {
  return permissions.reduce((acc, permission) => {
    const [group] = permission.split(':');
    if (!acc[group]) acc[group] = [];
    acc[group].push(permission);
    return acc;
  }, {} as Record<string, string[]>);
};