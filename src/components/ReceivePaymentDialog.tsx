import React, { useState, useMemo, useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/datepicker';
import { useCurrency } from '@/hooks/useCurrency';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { PlusCircle, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

type Payment = { id: string; amount: string; method: string; chequeNumber?: string };

const paymentSchema = z.object({
  payment_date: z.date(),
});

interface ReceivePaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (values: { payment_date: Date, payments: { amount: number, method: string, chequeNumber?: string }[] }) => void;
  isProcessing: boolean;
  invoiceNumber: string;
  remainingBalance: number;
}

export function ReceivePaymentDialog({ isOpen, onOpenChange, onConfirm, isProcessing, invoiceNumber, remainingBalance }: ReceivePaymentDialogProps) {
  const { format } = useCurrency();
  const [payments, setPayments] = useState<Payment[]>([]);

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { payment_date: new Date() },
  });

  const totalPaid = useMemo(() => payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0), [payments]);
  const amountDue = useMemo(() => remainingBalance - totalPaid, [remainingBalance, totalPaid]);

  useEffect(() => {
    if (isOpen) {
      form.reset({ payment_date: new Date() });
      if (paymentMethods && paymentMethods.length > 0) {
        setPayments([{ id: crypto.randomUUID(), amount: String(remainingBalance), method: paymentMethods[0].name, chequeNumber: '' }]);
      } else {
        setPayments([{ id: crypto.randomUUID(), amount: String(remainingBalance), method: '', chequeNumber: '' }]);
      }
    }
  }, [isOpen, remainingBalance, form, paymentMethods]);

  const handlePaymentChange = (id: string, field: 'amount' | 'method' | 'chequeNumber', value: string) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const addPaymentLine = () => {
    if (amountDue > 0 && paymentMethods) {
      setPayments(prev => [...prev, { id: crypto.randomUUID(), amount: String(amountDue.toFixed(2)), method: paymentMethods[0]?.name || '', chequeNumber: '' }]);
    }
  };

  const removePaymentLine = (id: string) => {
    setPayments(prev => prev.filter(p => p.id !== id));
  };

  const handleSubmit = (values: z.infer<typeof paymentSchema>) => {
    const processedPayments = payments.map(p => ({ amount: parseFloat(p.amount) || 0, method: p.method, chequeNumber: p.chequeNumber })).filter(p => p.amount > 0);
    onConfirm({ payment_date: values.payment_date, payments: processedPayments });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Payment for Invoice {invoiceNumber}</DialogTitle>
          <DialogDescription>
            The remaining balance on this invoice is {format(remainingBalance)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="payment_date" render={({ field }) => <FormItem><FormLabel>Payment Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>} />
            
            <div className="space-y-4">
              <Label>Payment Details</Label>
              {payments.map((payment) => (
                <div key={payment.id} className="space-y-2 p-2 border rounded-md">
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <Input type="number" placeholder="Amount" value={payment.amount} onChange={(e) => handlePaymentChange(payment.id, 'amount', e.target.value)} />
                    <Select value={payment.method} onValueChange={(value) => handlePaymentChange(payment.id, 'method', value)}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{paymentMethods?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => removePaymentLine(payment.id)} disabled={payments.length === 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {payment.method.toLowerCase() === 'cheque' && (
                    <div className="pl-1">
                      <Label htmlFor={`cheque-${payment.id}`}>Cheque Number</Label>
                      <Input id={`cheque-${payment.id}`} placeholder="Enter cheque number" value={payment.chequeNumber || ''} onChange={(e) => handlePaymentChange(payment.id, 'chequeNumber', e.target.value)} />
                    </div>
                  )}
                </div>
              ))}
              {amountDue > 0.009 && <Button type="button" variant="outline" size="sm" onClick={addPaymentLine}><PlusCircle className="mr-2 h-4 w-4" />Add Another Payment</Button>}
            </div>

            <div className={cn("text-center p-2 bg-muted rounded-md font-medium", amountDue < 0 && 'text-green-600', amountDue > 0 && 'text-destructive')}>
              {amountDue < 0 ? `Overpayment / Credit: ${format(Math.abs(amountDue))}` : `Remaining Due: ${format(amountDue)}`}
            </div>

            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isProcessing || totalPaid <= 0}>
                {isProcessing ? 'Processing...' : 'Confirm Payment'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}