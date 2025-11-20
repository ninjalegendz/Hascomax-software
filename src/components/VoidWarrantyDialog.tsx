import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

const voidWarrantySchema = z.object({
  reason: z.string().min(10, "Please provide a detailed reason for voiding the warranty."),
});

interface VoidWarrantyDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onConfirm: (values: z.infer<typeof voidWarrantySchema>) => void;
  isProcessing: boolean;
}

export function VoidWarrantyDialog({ isOpen, onOpenChange, onConfirm, isProcessing }: VoidWarrantyDialogProps) {
  const form = useForm<z.infer<typeof voidWarrantySchema>>({
    resolver: zodResolver(voidWarrantySchema),
    defaultValues: {
      reason: '',
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void Warranty</DialogTitle>
          <DialogDescription>Provide a reason for voiding the warranty. This will allow you to charge for this repair.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason for Voiding</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Evidence of water damage found on the mainboard..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Void Warranty
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}