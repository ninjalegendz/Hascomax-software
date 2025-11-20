import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { Quotation } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const statusVariantMap: Record<Quotation["status"], "default" | "secondary" | "destructive" | "outline"> = {
  "Draft": "outline",
  "Sent": "secondary",
  "Accepted": "default",
  "Declined": "destructive",
  "Converted": "default",
};

interface QuotationCardProps {
  quotation: Quotation;
  onDeleteTrigger: (quotation: Quotation) => void;
  onNavigate: (id: string) => void;
}

export function QuotationCard({ quotation, onDeleteTrigger, onNavigate }: QuotationCardProps) {
  const { format } = useCurrency();

  return (
    <Card onClick={() => onNavigate(quotation.id)} className="cursor-pointer">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{quotation.quotation_number}</CardTitle>
          <p className="text-sm text-muted-foreground">{quotation.customer_name}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => onDeleteTrigger(quotation)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>Issued: {formatDateSafe(quotation.issue_date, 'PPP', '')}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Badge variant={statusVariantMap[quotation.status] || 'outline'}>{quotation.status}</Badge>
          <div className="font-medium">{format(quotation.total)}</div>
        </div>
      </CardContent>
    </Card>
  );
}