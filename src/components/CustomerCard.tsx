import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { Customer } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';

interface CustomerCardProps {
  customer: Customer;
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
  onMerge: (customer: Customer) => void;
  onNavigate: (id: string) => void;
  canEdit: boolean;
  canDelete: boolean;
  canManageLinks: boolean;
  canViewFinancials: boolean;
}

export function CustomerCard({ customer, onEdit, onDelete, onMerge, onNavigate, canEdit, canDelete, canManageLinks, canViewFinancials }: CustomerCardProps) {
  const { format } = useCurrency();

  return (
    <Card onClick={() => onNavigate(customer.id)} className="cursor-pointer">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{customer.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{customer.customerNumber}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            {canEdit && <DropdownMenuItem onClick={() => onEdit(customer)}>Edit</DropdownMenuItem>}
            {canManageLinks && <DropdownMenuItem onClick={() => onMerge(customer)} disabled={customer.name === 'Walk-in Customer'}>Merge Into...</DropdownMenuItem>}
            {canDelete && <DropdownMenuItem onClick={() => onDelete(customer)} disabled={customer.name === 'Walk-in Customer'} className="text-destructive">Delete</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>{customer.phone}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Badge variant={customer.status === "Active" ? "default" : "outline"}>{customer.status}</Badge>
          {canViewFinancials && (
            <div className={`font-medium ${customer.balance < 0 ? 'text-destructive' : ''}`}>
              {format(customer.balance)} {customer.balance < 0 ? 'Dr' : customer.balance > 0 ? 'Cr' : ''}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}