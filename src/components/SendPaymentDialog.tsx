import React, { useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';

interface SendPaymentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customerId: string;
  customerName: string;
  maxAmount: number;
}

export function SendPaymentDialog({ isOpen, onOpenChange, customerId, customerName, maxAmount }: SendPaymentDialogProps) {
  const queryClient = useQueryClient();
  const { format } = useCurrency();

  const sendPaymentSchema = z.object({
    amount: z.coerce.number().positive("Amount must be greater than zero.").max(maxAmount, `Amount cannot exceed customer credit of ${format(maxAmount)}.`),
    payment_date: z.date(),
    payment_method: z.string().min(1, "Payment method is required."),
    notes: z.string().optional(),
  });

  const form = useForm<z.infer<typeof sendPaymentSchema>>({
    resolver: zodResolver(sendPaymentSchema),
    defaultValues: { payment_date: new Date(), amount: maxAmount > 0 ? maxAmount : 0 },
  });

  const { data: paymentMethods } = useQuery<any[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: isOpen,
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        payment_date: new Date(),
        amount: maxAmount > 0 ? maxAmount : 0,
        payment_method: paymentMethods?.[0]?.name || '',
        notes: '',
      });
    }
  }, [isOpen, maxAmount, form, paymentMethods]);

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof sendPaymentSchema>) => authenticatedFetch(`/api/customers/${customerId}/send-payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      showSuccess("Payment sent successfully!");
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      onOpenChange(false);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const onSubmit = (values: z.infer<typeof sendPaymentSchema>) => {
    mutation.mutate(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Payment to {customerName}</DialogTitle>
          <DialogDescription>
            Refund customer credit. The maximum refundable amount is {format(maxAmount)}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>Amount to Send</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="payment_date" render={({ field }) => <FormItem><FormLabel>Payment Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>} />
              <FormField control={form.control} name="payment_method" render={({ field }) => <FormItem><FormLabel>Payment Method</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a method" /></SelectTrigger></FormControl><SelectContent>{paymentMethods?.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea placeholder="e.g., Refund for overpayment on INV-0012" {...field} /></FormControl><FormMessage /></FormItem>} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & Send
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}