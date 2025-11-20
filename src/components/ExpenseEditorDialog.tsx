import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/datepicker';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import type { Expense, ExpenseCategory } from '@/types';
import { Combobox } from './ui/combobox';
import { Loader2, UploadCloud, Settings } from 'lucide-react';
import { showError } from '@/utils/toast';
import { ExpenseCategoryManagerDialog } from './ExpenseCategoryManagerDialog';

const expenseSchema = z.object({
  date: z.date(),
  description: z.string().min(3, "Description must be at least 3 characters."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  category_id: z.string().min(1, "Category is required."),
  vendor: z.string().optional(),
});

type ExpenseFormValues = z.infer<typeof expenseSchema>;

interface ExpenseEditorDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSave: (values: ExpenseFormValues, id?: string, receipt?: File) => void;
  expense?: Expense | null;
  isSaving: boolean;
}

export function ExpenseEditorDialog({ isOpen, onOpenChange, onSave, expense, isSaving }: ExpenseEditorDialogProps) {
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);

  const { data: categories, isLoading: isLoadingCategories } = useQuery<ExpenseCategory[]>({
    queryKey: ['expenseCategories'],
    queryFn: () => authenticatedFetch('/api/expense-categories'),
    enabled: isOpen || isCategoryManagerOpen,
  });

  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date(), description: '', amount: 0, category_id: '', vendor: '' },
  });

  useEffect(() => {
    if (isOpen) {
      if (expense) {
        form.reset({
          date: new Date(expense.date),
          description: expense.description,
          amount: expense.amount,
          category_id: expense.category_id,
          vendor: expense.vendor || '',
        });
        setReceiptPreview(expense.receipt_url || null);
      } else {
        form.reset({ date: new Date(), description: '', amount: 0, category_id: '', vendor: '' });
        setReceiptPreview(null);
      }
      setReceiptFile(null);
    }
  }, [expense, form, isOpen]);

  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        showError("Receipt image cannot be larger than 5MB.");
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (values: ExpenseFormValues) => {
    onSave(values, expense?.id, receiptFile || undefined);
  };

  const categoryOptions = categories?.map(c => ({ value: c.id, label: c.name })) || [];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{expense ? 'Edit Expense' : 'Log New Expense'}</DialogTitle>
            <DialogDescription>Fill in the details for the expense below.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              <div className="space-y-4">
                <FormField control={form.control} name="date" render={({ field }) => <FormItem><FormLabel>Date</FormLabel><FormControl><DatePicker date={field.value} setDate={field.onChange} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="description" render={({ field }) => <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea placeholder="e.g., Office supplies from Staples" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="amount" render={({ field }) => <FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>} />
                <FormField control={form.control} name="category_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <div className="flex gap-2">
                      <Combobox options={categoryOptions} value={field.value} onChange={field.onChange} placeholder={isLoadingCategories ? "Loading..." : "Select a category..."} />
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCategoryManagerOpen(true)}><Settings className="h-4 w-4" /></Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="vendor" render={({ field }) => <FormItem><FormLabel>Vendor (optional)</FormLabel><FormControl><Input placeholder="e.g., Amazon" {...field} /></FormControl><FormMessage /></FormItem>} />
              </div>
              <div className="space-y-2">
                <FormLabel>Receipt (optional)</FormLabel>
                <label htmlFor="receipt-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed rounded-md aspect-square flex flex-col items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors">
                    {receiptPreview ? (
                      <img src={receiptPreview} alt="Receipt preview" className="w-full h-full object-contain" />
                    ) : (
                      <>
                        <UploadCloud className="h-12 w-12" />
                        <p>Click to upload receipt</p>
                        <p className="text-xs">(Max 5MB)</p>
                      </>
                    )}
                  </div>
                </label>
                <Input id="receipt-upload" type="file" accept="image/*" className="hidden" onChange={handleReceiptChange} />
              </div>
              <DialogFooter className="md:col-span-2">
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <Button type="submit" disabled={isSaving}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {expense ? 'Save Changes' : 'Log Expense'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <ExpenseCategoryManagerDialog isOpen={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen} />
    </>
  );
}