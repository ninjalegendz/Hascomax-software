import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Return } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';

interface ReturnCardProps {
  returnItem: Return;
  onNavigate: (id: string) => void;
}

export function ReturnCard({ returnItem, onNavigate }: ReturnCardProps) {
  const { format } = useCurrency();

  return (
    <Card onClick={() => onNavigate(returnItem.id)} className="cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{returnItem.return_receipt_number}</CardTitle>
            <p className="text-sm text-muted-foreground">{returnItem.customer_name}</p>
          </div>
          <div className="font-medium text-right">{format(returnItem.total_refund_amount)}</div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>Date: {formatDateSafe(returnItem.return_date, 'PPP')}</p>
          <p>Original Receipt: {returnItem.original_invoice_number}</p>
        </div>
      </CardContent>
    </Card>
  );
}