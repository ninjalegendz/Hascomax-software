import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { Loader2, Scale } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { cn } from '@/lib/utils';

interface BalanceSheetData {
  totalInventoryValue: number;
  totalReceivables: number;
  totalCredit: number;
  ownersEquity: number;
}

interface BalanceSheetReportProps {
  isActive: boolean;
}

export function BalanceSheetReport({ isActive }: BalanceSheetReportProps) {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<BalanceSheetData>({
    queryKey: ['bingoBalanceSheet'],
    queryFn: () => authenticatedFetch('/api/reports/balance-sheet'),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-10">Balance Sheet data unavailable.</p>;

  const totalAssets = data.totalInventoryValue + data.totalReceivables;
  const totalLiabilitiesAndEquity = data.totalCredit + data.ownersEquity;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-xl flex items-center gap-2"><Scale className="h-5 w-5" /> Balance Sheet (Simplified)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-8">
            {/* ASSETS */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">ASSETS</h3>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Inventory (Cost)</TableCell>
                    <TableCell className="text-right">{format(data.totalInventoryValue)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Accounts Receivable (Owed to us)</TableCell>
                    <TableCell className="text-right">{format(data.totalReceivables)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold border-t-2 border-b-2 border-primary/50">
                    <TableCell>TOTAL ASSETS</TableCell>
                    <TableCell className="text-right">{format(totalAssets)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* LIABILITIES & EQUITY */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold border-b pb-2">LIABILITIES & EQUITY</h3>
              <Table>
                <TableBody>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">LIABILITIES</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Customer Credit (Owed by us)</TableCell>
                    <TableCell className="text-right text-destructive">{format(data.totalCredit)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">OWNER'S EQUITY</TableCell>
                    <TableCell className="text-right"></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-8">Equity (Net Assets)</TableCell>
                    <TableCell className={cn("text-right", data.ownersEquity < 0 && "text-destructive")}>{format(data.ownersEquity)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold border-t-2 border-b-2 border-primary/50">
                    <TableCell>TOTAL LIABILITIES & EQUITY</TableCell>
                    <TableCell className="text-right">{format(totalLiabilitiesAndEquity)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}