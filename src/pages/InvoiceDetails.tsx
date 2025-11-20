import React, { useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CreditCard, Loader2, Edit, Undo2 } from "lucide-react";
import type { Invoice, Transaction } from "@/types";
import { InvoiceTemplate } from "@/components/InvoiceTemplate";
import { showSuccess, showError } from "@/utils/toast";
import { authenticatedFetch } from "@/lib/api";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ReceivePaymentDialog } from "@/components/ReceivePaymentDialog";
import { PrintControl } from "@/components/PrintControl";
import { usePermissions } from "@/hooks/usePermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocumentTimeline } from "@/components/DocumentTimeline";
import { BundleContentsCard } from "@/components/BundleContentsCard";

interface InvoiceData {
  invoice: Invoice;
  transactions: Transaction[];
  customerBalance: number;
}

const InvoiceDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const navigate = useNavigate();
  const canEdit = usePermissions('invoices:edit:details');
  const canCreateReturn = usePermissions('returns:create');

  const { data, isLoading } = useQuery<InvoiceData>({
    queryKey: ['invoice', id],
    queryFn: async () => {
      if (!id) throw new Error("No invoice ID provided");
      const data = await authenticatedFetch(`/api/invoices/${id}`);
      const rawInvoice = data.invoice;
      return {
        invoice: {
          ...rawInvoice,
          customerId: rawInvoice.customer_id,
          invoiceNumber: rawInvoice.invoice_number,
          customerName: rawInvoice.customer_name,
          customerAddress: rawInvoice.customerAddress,
          customerPhone: rawInvoice.customerPhone,
          customerSecondaryPhone: rawInvoice.customerSecondaryPhone,
          issueDate: rawInvoice.issue_date,
          dueDate: rawInvoice.due_date,
          lineItems: JSON.parse(rawInvoice.line_items),
          createdAt: rawInvoice.created_at,
          creatorName: rawInvoice.creator_name,
          deliveryCharge: rawInvoice.delivery_charge,
          showProductDescriptions: !!rawInvoice.show_product_descriptions,
          termsAndConditions: rawInvoice.terms_and_conditions,
          showPreviousBalance: !!rawInvoice.show_previous_balance,
          showNotes: !!rawInvoice.show_notes,
          showWarranty: !!rawInvoice.show_warranty,
          showWarrantyEndDate: !!rawInvoice.show_warranty_end_date,
        },
        transactions: data.transactions,
        customerBalance: data.customerBalance,
      };
    },
    enabled: !!id,
  });

  const invoice = data?.invoice;
  const customerBalance = data?.customerBalance;

  const paymentMutation = useMutation({
    mutationFn: (paymentData: any) => authenticatedFetch(`/api/invoices/${id}/payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    }),
    onSuccess: () => {
      showSuccess("Payment received successfully!");
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] }); // Invalidate all customers to update balances list view
      setIsPaymentDialogOpen(false);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const totalPaid = data?.transactions?.reduce((sum, t) => t.type === 'credit' ? sum + t.amount : sum, 0) || 0;
  const remainingBalance = (invoice?.total || 0) - totalPaid;

  if (isLoading) {
    return <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  if (!invoice) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Invoice not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const isReceipt = (data?.transactions?.filter(t => t.type === 'credit').length || 0) > 0;
  const canBeReturned = isReceipt && invoice.return_status !== 'Fully Returned';

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon"><Link to={isReceipt ? "/receipts" : "/invoices"}><ArrowLeft className="h-4 w-4" /></Link></Button>
            <h1 className="text-2xl font-bold tracking-tight">{isReceipt ? 'Sales Receipt' : 'Invoice'} {invoice.invoiceNumber}</h1>
          </div>
          <div className="flex gap-2">
            <PrintControl documentRef={printRef} fileName={`${isReceipt ? 'Receipt' : 'Invoice'}-${invoice.invoiceNumber}`} />
            {canEdit && (
              <Button onClick={() => navigate(`/invoices/${id}/edit`)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {invoice.status !== 'Paid' && (
              <Button onClick={() => setIsPaymentDialogOpen(true)}>
                <CreditCard className="mr-2 h-4 w-4" />
                Receive Payment
              </Button>
            )}
            {canCreateReturn && canBeReturned && (
              <Button onClick={() => navigate('/returns/new', { state: { invoiceId: invoice.id } })}>
                <Undo2 className="mr-2 h-4 w-4" />
                Create Return
              </Button>
            )}
          </div>
        </div>
        <Tabs defaultValue="document">
          <TabsList>
            <TabsTrigger value="document">Document</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>
          <TabsContent value="document" className="space-y-6">
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <InvoiceTemplate 
                  ref={printRef} 
                  invoice={invoice} 
                  transactions={data.transactions}
                  isReceipt={isReceipt}
                  totalPaid={totalPaid}
                  customerBalance={customerBalance}
                />
              </CardContent>
            </Card>
            <BundleContentsCard lineItems={invoice.lineItems} />
          </TabsContent>
          <TabsContent value="timeline">
            <Card>
              <CardContent className="p-6">
                <DocumentTimeline documentId={invoice.id} documentType="invoice" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <ReceivePaymentDialog
        isOpen={isPaymentDialogOpen}
        onOpenChange={setIsPaymentDialogOpen}
        onConfirm={(values) => paymentMutation.mutate(values)}
        isProcessing={paymentMutation.isPending}
        invoiceNumber={invoice.invoiceNumber}
        remainingBalance={remainingBalance > 0 ? remainingBalance : 0}
      />
    </>
  );
};

export default InvoiceDetails;