import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { Purchase } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const statusVariantMap: Record<Purchase["status"], "default" | "secondary" | "outline"> = {
  "Completed": "default",
  "Partially Received": "secondary",
  "Pending": "outline",
};

interface PurchaseCardProps {
  purchase: Purchase;
  onEdit: (purchase: Purchase) => void;
  onDeleteTrigger: (purchase: Purchase) => void;
  onReceive: (purchase: Purchase) => void;
}

export function PurchaseCard({ purchase, onEdit, onDeleteTrigger, onReceive }: PurchaseCardProps) {
  const { format } = useCurrency();

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{purchase.products.name}</CardTitle>
          <p className="text-sm text-muted-foreground">SKU: {purchase.products.sku}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onReceive(purchase)}>View/Receive</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(purchase)} disabled={purchase.total_received > 0}>Edit</DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => onDeleteTrigger(purchase)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>Date: {formatDateSafe(purchase.purchase_date)}</p>
          <p>Qty Ordered: {purchase.quantity_purchased}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Badge variant={statusVariantMap[purchase.status]}>{purchase.status}</Badge>
          <div className="font-medium">{format(purchase.unit_cost)} / unit</div>
        </div>
      </CardContent>
    </Card>
  );
}