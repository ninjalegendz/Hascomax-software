import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { Customer } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';

interface BulkMergeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  customers: Customer[];
  onConfirmMerge: (destinationId: string, sourceIds: string[]) => void;
  isMerging: boolean;
}

export function BulkMergeDialog({
  isOpen,
  onOpenChange,
  customers,
  onConfirmMerge,
  isMerging,
}: BulkMergeDialogProps) {
  const [destinationId, setDestinationId] = useState<string>('');
  const { format } = useCurrency();

  useEffect(() => {
    if (isOpen && customers.length > 0) {
      // Pre-select the oldest account as the default destination
      const sortedCustomers = [...customers].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      setDestinationId(sortedCustomers[0].id);
    } else if (!isOpen) {
      setDestinationId('');
    }
  }, [isOpen, customers]);

  const handleConfirm = () => {
    if (!destinationId) return;
    const sourceIds = customers.filter(c => c.id !== destinationId).map(c => c.id);
    onConfirmMerge(destinationId, sourceIds);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Merge {customers.length} Customers</DialogTitle>
          <DialogDescription>
            Select one customer to be the primary record. All data from the other selected customers will be merged into it, and the other records will be deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          <RadioGroup value={destinationId} onValueChange={setDestinationId}>
            {customers.map(customer => (
              <Label key={customer.id} htmlFor={`customer-${customer.id}`} className="flex items-start space-x-4 p-4 border rounded-md has-[:checked]:border-primary cursor-pointer">
                <RadioGroupItem value={customer.id} id={`customer-${customer.id}`} />
                <div className="grid gap-1.5 leading-none">
                  <span className="font-semibold">{customer.name} ({customer.customerNumber})</span>
                  <span className="text-sm text-muted-foreground">{customer.phone} | {customer.email || 'No Email'}</span>
                  <span className="text-sm text-muted-foreground">Balance: {format(customer.balance)} | Created: {new Date(customer.createdAt).toLocaleDateString()}</span>
                </div>
              </Label>
            ))}
          </RadioGroup>

          {destinationId && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action is irreversible. All data from the other {customers.length - 1} customer(s) will be moved to the selected primary customer, and the other records will be permanently deleted.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" disabled={isMerging}>
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleConfirm} disabled={!destinationId || isMerging}>
            {isMerging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isMerging ? 'Merging...' : `Confirm Merge`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}