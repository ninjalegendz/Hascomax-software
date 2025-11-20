import React, { useEffect } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import type { DamagedItem, Product } from '@/types';

const damageSchema = z.object({
  product_id: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1.").superRefine((val, ctx) => {
    if (val > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "For bulk damages, please log one at a time to generate individual repair orders if needed."
      });
    }
  }),
  notes: z.string().optional(),
  status: z.enum(['Pending Assessment', 'Repairable', 'Unrepairable', 'In Repair', 'Repaired']),
});

interface DamageEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: z.infer<typeof damageSchema>, id?: string) => void;
  damageLog?: Partial<DamagedItem> | null;
  isSaving: boolean;
}

export function DamageEditorDialog({ isOpen, onOpenChange, onSave, damageLog, isSaving }: DamageEditorDialogProps) {
  const { data: products } = useQuery<Product[]>({
    queryKey: ['products-for-damage-log'],
    queryFn: () => authenticatedFetch('/api/products').then(data => data.products),
    enabled: isOpen,
  });

  const form = useForm<z.infer<typeof damageSchema>>({
    resolver: zodResolver(damageSchema),
    defaultValues: { product_id: '', quantity: 1, notes: '', status: 'Pending Assessment' },
  });

  useEffect(() => {
    if (isOpen) {
      if (damageLog) {
        form.reset({
          product_id: damageLog.product_id || '',
          quantity: damageLog.quantity || 1,
          notes: damageLog.notes || '',
          status: damageLog.status || 'Pending Assessment',
        });
      } else {
        form.reset({ product_id: '', quantity: 1, notes: '', status: 'Pending Assessment' });
      }
    }
  }, [damageLog, form, isOpen]);

  const handleSubmit = (values: z.infer<typeof damageSchema>) => {
    onSave(values, damageLog?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{damageLog ? 'Edit Damage Log' : 'Log Damaged Stock'}</DialogTitle>
          <DialogDescription>
            {damageLog ? 'Update the details for this damage log.' : 'Manually log stock that was found to be damaged. This will reduce your inventory.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!damageLog}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products?.map(p => <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="quantity" render={({ field }) => <FormItem><FormLabel>Quantity Damaged</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>} />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={damageLog?.status === 'In Repair' || damageLog?.status === 'Repaired'}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pending Assessment">Pending Assessment</SelectItem>
                      <SelectItem value="Repairable">Repairable</SelectItem>
                      <SelectItem value="Unrepairable">Unrepairable</SelectItem>
                      {field.value === 'In Repair' && <SelectItem value="In Repair">In Repair</SelectItem>}
                      {field.value === 'Repaired' && <SelectItem value="Repaired">Repaired</SelectItem>}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField control={form.control} name="notes" render={({ field }) => <FormItem><FormLabel>Notes (optional)</FormLabel><FormControl><Textarea placeholder="e.g., Water damage in warehouse" {...field} /></FormControl><FormMessage /></FormItem>} />
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}