import React, { useEffect } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customerSchema } from "@/types/schemas";
import type { Customer } from "@/types";

type CustomerFormValues = z.infer<typeof customerSchema>;

interface CustomerEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customer?: Customer | null;
  onSave: (values: CustomerFormValues, id?: string) => void;
  isSaving: boolean;
}

export function CustomerEditorDialog({ isOpen, onOpenChange, customer, onSave, isSaving }: CustomerEditorDialogProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: { name: "", email: "", phone: "", address: "", status: "Active", openingBalance: 0, balanceType: "credit", secondaryPhone: "" },
  });

  useEffect(() => {
    if (isOpen) {
      if (customer) {
        form.reset({ 
          ...customer, 
          openingBalance: 0, 
          balanceType: "credit",
          secondaryPhone: customer.secondaryPhone || "",
          email: customer.email || "",
          address: customer.address || "",
        });
      } else {
        form.reset({ name: "", email: "", phone: "", address: "", status: "Active", openingBalance: 0, balanceType: "credit", secondaryPhone: "" });
      }
    }
  }, [customer, form, isOpen]);

  const handleSubmit = (values: CustomerFormValues) => {
    onSave(values, customer?.id);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>Fill in the details below.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} disabled={customer?.name === 'Walk-in Customer'} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email (optional)</FormLabel><FormControl><Input placeholder="john.doe@example.com" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="123-456-7890" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="secondaryPhone" render={({ field }) => (<FormItem><FormLabel>Secondary Phone (optional)</FormLabel><FormControl><Input placeholder="098-765-4321" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>
            <FormField control={form.control} name="address" render={({ field }) => (<FormItem><FormLabel>Address (optional)</FormLabel><FormControl><Input placeholder="123 Main St, Anytown, USA" {...field} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a status" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
            {!customer && (
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="openingBalance" render={({ field }) => (<FormItem><FormLabel>Opening Balance</FormLabel><FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="balanceType" render={({ field }) => (<FormItem><FormLabel>Balance Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="credit">Credit</SelectItem><SelectItem value="debit">Debit</SelectItem></SelectContent></Select><FormMessage /></FormItem>)} />
              </div>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Saving..." : (customer ? "Save Changes" : "Add Customer")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}