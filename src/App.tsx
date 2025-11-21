import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import NotFound from "./pages/NotFound";
import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import AppSettings from "./pages/AppSettings";
import ApiSettings from "./pages/ApiSettings";
import ApiDocs from "./pages/ApiDocs";
import Activity from "./pages/Activity";
import Invoices from "./pages/Invoices";
import CustomerDetails from "./pages/CustomerDetails";
import InvoiceDetails from "./pages/InvoiceDetails";
import { AuthProvider } from "./contexts/AuthContext";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Inventory from "./pages/Inventory";
import Purchases from "./pages/Purchases";
import Roles from "./pages/Roles";
import Employees from "./pages/Employees";
import { RealtimeProvider } from "./contexts/RealtimeContext";
import ProfileSettings from "./pages/ProfileSettings";
import { SettingsProvider } from "./contexts/SettingsContext";
import Tasks from "./pages/Tasks";
import TaskDetails from "./pages/TaskDetails";
import { UrgentNotificationProvider } from "./contexts/UrgentNotificationContext";
import { UrgentNotificationToast } from "./components/UrgentNotificationToast";
import Messages from "./pages/Messages";
import { RealtimeToastNotifier } from "./components/RealtimeToastNotifier";
import Quotations from "./pages/Quotations";
import QuotationDetails from "./pages/QuotationDetails";
import SalesReceipts from "./pages/SalesReceipts";
import Damages from "./pages/Damages";
import InventoryItemDetails from "./pages/InventoryItemDetails";
import Analytics from "./pages/Analytics";
import Bingo from "./pages/Bingo"; // Import the new hidden page
import Returns from "./pages/Returns";
import NewReturn from "./pages/NewReturn";
import ReturnDetails from "./pages/ReturnDetails";
import Repairs from "./pages/Repairs";
import NewRepair from "./pages/NewRepair";
import RepairDetails from "./pages/RepairDetails";
import StressTestCenter from "./pages/StressTestCenter";
import QuotationEditor from "./pages/QuotationEditor";
import InvoiceEditor from "./pages/InvoiceEditor";
import Expenses from "./pages/Expenses";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <SettingsProvider>
            <RealtimeProvider>
              <UrgentNotificationProvider>
                <RealtimeToastNotifier />
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />
                  <Route path="/bingo" element={<Bingo />} /> {/* Hidden Route */}
                  <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/customers" element={<Customers />} />
                    <Route path="/customers/:id" element={<CustomerDetails />} />
                    <Route path="/invoices" element={<Invoices />} />
                    <Route path="/invoices/new" element={<InvoiceEditor />} />
                    <Route path="/invoices/:id" element={<InvoiceDetails />} />
                    <Route path="/invoices/:id/edit" element={<InvoiceEditor />} />
                    <Route path="/receipts" element={<SalesReceipts />} />
                    <Route path="/returns" element={<Returns />} />
                    <Route path="/returns/new" element={<NewReturn />} />
                    <Route path="/returns/:id" element={<ReturnDetails />} />
                    <Route path="/repairs" element={<Repairs />} />
                    <Route path="/repairs/new" element={<NewRepair />} />
                    <Route path="/repairs/:id" element={<RepairDetails />} />
                    <Route path="/quotations" element={<Quotations />} />
                    <Route path="/quotations/new" element={<QuotationEditor />} />
                    <Route path="/quotations/:id" element={<QuotationDetails />} />
                    <Route path="/quotations/:id/edit" element={<QuotationEditor />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/inventory/:id" element={<InventoryItemDetails />} />
                    <Route path="/purchases" element={<Purchases />} />
                    <Route path="/expenses" element={<Expenses />} />
                    <Route path="/damages" element={<Damages />} />
                    <Route path="/tasks" element={<Tasks />} />
                    <Route path="/tasks/:id" element={<TaskDetails />} />
                    <Route path="/messages" element={<Messages />} />
                    <Route path="/messages/:conversationId" element={<Messages />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/settings/app" element={<AppSettings />} />
                    <Route path="/settings/api" element={<ApiSettings />} />
                    <Route path="/settings/api/docs" element={<ApiDocs />} />
                    <Route path="/settings/stress-test" element={<StressTestCenter />} />
                    <Route path="/settings/profile" element={<ProfileSettings />} />
                    <Route path="/settings/roles" element={<Roles />} />
                    <Route path="/settings/employees" element={<Employees />} />
                  </Route>
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <UrgentNotificationToast />
              </UrgentNotificationProvider>
            </RealtimeProvider>
          </SettingsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;