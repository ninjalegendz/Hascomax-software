import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { Invoice } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';

const statusVariantMap: Record<Invoice["status"], "default" | "secondary" | "destructive" | "outline"> = {
  "Paid": "default",
  "Partially Paid": "secondary",
  "Sent": "secondary",
  "Draft": "outline",
  "Overdue": "destructive",
};

interface InvoiceCardProps {
  invoice: Invoice;
  onDelete: (invoice: Invoice) => void;
  onNavigate: (id: string) => void;
}

export function InvoiceCard({ invoice, onDelete, onNavigate }: InvoiceCardProps) {
  const { format } = useCurrency();

  return (
    <Card onClick={() => onNavigate(invoice.id)} className="cursor-pointer">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{invoice.invoiceNumber}</CardTitle>
          <p className="text-sm text-muted-foreground">{invoice.customerName}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onDelete(invoice)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p>Issued: {formatDateSafe(invoice.issueDate, 'PPP', '')}</p>
        </div>
        <div className="flex items-center justify-between mt-4">
          <Badge variant={statusVariantMap[invoice.status]}>{invoice.status}</Badge>
          <div className="font-medium">{format(invoice.total)}</div>
        </div>
      </CardContent>
    </Card>
  );
}