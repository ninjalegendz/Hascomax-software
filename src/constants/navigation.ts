import { Home, Settings, Users, History, FileText, Package, ShoppingCart, CreditCard, ClipboardCheck, MessageSquare, FileQuestion, Receipt, ShieldX, BarChart, BarChart3, Undo2, Wrench, Landmark, Code } from "lucide-react";

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
  { href: "/bingo", icon: BarChart3, label: "Accounting", permission: 'accounting:view' },
  { href: "/settings/app", icon: Settings, label: "App Settings", permission: 'settings:view' },
  { href: "/settings/api", icon: Code, label: "API", permission: 'settings:manage:api-keys' },
];