import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';
import { DateRange } from 'react-day-picker';

interface ReportProps {
  dateRange: DateRange | undefined;
  isActive: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
}

interface LedgerTransaction {
  id: string;
  date: string;
  description: string;
  type: 'credit' | 'debit';
  amount: number;
  customer_name: string;
}

export function AccountLedgerReport({ dateRange, isActive }: ReportProps) {
  const { format } = useCurrency();
  const [selectedAccount, setSelectedAccount] = useState<string>('');

  const { data: paymentMethods, isLoading: isLoadingMethods } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
    enabled: isActive,
  });

  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<LedgerTransaction[]>({
    queryKey: ['accountLedger', selectedAccount, dateRange],
    queryFn: () => authenticatedFetch(`/api/reports/account-ledger?account=${encodeURIComponent(selectedAccount)}&startDate=${dateRange?.from?.toISOString() || ''}&endDate=${dateRange?.to?.toISOString() || ''}`),
    enabled: isActive && !!selectedAccount,
  });

  return (
    <div className="space-y-6">
      <div className="max-w-sm">
        <Select value={selectedAccount} onValueChange={setSelectedAccount}>
          <SelectTrigger>
            <SelectValue placeholder={isLoadingMethods ? "Loading accounts..." : "Select an account to view..."} />
          </SelectTrigger>
          <SelectContent>
            {paymentMethods?.map(method => (
              <SelectItem key={method.id} value={method.name}>{method.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle>Ledger for: {selectedAccount}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : !transactions || transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-10">No transactions found for this account in the selected period.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDateSafe(t.date, 'PPP')}</TableCell>
                      <TableCell>{t.customer_name || 'N/A'}</TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className="text-right text-destructive">{t.type === 'debit' ? format(t.amount) : '-'}</TableCell>
                      <TableCell className="text-right text-green-600">{t.type === 'credit' ? format(t.amount) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}