import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox } from '@/components/ui/combobox';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import type { Product, Repair } from '@/types';

const replacementSchema = z.object({
  replacementProductId: z.string().min(1, "A replacement product is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  price: z.coerce.number().min(0, "Price cannot be negative."),
  notes: z.string().optional(),
});

interface CreateReplacementDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (values: z.infer<typeof replacementSchema>) => void;
  isProcessing: boolean;
  repair: Repair;
  isWarranty: boolean;
}

export function CreateReplacementDialog({ isOpen, onOpenChange, onConfirm, isProcessing, repair, isWarranty }: CreateReplacementDialogProps) {
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['products-for-sale'],
    queryFn: () => authenticatedFetch('/api/products-for-sale'),
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof replacementSchema>>({
    resolver: zodResolver(replacementSchema),
    defaultValues: {
      quantity: 1,
      price: 0,
      notes: '',
    },
  });

  const selectedProductId = form.watch('replacementProductId');

  useEffect(() => {
    if (isOpen && products) {
      const originalProduct = products.find(p => p.name === repair.product_name);
      if (originalProduct) {
        form.reset({
          replacementProductId: originalProduct.id,
          quantity: 1,
          price: isWarranty ? 0 : originalProduct.price,
          notes: `Replacement for unrepairable item from Repair Order ${repair.repair_number}.`,
        });
      }
    }
  }, [isOpen, products, repair, form, isWarranty]);

  useEffect(() => {
    if (selectedProductId && products) {
      const product = products.find(p => p.id === selectedProductId);
      if (product && !isWarranty) {
        form.setValue('price', product.price);
      }
    }
  }, [selectedProductId, products, form, isWarranty]);

  const productOptions = products?.map(p => ({ value: p.id, label: `${p.name} (SKU: ${p.sku})` })) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Replacement Invoice</DialogTitle>
          <DialogDescription>
            Issue a replacement for the unrepairable item from Repair Order {repair.repair_number}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="replacementProductId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Replacement Product</FormLabel>
                  {isLoadingProducts ? (
                    <div className="flex items-center justify-center h-10 border rounded-md"><Loader2 className="h-5 w-5 animate-spin" /></div>
                  ) : (
                    <Combobox
                      options={productOptions}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select a product..."
                      searchPlaceholder="Search products..."
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price (per unit)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Internal Notes (optional)</FormLabel>
                  <FormControl><Textarea {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Replacement Invoice
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}