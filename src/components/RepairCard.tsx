import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Repair } from '@/types';
import { formatDateSafe } from '@/utils/date';

interface RepairCardProps {
  repair: Repair;
  onNavigate: (id: string) => void;
}

export function RepairCard({ repair, onNavigate }: RepairCardProps) {
  return (
    <Card onClick={() => onNavigate(repair.id)} className="cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium">{repair.repair_number}</CardTitle>
            <p className="text-sm text-muted-foreground">{repair.customer_name}</p>
          </div>
          <Badge>{repair.status}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-primary-foreground truncate">{repair.product_name}</p>
          <p>Received: {formatDateSafe(repair.received_date, 'PPP')}</p>
        </div>
      </CardContent>
    </Card>
  );
}