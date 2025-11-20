import React from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { Product } from '@/types';

type ProductWithQuantity = Product & { quantity: number };

const adjustmentSchema = z.object({
  newQuantity: z.coerce.number().int().min(0, "Quantity cannot be negative."),
  reason: z.string().min(3, "A reason is required."),
});

interface StockAdjustmentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  product: ProductWithQuantity | null;
  onConfirm: (values: { newQuantity: number, reason: string }) => void;
  isAdjusting: boolean;
}

export function StockAdjustmentDialog({ isOpen, onOpenChange, product, onConfirm, isAdjusting }: StockAdjustmentDialogProps) {
  const form = useForm<z.infer<typeof adjustmentSchema>>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { newQuantity: 0, reason: '' },
  });

  React.useEffect(() => {
    if (product) {
      form.reset({ newQuantity: product.quantity, reason: '' });
    }
  }, [product, form]);

  if (!product) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Stock for {product.name}</DialogTitle>
          <DialogDescription>
            Current stock: {product.quantity}. Set the new total quantity and provide a reason for the adjustment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="newQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Total Quantity</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Adjustment</FormLabel>
                  <FormControl><Textarea placeholder="e.g., Annual stock count correction, Damaged goods write-off" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isAdjusting}>
                {isAdjusting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Adjustment
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}