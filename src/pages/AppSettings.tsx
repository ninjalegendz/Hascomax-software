import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Link, useNavigate } from "react-router-dom";
import { showError, showSuccess, showLoading, dismissToast } from "@/utils/toast";
import { authenticatedFetch } from "@/lib/api";
import { TestTube2, Loader2, Code } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useSettings, type AppSettings } from "@/contexts/SettingsContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { PaymentMethodsManager } from "@/components/PaymentMethodsManager";
import { CourierManager } from "@/components/CourierManager";

const settingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required.'),
  companyAddress: z.string().min(1, 'Company address is required.'),
  companyLogoUrl: z.string().url().optional().or(z.literal('')),
  companyLogoSize: z.coerce.number().int().min(20, 'Logo size must be at least 20px.').max(200, 'Logo size cannot exceed 200px.'),
  invoiceFooter: z.string().optional(),
  currency: z.string().min(1, 'Currency symbol is required.'),
  defaultInvoiceNotes: z.string().optional(),
  defaultInvoiceTerms: z.string().optional(),
  invoicePrefix: z.string().min(1, 'Invoice prefix is required.'),
  nextInvoiceNumber: z.coerce.number().int().min(1, 'Next invoice number must be at least 1.'),
  quotationPrefix: z.string().min(1, 'Quotation prefix is required.'),
  nextQuotationNumber: z.coerce.number().int().min(1, 'Next quotation number must be at least 1.'),
  nextReturnNumber: z.coerce.number().int().min(1, 'Next return number must be at least 1.'),
  defaultDueDateDays: z.coerce.number().int().min(0, 'Due date days cannot be negative.'),
  showPreviousBalanceOnReceipt: z.boolean(),
  isSystemSleeping: z.boolean(),
  autoWakeUpTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Invalid time format (HH:MM)"),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const AppSettings = () => {
  const navigate = useNavigate();
  
  const { settings, updateSettings, isLoading, isUpdating } = useSettings();
  const canViewEmployees = usePermissions('employees:view');
  const canViewRoles = usePermissions('roles:view');
  const canManagePaymentMethods = usePermissions('settings:manage:payment-methods');
  const canManageCouriers = usePermissions('settings:manage:couriers');
  const canClearData = usePermissions('settings:manage:clear');
  const canStressTest = usePermissions('settings:manage:stress-test');
  const canManageSystemStatus = usePermissions('settings:manage:system-status');
  const canManageApiKeys = usePermissions('settings:manage:api-keys');

  const form = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: '',
      companyAddress: '',
      companyLogoUrl: '',
      companyLogoSize: 80,
      invoiceFooter: '',
      currency: '$',
      defaultInvoiceNotes: '',
      defaultInvoiceTerms: '',
      invoicePrefix: 'INV-',
      nextInvoiceNumber: 1,
      quotationPrefix: 'QUO-',
      nextQuotationNumber: 1,
      nextReturnNumber: 1,
      defaultDueDateDays: 30,
      showPreviousBalanceOnReceipt: true,
      isSystemSleeping: false,
      autoWakeUpTime: '08:00',
    }
  });

  useEffect(() => {
    if (settings) {
      const { paymentMethods, ...rest } = settings;
      form.reset(rest);
    }
  }, [settings, form]);

  const onSubmit = (values: SettingsFormValues) => {
    const fullSettings: AppSettings = { ...settings, ...values, paymentMethods: settings?.paymentMethods || '' };
    updateSettings(fullSettings);
  };

  const handleClearData = async () => {
    const toastId = showLoading("Clearing all data...");
    try {
      await authenticatedFetch('/api/clear-data', { method: 'DELETE' });
      dismissToast(toastId);
      showSuccess('All application data has been cleared successfully.');
      navigate('/');
    } catch (error) {
      dismissToast(toastId);
      showError((error as Error).message);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="grid gap-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>App Settings</CardTitle>
              <CardDescription>Manage application-wide settings and data.</CardDescription>
            </CardHeader>
          </Card>

          {canManageSystemStatus && (
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
                <CardDescription>Control system-wide access for non-admin users.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="isSystemSleeping"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">System Sleep</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          When enabled, only admins can access the application.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="autoWakeUpTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto Wake-up Time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} className="w-40" />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground">
                        The system will automatically wake up at this time if it's asleep.
                      </p>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {(canViewEmployees || canViewRoles) && (
            <Card>
              <CardHeader><CardTitle>Management</CardTitle></CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-semibold">User Management</h3>
                    <p className="text-sm text-muted-foreground">Manage employee accounts and their permissions.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {canViewEmployees && <Button asChild variant="outline" className="w-full sm:w-auto"><Link to="/settings/employees">Manage Employees</Link></Button>}
                    {canViewRoles && <Button asChild className="w-full sm:w-auto"><Link to="/settings/roles">Manage Roles</Link></Button>}
                  </div>
                </div>
                {canManageApiKeys && (
                  <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold">API Access</h3>
                      <p className="text-sm text-muted-foreground">Manage API keys for programmatic access.</p>
                    </div>
                    <Button asChild className="w-full sm:w-auto"><Link to="/settings/api"><Code className="mr-2 h-4 w-4" />Manage API Keys</Link></Button>
                  </div>
                )}
                {canManagePaymentMethods && <PaymentMethodsManager />}
                {canManageCouriers && <CourierManager />}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Business Information</CardTitle><CardDescription>Set your company details that will appear on documents.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="companyName" render={({ field }) => <FormItem><FormLabel>Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="currency" render={({ field }) => <FormItem><FormLabel>Currency Symbol</FormLabel><FormControl><Input {...field} className="w-20" /></FormControl><FormMessage /></FormItem>} />
              </div>
              <FormField control={form.control} name="companyAddress" render={({ field }) => <FormItem><FormLabel>Company Address</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="companyLogoUrl" render={({ field }) => <FormItem><FormLabel>Company Logo URL</FormLabel><FormControl><Input {...field} placeholder="https://example.com/logo.png" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="companyLogoSize" render={({ field }) => <FormItem><FormLabel>Logo Size (height in px)</FormLabel><FormControl><Input type="number" {...field} className="w-24" /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="invoiceFooter" render={({ field }) => <FormItem><FormLabel>Document Footer</FormLabel><FormControl><Textarea {...field} rows={2} placeholder="e.g., Registered in Country | Company No. 123456" /></FormControl><FormMessage /></FormItem>} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Document & Transaction Settings</CardTitle><CardDescription>Customize invoices, quotations, and payments.</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-medium">Numbering</h4>
                  <FormField control={form.control} name="invoicePrefix" render={({ field }) => <FormItem><FormLabel>Invoice Prefix</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="nextInvoiceNumber" render={({ field }) => <FormItem><FormLabel>Next Invoice Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="quotationPrefix" render={({ field }) => <FormItem><FormLabel>Quotation Prefix</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="nextQuotationNumber" render={({ field }) => <FormItem><FormLabel>Next Quotation Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="nextReturnNumber" render={({ field }) => <FormItem><FormLabel>Next Return Number</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                </div>
                <div className="space-y-4">
                  <h4 className="font-medium">Defaults</h4>
                  <FormField control={form.control} name="defaultDueDateDays" render={({ field }) => <FormItem><FormLabel>Payment Due (Days)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="defaultInvoiceNotes" render={({ field }) => <FormItem><FormLabel>Default Notes</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="defaultInvoiceTerms" render={({ field }) => <FormItem><FormLabel>Default Terms & Conditions</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>} />
                </div>
              </div>
              <div className="pt-6 border-t">
                <FormField control={form.control} name="showPreviousBalanceOnReceipt" render={({ field }) => <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4"><div className="space-y-0.5"><FormLabel className="text-base">Show Previous Balance</FormLabel><p className="text-sm text-muted-foreground">Display the customer's previous outstanding balance on sales receipts.</p></div><FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>} />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save All Settings
            </Button>
          </div>

          {(canStressTest || canClearData) && (
            <Card>
              <CardHeader><CardTitle>Data Management</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {canStressTest && (
                  <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
                    <div><h3 className="font-semibold">Stress Test Center</h3><p className="text-sm text-muted-foreground">Advanced tools to test application performance and reliability.</p></div>
                    <Button asChild type="button" className="w-full sm:w-auto"><Link to="/settings/stress-test"><TestTube2 className="mr-2 h-4 w-4" />Go to Center</Link></Button>
                  </div>
                )}
                {canClearData && (
                  <div className="flex flex-col gap-4 text-center sm:text-left sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg bg-destructive/10 border-destructive/50">
                    <div><h3 className="font-semibold">Clear Application Data</h3><p className="text-sm text-muted-foreground">Permanently delete all transactional data.</p></div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button type="button" variant="destructive" className="w-full sm:w-auto">Clear Data</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete all your business data. Your account and roles will not be affected.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90">Yes, delete all data</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
};

export default AppSettings;