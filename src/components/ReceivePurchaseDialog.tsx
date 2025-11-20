import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import type { Purchase, PurchaseReceipt } from '@/types';
import { formatDateSafe } from '@/utils/date';

const receiveSchema = z.object({
  quantity_received: z.coerce.number().int().min(0, "Cannot be negative."),
  quantity_damaged: z.coerce.number().int().min(0, "Cannot be negative."),
});

interface ReceivePurchaseDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  purchase: Purchase | null;
}

export function ReceivePurchaseDialog({ isOpen, onOpenChange, purchase }: ReceivePurchaseDialogProps) {
  const queryClient = useQueryClient();
  const [maxReceivable, setMaxReceivable] = useState(0);

  const { data: receipts, isLoading: isLoadingReceipts } = useQuery<PurchaseReceipt[]>({
    queryKey: ['purchaseReceipts', purchase?.id],
    queryFn: () => authenticatedFetch(`/api/purchases/${purchase!.id}/receipts`),
    enabled: isOpen && !!purchase,
  });

  const form = useForm<z.infer<typeof receiveSchema>>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { quantity_received: 0, quantity_damaged: 0 },
  });

  useEffect(() => {
    if (purchase) {
      const remaining = purchase.quantity_purchased - purchase.total_received;
      setMaxReceivable(remaining);
      form.reset({ quantity_received: remaining, quantity_damaged: 0 });
    }
  }, [purchase, form]);

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof receiveSchema>) => authenticatedFetch(`/api/purchases/${purchase!.id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    onSuccess: () => {
      showSuccess("Items received successfully!");
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const onSubmit = (values: z.infer<typeof receiveSchema>) => {
    if (values.quantity_received + values.quantity_damaged > maxReceivable) {
      form.setError("quantity_received", { message: "Total received and damaged cannot exceed quantity remaining." });
      return;
    }
    if (values.quantity_received === 0 && values.quantity_damaged === 0) {
      form.setError("quantity_received", { message: "Must receive or report at least one item." });
      return;
    }
    mutation.mutate(values);
  };

  if (!purchase) return null;

  const isCompleted = purchase.status === 'Completed';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isCompleted ? 'Receiving Details for' : 'Receive Items for'} {purchase.products.name}</DialogTitle>
          <DialogDescription>
            Ordered: {purchase.quantity_purchased} | Received: {purchase.total_received} | Remaining: {maxReceivable}
          </DialogDescription>
        </DialogHeader>
        {isCompleted ? (
          <div className="py-4">
            <div className="p-4 border rounded-md bg-muted/50 text-center mb-6">
              <p className="font-medium">This purchase order is complete.</p>
              <p className="text-sm text-muted-foreground">No more items can be received.</p>
            </div>
            <h4 className="font-semibold mb-2">Receiving History</h4>
            <ScrollArea className="h-64 border rounded-md">
              {isLoadingReceipts ? (
                <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Received</TableHead><TableHead>Damaged</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {receipts?.map(r => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDateSafe(r.received_at, 'PP p')}</TableCell>
                        <TableCell>{r.quantity_received}</TableCell>
                        <TableCell>{r.quantity_damaged}</TableCell>
                        <TableCell>{r.receiver_name}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div>
              <h4 className="font-semibold mb-2">Receive New Items</h4>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="quantity_received" render={({ field }) => <FormItem><FormLabel>Quantity to Receive (adds to stock)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <FormField control={form.control} name="quantity_damaged" render={({ field }) => <FormItem><FormLabel>Damaged Quantity (does not add to stock)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
                  <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Confirm Receipt
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Receiving History</h4>
              <ScrollArea className="h-64 border rounded-md">
                {isLoadingReceipts ? (
                  <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : (
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Received</TableHead><TableHead>Damaged</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {receipts?.map(r => (
                        <TableRow key={r.id}>
                          <TableCell>{formatDateSafe(r.received_at, 'PP p')}</TableCell>
                          <TableCell>{r.quantity_received}</TableCell>
                          <TableCell>{r.quantity_damaged}</TableCell>
                          <TableCell>{r.receiver_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}