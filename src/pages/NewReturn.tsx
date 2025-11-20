import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, PlusCircle, Trash2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrency } from '@/hooks/useCurrency';
import { showError, showSuccess } from '@/utils/toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { Invoice, LineItem } from '@/types';
import { Combobox } from '@/components/ui/combobox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface EligibleInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
}

interface InvoiceForReturn extends Invoice {
  lineItems: (LineItem & { quantity_returned: number })[];
}

type ReturnItem = {
  lineItemId: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  maxReturnable: number;
};

type RefundPayment = {
  id: string;
  amount: string;
  method: string;
};

type ReturnExpense = {
  id: string;
  description: string;
  amount: string;
};

const NewReturn = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { format } = useCurrency();

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [itemsToReturn, setItemsToReturn] = useState<ReturnItem[]>([]);
  const [deliveryRefund, setDeliveryRefund] = useState<string>('');
  const [refundPayments, setRefundPayments] = useState<RefundPayment[]>([]);
  const [returnExpenses, setReturnExpenses] = useState<ReturnExpense[]>([]);
  const [notes, setNotes] = useState('');
  const [restockItems, setRestockItems] = useState(true);

  useEffect(() => {
    if (location.state?.invoiceId) {
      setSelectedInvoiceId(location.state.invoiceId);
    }
  }, [location.state]);

  const { data: eligibleInvoices, isLoading: isLoadingInvoices } = useQuery<EligibleInvoice[]>({
    queryKey: ['eligibleInvoicesForReturn'],
    queryFn: () => authenticatedFetch('/api/returns/eligible-invoices'),
    enabled: !!profile,
  });

  const { data: invoiceDetails, isLoading: isLoadingInvoiceDetails } = useQuery<InvoiceForReturn>({
    queryKey: ['invoiceForReturn', selectedInvoiceId],
    queryFn: () => authenticatedFetch(`/api/returns/invoice-details/${selectedInvoiceId}`),
    enabled: !!selectedInvoiceId,
  });

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: !!profile,
  });

  const allPaymentMethods = useMemo(() => {
    const methods = paymentMethods || [];
    return [{ id: 'credits', name: 'Credits' }, ...methods];
  }, [paymentMethods]);

  useEffect(() => {
    if (invoiceDetails) {
      setItemsToReturn(invoiceDetails.lineItems.map(item => ({
        lineItemId: item.id,
        productId: item.product_id || `custom-${item.id}`,
        description: item.description,
        quantity: 0,
        unitPrice: item.unitPrice,
        maxReturnable: item.quantity - item.quantity_returned,
      })));
      setDeliveryRefund('0');
      if (allPaymentMethods.length > 0) {
        setRefundPayments([{ id: crypto.randomUUID(), amount: '0.00', method: allPaymentMethods[0].name }]);
      }
      setReturnExpenses([]);
    }
  }, [invoiceDetails, allPaymentMethods]);

  const maxRefundableAmount = invoiceDetails?.total_paid || 0;

  const totalRefundAmount = useMemo(() => {
    const itemsTotal = itemsToReturn.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    return itemsTotal + (parseFloat(deliveryRefund) || 0);
  }, [itemsToReturn, deliveryRefund]);

  const isRefundAmountExceeded = totalRefundAmount > maxRefundableAmount;

  const handleItemQuantityChange = (productId: string, quantity: number) => {
    setItemsToReturn(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQuantity = Math.max(0, Math.min(quantity, item.maxReturnable));
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const handlePaymentChange = (id: string, field: 'amount' | 'method', value: string) => {
    setRefundPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPaymentLine = () => {
    if (allPaymentMethods.length > 0) {
      setRefundPayments(prev => [...prev, { id: crypto.randomUUID(), amount: '0.00', method: allPaymentMethods[0].name }]);
    }
  };

  const removePaymentLine = (id: string) => {
    setRefundPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleExpenseChange = (id: string, field: 'description' | 'amount', value: string) => {
    setReturnExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const addExpenseLine = () => {
    setReturnExpenses(prev => [...prev, { id: crypto.randomUUID(), description: '', amount: '0.00' }]);
  };

  const removeExpenseLine = (id: string) => {
    setReturnExpenses(prev => prev.filter(e => e.id !== id));
  };

  const returnMutation = useMutation({
    mutationFn: (returnData: any) => authenticatedFetch('/api/returns', {
      method: 'POST',
      body: JSON.stringify(returnData),
    }),
    onSuccess: () => {
      showSuccess('Return processed successfully!');
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/returns');
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const handleSubmitReturn = () => {
    if (!selectedInvoiceId) return;
    const items = itemsToReturn
      .filter(item => item.quantity > 0)
      .map(item => ({
        lineItemId: item.lineItemId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        description: item.description,
      }));
      
    if (items.length === 0 && (parseFloat(deliveryRefund) || 0) <= 0) {
      showError('You must return at least one item or refund a delivery charge.');
      return;
    }

    if (isRefundAmountExceeded) {
      showError(`Total refund amount (${format(totalRefundAmount)}) cannot exceed the total amount paid on the invoice (${format(maxRefundableAmount)}).`);
      return;
    }

    const payments = refundPayments.map(p => ({ amount: parseFloat(p.amount) || 0, method: p.method })).filter(p => p.amount > 0);
    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    if (totalPaid > totalRefundAmount) {
      showError('Total payment cannot exceed the total refund amount.');
      return;
    }
    const expenses = returnExpenses.map(e => ({ description: e.description, amount: parseFloat(e.amount) || 0 })).filter(e => e.amount > 0 && e.description);

    returnMutation.mutate({
      originalInvoiceId: selectedInvoiceId,
      items,
      deliveryChargeRefund: parseFloat(deliveryRefund) || 0,
      payments,
      expenses,
      notes,
      totalRefundAmount,
      restockItems,
    });
  };

  const invoiceOptions = useMemo(() => {
    return eligibleInvoices?.map(inv => ({
      value: inv.id,
      label: `${inv.invoice_number} - ${inv.customer_name}`
    })) || [];
  }, [eligibleInvoices]);

  if (!selectedInvoiceId) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create a New Return</CardTitle>
          <CardContent className="pt-6">
            <Label>Select a Sales Receipt to Return</Label>
            {isLoadingInvoices ? (
              <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <Combobox
                options={invoiceOptions}
                value={selectedInvoiceId}
                onChange={setSelectedInvoiceId}
                placeholder="Select a receipt..."
                searchPlaceholder="Search by receipt # or customer..."
                emptyMessage="No eligible receipts found."
              />
            )}
          </CardContent>
        </CardHeader>
      </Card>
    );
  }

  if (isLoadingInvoiceDetails || !invoiceDetails) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => setSelectedInvoiceId('')}><ArrowLeft className="h-4 w-4" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Return for Receipt {invoiceDetails.invoiceNumber}</h1>
          <p className="text-muted-foreground">Customer: {invoiceDetails.customerName}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Items to Return</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Price</TableHead><TableHead>Max Returnable</TableHead><TableHead className="w-40">Return Qty</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>
              {itemsToReturn.map(item => (
                <TableRow key={item.productId}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{format(item.unitPrice)}</TableCell>
                  <TableCell>{item.maxReturnable}</TableCell>
                  <TableCell>
                    <Input type="number" value={item.quantity} onChange={e => handleItemQuantityChange(item.productId, parseInt(e.target.value) || 0)} max={item.maxReturnable} />
                  </TableCell>
                  <TableCell className="text-right">{format(item.quantity * item.unitPrice)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Refund & Expense Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {invoiceDetails.deliveryCharge > 0 && (
              <div className="space-y-2">
                <Label>Delivery Charge Refund (Max: {format(invoiceDetails.deliveryCharge)})</Label>
                <Input type="number" value={deliveryRefund} onChange={e => setDeliveryRefund(e.target.value)} max={invoiceDetails.deliveryCharge} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Additional Expenses (e.g., return shipping)</Label>
              {returnExpenses.map((expense) => (
                <div key={expense.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                  <Input placeholder="Expense Description" value={expense.description} onChange={(e) => handleExpenseChange(expense.id, 'description', e.target.value)} />
                  <Input type="number" placeholder="Amount" value={expense.amount} onChange={(e) => handleExpenseChange(expense.id, 'amount', e.target.value)} />
                  <Button variant="ghost" size="icon" onClick={() => removeExpenseLine(expense.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addExpenseLine}><PlusCircle className="mr-2 h-4 w-4" />Add Expense</Button>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Reason for return..." />
            </div>
            <div className="flex items-center space-x-2 pt-4">
              <Switch id="restock-items" checked={restockItems} onCheckedChange={setRestockItems} />
              <Label htmlFor="restock-items">Add returned items back to stock?</Label>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment Method</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {refundPayments.map((payment) => (
              <div key={payment.id} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                <Input type="number" placeholder="Amount" value={payment.amount} onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)} />
                <Select value={payment.method} onValueChange={(value) => handlePaymentChange(payment.id, 'method', value)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{allPaymentMethods?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" onClick={() => removePaymentLine(payment.id)} disabled={refundPayments.length === 1}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addPaymentLine}><PlusCircle className="mr-2 h-4 w-4" />Add Payment Method</Button>
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-2 pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Max Refundable:</span>
              <span>{format(maxRefundableAmount)}</span>
            </div>
            <div className={cn("flex justify-between font-bold text-lg", isRefundAmountExceeded && "text-destructive")}>
              <span>Total Refund:</span>
              <span>{format(totalRefundAmount)}</span>
            </div>
            {isRefundAmountExceeded && (
              <p className="text-xs text-destructive text-center">The refund amount exceeds the amount paid by the customer.</p>
            )}
            <Button size="lg" onClick={handleSubmitReturn} disabled={returnMutation.isPending || isRefundAmountExceeded}>
              {returnMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process Return
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default NewReturn;