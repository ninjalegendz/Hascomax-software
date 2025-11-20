import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Download } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Return } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { useCurrency } from '@/hooks/useCurrency';
import { usePermissions } from '@/hooks/usePermissions';
import { useIsMobile } from '@/hooks/use-mobile';
import { ReturnCard } from '@/components/ReturnCard';
import { useExport } from '@/hooks/useExport';

const Returns = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const canCreate = usePermissions('returns:create');
  const isMobile = useIsMobile();
  const { handleExport } = useExport();

  const { data: returns, isLoading } = useQuery<Return[]>({
    queryKey: ['returns'],
    queryFn: () => authenticatedFetch('/api/returns'),
    enabled: !!profile,
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Returns & Refunds</CardTitle>
          <CardDescription>A log of all processed returns and refunds.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('returns')}>
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          {canCreate && (
            <Button size="sm" className="gap-1" onClick={() => navigate('/returns/new')}>
              <PlusCircle className="h-3.5 w-3.5" />
              Create Return
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isMobile ? (
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : returns && returns.length > 0 ? (
              returns.map((item) => (
                <ReturnCard
                  key={item.id}
                  returnItem={item}
                  onNavigate={(id) => navigate(`/returns/${id}`)}
                />
              ))
            ) : (
              <p className="text-center text-muted-foreground py-10">No returns have been processed yet.</p>
            )}
          </div>
        ) : (
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Original Receipt #</TableHead>
                  <TableHead>Processed By</TableHead>
                  <TableHead className="text-right">Refund Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : returns && returns.length > 0 ? (
                  returns.map((item) => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/returns/${item.id}`)}>
                      <TableCell className="font-medium">{item.return_receipt_number}</TableCell>
                      <TableCell>{formatDateSafe(item.return_date, "PPP")}</TableCell>
                      <TableCell>{item.customer_name}</TableCell>
                      <TableCell>{item.original_invoice_number}</TableCell>
                      <TableCell>{item.creator_name}</TableCell>
                      <TableCell className="text-right">{format(item.total_refund_amount)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No returns have been processed yet.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default Returns;