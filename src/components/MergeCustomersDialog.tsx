import React, { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { Customer } from '@/types';

interface MergeCustomersDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  destinationCustomer: Customer | null;
  allCustomers: Customer[];
  onConfirmMerge: (sourceCustomerId: string, destinationCustomerId: string) => void;
}

export function MergeCustomersDialog({
  isOpen,
  onOpenChange,
  destinationCustomer,
  allCustomers,
  onConfirmMerge,
}: MergeCustomersDialogProps) {
  const [sourceCustomerId, setSourceCustomerId] = useState<string>('');

  if (!destinationCustomer) return null;

  const potentialSourceCustomers = allCustomers.filter(c => c.id !== destinationCustomer.id);
  const sourceCustomer = allCustomers.find(c => c.id === sourceCustomerId);

  const handleConfirm = () => {
    if (sourceCustomerId && destinationCustomer) {
      onConfirmMerge(sourceCustomerId, destinationCustomer.id);
      setSourceCustomerId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Merge Customers</DialogTitle>
          <DialogDescription>
            Select a customer to merge into{' '}
            <span className="font-semibold">{destinationCustomer.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <label htmlFor="source-customer" className="text-sm font-medium">
              Customer to merge and delete
            </label>
            <Select value={sourceCustomerId} onValueChange={setSourceCustomerId}>
              <SelectTrigger id="source-customer">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {potentialSourceCustomers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.customerNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sourceCustomer && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Warning</AlertTitle>
              <AlertDescription>
                This action is irreversible. All data from{' '}
                <span className="font-semibold">{sourceCustomer.name}</span> will be moved to{' '}
                <span className="font-semibold">{destinationCustomer.name}</span>, and{' '}
                <span className="font-semibold">{sourceCustomer.name}</span> will be permanently deleted.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={handleConfirm} disabled={!sourceCustomerId}>
              Confirm Merge
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}