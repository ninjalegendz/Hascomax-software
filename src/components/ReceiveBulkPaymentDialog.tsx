import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/datepicker';
import { useCurrency } from '@/hooks/useCurrency';
import { authenticatedFetch } from '@/lib/api';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { formatDateSafe } from '@/utils/date';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface UnpaidInvoice {
  id: string;
  invoice_number: string;
  issue_date: string;
  total: number;
  amount_due: number;
}

const paymentSchema = z.object({
  payment_date: z.date(),
  payment_method: z.string().min(1, "Payment method is required."),
});

interface ReceiveBulkPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customerId: string;
}

export function ReceiveBulkPaymentDialog({ isOpen, onOpenChange, customerId }: ReceiveBulkPaymentDialogProps) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [chequeNumber, setChequeNumber] = useState('');

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_date: new Date(), payment_method: '' },
  });

  const { data: invoices, isLoading } = useQuery<UnpaidInvoice[]>({
    queryKey: ['unpaidInvoices', customerId],
    queryFn: () => authenticatedFetch(`/api/customers/${customerId}/unpaid-invoices`),
    enabled: isOpen && !!customerId,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => authenticatedFetch(`/api/customers/${customerId}/receive-payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      showSuccess("Payment recorded successfully!");
      queryClient.invalidateQueries({ queryKey: ['unpaidInvoices', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      onOpenChange(false);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ payment_date: new Date(), payment_method: paymentMethods?.[0]?.name || '' });
      setChequeNumber('');
    } else {
      setAllocations({});
    }
  }, [isOpen, form, paymentMethods]);

  const totalAllocated = useMemo(() => {
    return Object.values(allocations).reduce((sum, amount) => sum + (parseFloat(amount) || 0), 0);
  }, [allocations]);

  const handleAllocationChange = (invoiceId: string, value: string, max: number) => {
    const numericValue = parseFloat(value);
    if (!isNaN(numericValue) && numericValue > max) {
      setAllocations(prev => ({ ...prev, [invoiceId]: String(max) }));
    } else {
      setAllocations(prev => ({ ...prev, [invoiceId]: value }));
    }
  };

  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    const payments = Object.entries(allocations)
      .map(([invoiceId, amountStr]) => ({
        invoiceId,
        amount: parseFloat(amountStr) || 0,
      }))
      .filter(p => p.amount > 0);

    if (payments.length === 0) {
      showError("Please allocate a payment amount to at least one invoice.");
      return;
    }

    mutation.mutate({ ...values, payments, cheque_number: chequeNumber });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Receive Payment</DialogTitle>
          <DialogDescription>Record a payment and apply it to outstanding invoices.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="payment_date" render={({ field }) => <FormItem><FormLabel>Payment Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="payment_method" render={({ field }) => <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger></FormControl><SelectContent>{paymentMethods?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
              {form.watch('payment_method').toLowerCase() === 'cheque' && (
                <FormItem>
                  <FormLabel>Cheque Number</FormLabel>
                  <FormControl>
                    <Input value={chequeNumber} onChange={(e) => setChequeNumber(e.target.value)} placeholder="Enter cheque number" />
                  </FormControl>
                </FormItem>
              )}
            </div>
            
            <h4 className="font-medium">Allocate Payment</h4>
            <ScrollArea className="h-64 border rounded-md">
              {isLoading ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice #</TableHead><TableHead>Date</TableHead><TableHead>Amount Due</TableHead><TableHead className="w-40">Payment</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {invoices?.map(inv => (
                      <TableRow key={inv.id}>
                        <TableCell>{inv.invoice_number}</TableCell>
                        <TableCell>{formatDateSafe(inv.issue_date)}</TableCell>
                        <TableCell>{format(inv.amount_due)}</TableCell>
                        <TableCell>
                          <Input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00"
                            value={allocations[inv.id] || ''}
                            onChange={(e) => handleAllocationChange(inv.id, e.target.value, inv.amount_due)}
                            max={inv.amount_due}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
            <div className="text-right font-semibold">
              Total Allocated: {format(totalAllocated)}
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={mutation.isPending || totalAllocated === 0}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Payment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}