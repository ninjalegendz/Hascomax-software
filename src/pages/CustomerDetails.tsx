import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, DollarSign, Users, Link as LinkIcon, X, CreditCard, FileQuestion, Send } from "lucide-react";
import type { Customer, Invoice } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateSafe } from "@/utils/date";
import { LinkCustomerDialog } from "@/components/LinkCustomerDialog";
import { useCustomerDetails, useLinkCustomer, useUnlinkCustomer } from "@/hooks/useCustomerDetails";
import { usePermissions } from "@/hooks/usePermissions";
import { useCurrency } from "@/hooks/useCurrency";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReceiveBulkPaymentDialog } from "@/components/ReceiveBulkPaymentDialog";
import { SendPaymentDialog } from "@/components/SendPaymentDialog";
import { CustomerActivityTimeline } from "@/components/CustomerActivityTimeline";

const statusVariantMap: Record<Invoice["status"], "default" | "secondary" | "destructive" | "outline"> = {
  "Paid": "default",
  "Partially Paid": "secondary",
  "Sent": "secondary",
  "Draft": "outline",
  "Overdue": "destructive",
};

const returnStatusVariantMap: Record<NonNullable<Invoice["return_status"]>, "default" | "secondary" | "destructive" | "outline"> = {
  "None": "outline",
  "Partially Returned": "secondary",
  "Fully Returned": "destructive",
};

const CustomerDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { format } = useCurrency();

  const { data, isLoading, error } = useCustomerDetails(id);
  const linkMutation = useLinkCustomer();
  const unlinkMutation = useUnlinkCustomer();

  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [isBulkPaymentOpen, setIsBulkPaymentOpen] = useState(false);
  const [isSendPaymentOpen, setIsSendPaymentOpen] = useState(false);

  const customer = data?.customer;
  const allCustomers = data?.allCustomers || [];
  const invoices = data?.invoices || [];
  const transactions = data?.transactions || [];
  const quotations = data?.quotations || [];

  const canManageLinks = usePermissions('customers:manage:links');
  const canViewFinancials = usePermissions('customers:view:financials');

  const handleLinkCustomer = (targetCustomerId: string) => {
    if (!customer) return;
    linkMutation.mutate({ sourceCustomer: customer, targetCustomerId });
  };

  const handleUnlinkCustomer = (targetCustomerId: string) => {
    if (!customer) return;
    unlinkMutation.mutate({ sourceCustomer: customer, targetCustomerId });
  };

  const linkedAccounts = customer?.linkedAccountIds?.map(linkedId => allCustomers.find(c => c.id === linkedId)).filter((c): c is Customer => c !== undefined) || [];

  const pendingInvoices = invoices.filter(i => ['Draft', 'Sent', 'Overdue'].includes(i.status));
  const salesReceipts = invoices.filter(i => ['Paid', 'Partially Paid'].includes(i.status));

  if (isLoading) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold">Loading customer data...</h2>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Error loading customer or customer not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/customers"><ArrowLeft className="mr-2 h-4 w-4" />Back to Customers</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="outline" size="icon"><Link to="/customers"><ArrowLeft className="h-4 w-4" /></Link></Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Back to Customers</p>
            </TooltipContent>
          </Tooltip>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canViewFinancials && customer.balance > 0 && (
            <Button onClick={() => setIsSendPaymentOpen(true)} variant="outline">
              <Send className="mr-2 h-4 w-4" />
              Send Payment
            </Button>
          )}
          {canViewFinancials && (
            <Button onClick={() => setIsBulkPaymentOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Receive Payment
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {canViewFinancials && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Current Balance</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${customer.balance < 0 ? 'text-destructive' : ''}`}>{format(customer.balance)}</div>
              <p className="text-xs text-muted-foreground">{customer.balance < 0 ? 'Debit Balance' : 'Credit Balance'}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Account Details</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant={customer.status === "Active" ? "default" : "outline"}>{customer.status}</Badge></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Phone</span><span>{customer.phone}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Address</span><span className="text-right">{customer.address}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Member Since</span><span>{formatDateSafe(customer.createdAt)}</span></div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Tabs defaultValue="transactions">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="invoices">Invoices ({pendingInvoices.length})</TabsTrigger>
              <TabsTrigger value="receipts">Receipts ({salesReceipts.length})</TabsTrigger>
              <TabsTrigger value="quotations">Quotations ({quotations.length})</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>
            <TabsContent value="transactions">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {transactions.length > 0 ? (transactions.map(t => (<TableRow key={t.id}><TableCell>{formatDateSafe(t.date)}</TableCell><TableCell>{t.description}</TableCell><TableCell className={`text-right font-medium ${t.type === 'debit' ? 'text-destructive' : ''}`}>{format(t.amount)} {t.type === 'debit' ? 'Dr' : 'Cr'}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={3} className="text-center h-24">No transactions found for this period.</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="invoices">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead>Due Date</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {pendingInvoices.length > 0 ? (pendingInvoices.map(i => (<TableRow key={i.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${i.id}`)}><TableCell className="font-medium">{i.invoiceNumber}</TableCell><TableCell><Badge variant={i.status === 'Paid' ? 'default' : i.status === 'Overdue' ? 'destructive' : 'outline'}>{i.status}</Badge></TableCell><TableCell>{formatDateSafe(i.dueDate)}</TableCell><TableCell className="text-right">{format(i.total)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={4} className="text-center h-24">No pending invoices for this customer.</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="receipts">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead>Issue Date</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {salesReceipts.length > 0 ? (salesReceipts.map(i => (<TableRow key={i.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${i.id}`)}><TableCell className="font-medium">{i.invoiceNumber}</TableCell><TableCell><div className="flex flex-col gap-1 items-start"><Badge variant={statusVariantMap[i.status]}>{i.status}</Badge>{i.return_status && i.return_status !== 'None' && (<Badge variant={returnStatusVariantMap[i.return_status]}>{i.return_status.replace(/([A-Z])/g, ' $1').trim()}</Badge>)}</div></TableCell><TableCell>{formatDateSafe(i.issueDate)}</TableCell><TableCell className="text-right">{format(i.total)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={4} className="text-center h-24">No sales receipts for this customer.</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="quotations">
              <Card>
                <CardContent className="pt-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Status</TableHead><TableHead>Issue Date</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {quotations.length > 0 ? (quotations.map(q => (<TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}><TableCell className="font-medium">{q.quotation_number}</TableCell><TableCell><Badge>{q.status}</Badge></TableCell><TableCell>{formatDateSafe(q.issue_date)}</TableCell><TableCell className="text-right">{format(q.total)}</TableCell></TableRow>))) : (<TableRow><TableCell colSpan={4} className="text-center h-24">No quotations for this customer.</TableCell></TableRow>)}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="timeline">
              <CustomerActivityTimeline customerId={customer.id} />
            </TabsContent>
          </Tabs>
        </div>
        <div className="space-y-6">
          {canManageLinks && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2"><Users className="h-5 w-5 text-muted-foreground" /><CardTitle>Linked Accounts</CardTitle></div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => setIsLinkDialogOpen(true)} disabled={linkMutation.isPending || unlinkMutation.isPending}><LinkIcon className="h-4 w-4 mr-2" />Link Account</Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Link this customer to another existing customer.</p>
                    </TooltipContent>
                  </Tooltip>
              </CardHeader>
              <CardContent>
                  {linkedAccounts.length > 0 ? (<ul className="space-y-2">{linkedAccounts.map(acc => (<li key={acc.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50"><div><Link to={`/customers/${acc.id}`} className="font-medium hover:underline">{acc.name}</Link><p className="text-xs text-muted-foreground">{acc.customerNumber}</p></div><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUnlinkCustomer(acc.id)} disabled={linkMutation.isPending || unlinkMutation.isPending}><X className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent><p>Unlink Account</p></TooltipContent></Tooltip></li>))}</ul>) : (<p className="text-sm text-muted-foreground text-center py-4">No linked accounts.</p>)}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      {customer && (
        <LinkCustomerDialog 
          isOpen={isLinkDialogOpen} 
          onOpenChange={setIsLinkDialogOpen} 
          sourceCustomer={customer} 
          allCustomers={allCustomers} 
          onConfirmLink={handleLinkCustomer} 
        />
      )}
      {id && (
        <ReceiveBulkPaymentDialog
          isOpen={isBulkPaymentOpen}
          onOpenChange={setIsBulkPaymentOpen}
          customerId={id}
        />
      )}
      {id && customer && (
        <SendPaymentDialog
          isOpen={isSendPaymentOpen}
          onOpenChange={setIsSendPaymentOpen}
          customerId={id}
          customerName={customer.name}
          maxAmount={customer.balance}
        />
      )}
    </div>
  );
};

export default CustomerDetails;