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
import type { Customer } from '@/types';

interface LinkCustomerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  sourceCustomer: Customer;
  allCustomers: Customer[];
  onConfirmLink: (targetCustomerId: string) => void;
}

export function LinkCustomerDialog({
  isOpen,
  onOpenChange,
  sourceCustomer,
  allCustomers,
  onConfirmLink,
}: LinkCustomerDialogProps) {
  const [targetCustomerId, setTargetCustomerId] = useState<string>('');

  const potentialLinkCustomers = allCustomers.filter(
    c => c.id !== sourceCustomer.id && !sourceCustomer.linkedAccountIds?.includes(c.id)
  );

  const handleConfirm = () => {
    if (targetCustomerId) {
      onConfirmLink(targetCustomerId);
      setTargetCustomerId('');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link Customer Account</DialogTitle>
          <DialogDescription>
            Select a customer to link with{' '}
            <span className="font-semibold">{sourceCustomer.name}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div>
            <label htmlFor="target-customer" className="text-sm font-medium">
              Customer to link
            </label>
            <Select value={targetCustomerId} onValueChange={setTargetCustomerId}>
              <SelectTrigger id="target-customer">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                {potentialLinkCustomers.map(customer => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.name} ({customer.customerNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={handleConfirm} disabled={!targetCustomerId}>
              Confirm Link
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}