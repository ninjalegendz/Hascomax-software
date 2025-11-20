import React, { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/datepicker";
import { authenticatedFetch } from "@/lib/api";
import type { Product, Purchase } from "@/types";
import { useQuery } from "@tanstack/react-query";

const purchaseSchema = z.object({
  product_id: z.string().min(1, "Product is required."),
  quantity_purchased: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unit_cost: z.coerce.number().min(0.01, "Cost must be positive."),
  purchase_date: z.date(),
  supplier: z.string().optional(),
});

type PurchaseFormValues = z.infer<typeof purchaseSchema>;

interface PurchaseEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: PurchaseFormValues, id?: string) => void;
  isSaving: boolean;
  purchase?: Purchase | null;
}

export function PurchaseEditorDialog({ isOpen, onOpenChange, onSave, isSaving, purchase }: PurchaseEditorDialogProps) {
  const { data: products, isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['products-for-purchase'],
    queryFn: () => authenticatedFetch('/api/products?type=standard').then(data => data.products),
    enabled: isOpen,
  });

  const form = useForm<PurchaseFormValues>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: { product_id: "", quantity_purchased: 1, unit_cost: 0, purchase_date: new Date(), supplier: "" },
  });

  useEffect(() => {
    if (isOpen) {
      if (purchase) {
        form.reset({
          product_id: purchase.product_id,
          quantity_purchased: purchase.quantity_purchased,
          unit_cost: purchase.unit_cost,
          purchase_date: new Date(purchase.purchase_date),
          supplier: purchase.supplier || "",
        });
      } else {
        form.reset({ product_id: "", quantity_purchased: 1, unit_cost: 0, purchase_date: new Date(), supplier: "" });
      }
    }
  }, [purchase, form, isOpen]);

  const handleSubmit = (values: PurchaseFormValues) => {
    onSave(values, purchase?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{purchase ? "Edit Purchase Order" : "Add New Purchase"}</DialogTitle>
          <DialogDescription>{purchase ? "Update the details of this purchase order." : "Record a new batch of incoming inventory."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="product_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={!!purchase || isLoadingProducts}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingProducts ? "Loading products..." : "Select a product"} />
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
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="quantity_purchased" render={({ field }) => (<FormItem><FormLabel>Quantity</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="unit_cost" render={({ field }) => (<FormItem><FormLabel>Unit Cost</FormLabel><FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="purchase_date" render={({ field }) => (<FormItem><FormLabel>Purchase Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="supplier" render={({ field }) => (<FormItem><FormLabel>Supplier (Optional)</FormLabel><FormControl><Input placeholder="Supplier Name" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : (purchase ? "Save Changes" : "Add Purchase")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}