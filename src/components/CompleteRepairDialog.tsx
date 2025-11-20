import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const completeRepairSchema = z.object({
  repairFee: z.coerce.number().min(0, "Repair fee cannot be negative."),
  notes: z.string().optional(),
});

interface CompleteRepairDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (values: z.infer<typeof completeRepairSchema>) => void;
  isProcessing: boolean;
  isWarranty: boolean;
}

export function CompleteRepairDialog({ isOpen, onOpenChange, onConfirm, isProcessing, isWarranty }: CompleteRepairDialogProps) {
  const form = useForm<z.infer<typeof completeRepairSchema>>({
    resolver: zodResolver(completeRepairSchema),
    defaultValues: {
      repairFee: 0,
      notes: '',
    },
  });

  useEffect(() => {
    if (isWarranty) {
      form.setValue('repairFee', 0);
    }
  }, [isWarranty, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Complete Repair</DialogTitle>
          <DialogDescription>Set the final repair fee and add any notes. An invoice will be generated for the customer.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="repairFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Repair Fee</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} disabled={isWarranty} />
                  </FormControl>
                  {isWarranty && <p className="text-xs text-muted-foreground">Repair fee is set to 0 because the item is under warranty.</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Replaced the main capacitor, cleaned contacts." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete and Generate Invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}