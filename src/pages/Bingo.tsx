import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, BarChart3, Package, Users, DollarSign, ShoppingCart, FileText, Scale, BookOpen } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { DatePickerWithRange } from '@/components/ui/datepicker-with-range';
import { DateRange } from 'react-day-picker';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDateSafe } from '@/utils/date';
import { cn } from '@/lib/utils';
import { BalanceSheetReport } from '@/components/BalanceSheetReport';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { AccountLedgerReport } from '@/components/AccountLedgerReport';
import { usePermissions } from '@/hooks/usePermissions';

// --- Report Components ---

interface ReportProps {
  dateRange: DateRange | undefined;
  isActive: boolean;
}

const ProfitAndLossReport: React.FC<ReportProps> = ({ dateRange, isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoProfitAndLoss', dateRange],
    queryFn: () => authenticatedFetch(`/api/reports/profit-loss?startDate=${dateRange?.from?.toISOString() || ''}&endDate=${dateRange?.to?.toISOString() || ''}`),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-10">No data available for P&L.</p>;

  const grossProfit = data.totalRevenue - data.totalCogs;
  const grossMargin = data.totalRevenue > 0 ? (grossProfit / data.totalRevenue) * 100 : 0;
  const netProfit = grossProfit - data.totalPurchases; // Simplified net profit

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 border rounded-md">
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-xl font-bold text-primary">{format(data.totalRevenue)}</p>
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total COGS</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{format(data.totalCogs)}</div>
                <p className="text-xs text-muted-foreground">Estimated cost of items sold</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Profit</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{format(grossProfit)}</div>
                <p className="text-xs text-muted-foreground">Revenue minus COGS</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gross Margin</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{grossMargin.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Profitability percentage</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableBody>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>REVENUE</TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className="text-right">{format(data.totalRevenue)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Sales Revenue</TableCell>
                <TableCell className="text-right">{format(data.totalRevenue)}</TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>COST OF GOODS SOLD (COGS)</TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className="text-right text-destructive">({format(data.totalCogs)})</TableCell>
              </TableRow>
              <TableRow className="font-bold border-t-2 border-b-2 border-primary/50">
                <TableCell>GROSS PROFIT</TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className="text-right text-green-600">{format(grossProfit)}</TableCell>
              </TableRow>
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>OPERATING EXPENSES</TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className="text-right text-destructive">({format(data.totalPurchases)})</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-8">Inventory Purchases</TableCell>
                <TableCell className="text-right text-destructive">({format(data.totalPurchases)})</TableCell>
                <TableCell className="text-right"></TableCell>
              </TableRow>
              <TableRow className="font-bold border-t-2 border-b-4 border-primary">
                <TableCell>NET PROFIT (Simplified)</TableCell>
                <TableCell className="text-right"></TableCell>
                <TableCell className={cn("text-right", netProfit > 0 ? "text-green-600" : "text-destructive")}>{format(netProfit)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const TransactionJournalReport: React.FC<ReportProps> = ({ dateRange, isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoTransactionJournal', dateRange],
    queryFn: () => authenticatedFetch(`/api/reports/transaction-journal?startDate=${dateRange?.from?.toISOString() || ''}&endDate=${dateRange?.to?.toISOString() || ''}`),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data || data.transactions.length === 0) return <p className="text-center text-muted-foreground py-10">No transactions found for this period.</p>;

  return (
    <Card>
      <CardHeader><CardTitle>Transaction Journal</CardTitle><CardDescription>All financial movements (debits and credits) in the system.</CardDescription></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Debit (Owed)</TableHead><TableHead className="text-right">Credit (Paid)</TableHead></TableRow></TableHeader>
          <TableBody>
            {data.transactions.map((t: any) => (
              <TableRow key={t.id}>
                <TableCell>{formatDateSafe(t.date, 'PPP p')}</TableCell>
                <TableCell>{t.customer_name || 'N/A'}</TableCell>
                <TableCell>{t.description}</TableCell>
                <TableCell className="text-right text-destructive">{t.type === 'debit' ? format(t.amount) : '-'}</TableCell>
                <TableCell className="text-right text-green-600">{t.type === 'credit' ? format(t.amount) : '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

const SalesPerformanceReport: React.FC<ReportProps> = ({ dateRange, isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoSalesPerformance', dateRange],
    queryFn: () => authenticatedFetch(`/api/reports/sales-performance?startDate=${dateRange?.from?.toISOString() || ''}&endDate=${dateRange?.to?.toISOString() || ''}`),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-10">No sales data available.</p>;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Daily Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailySales}>
              <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${format(value)}`} />
              <Tooltip formatter={(value) => [format(value as number), 'Revenue']} />
              <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-primary" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Top 5 Products by Revenue</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Product</TableHead><TableHead className="text-right">Revenue</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.topProducts.map((p: any) => (
                  <TableRow key={p.product_id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="text-right font-medium">{format(p.total_revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Top 5 Customers by Spending</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead className="text-right">Total Spent</TableHead></TableRow></TableHeader>
              <TableBody>
                {data.topCustomers.map((c: any) => (
                  <TableRow key={c.customer_id}>
                    <TableCell className="font-medium">{c.customer_name}</TableCell>
                    <TableCell className="text-right font-medium">{format(c.total_spent)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const InventoryValuationReport: React.FC<ReportProps> = ({ isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoInventoryValuation'],
    queryFn: () => authenticatedFetch('/api/reports/inventory-valuation'),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data || data.products.length === 0) return <p className="text-center text-muted-foreground py-10">No inventory data available.</p>;

  const totalInventoryValue = data.products.reduce((sum: number, p: any) => sum + p.total_value, 0);
  const totalSellingValue = data.products.reduce((sum: number, p: any) => sum + (p.quantity * p.price), 0);

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value (Cost)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(totalInventoryValue)}</div>
            <p className="text-xs text-muted-foreground">Based on average unit cost of remaining stock</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value (Selling)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{format(totalSellingValue)}</div>
            <p className="text-xs text-muted-foreground">Potential revenue from current stock</p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Product Valuation Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead>Stock</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Avg Cost</TableHead><TableHead className="text-right">Total Value (Cost)</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.products.map((p: any) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.sku}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell className="text-right">{format(p.price)}</TableCell>
                  <TableCell className="text-right">{format(p.avg_cost)}</TableCell>
                  <TableCell className="text-right font-medium">{format(p.total_value)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const CustomerReceivablesReport: React.FC<ReportProps> = ({ isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoReceivables'],
    queryFn: () => authenticatedFetch('/api/reports/customer-receivables'),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data || data.receivables.length === 0) return <p className="text-center text-muted-foreground py-10">No outstanding receivables.</p>;

  const totalReceivable = data.receivables.reduce((sum: number, c: any) => sum + Math.abs(c.balance), 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Outstanding Receivables</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{format(totalReceivable)}</div>
          <p className="text-xs text-muted-foreground">{data.receivables.length} customers owe money</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Receivables Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.receivables.map((c: any) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="text-right font-medium text-destructive">{format(Math.abs(c.balance))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

const PurchasesReport: React.FC<ReportProps> = ({ dateRange, isActive }) => {
  const { format } = useCurrency();
  const { data, isLoading } = useQuery<any>({
    queryKey: ['bingoPurchasesReport', dateRange],
    queryFn: () => authenticatedFetch(`/api/reports/purchases-summary?startDate=${dateRange?.from?.toISOString() || ''}&endDate=${dateRange?.to?.toISOString() || ''}`),
    enabled: isActive,
  });

  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!data) return <p className="text-center text-muted-foreground py-10">No purchase data available.</p>;

  const totalPurchases = data.totalPurchases || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Purchases (Expenses)</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-destructive">{format(totalPurchases)}</div>
          <p className="text-xs text-muted-foreground">{data.numPurchases} purchase orders recorded</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Purchases by Date</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.dailyPurchases}>
              <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${format(value)}`} />
              <Tooltip formatter={(value) => [format(value as number), 'Purchases']} />
              <Bar dataKey="total" fill="currentColor" radius={[4, 4, 0, 0]} className="fill-destructive" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Top Purchased Products</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Product</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">Total Cost</TableHead><TableHead className="text-right">Total Qty</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.topProducts.map((p: any) => (
                <TableRow key={p.product_id}>
                  <TableCell className="font-medium">{p.product_name}</TableCell>
                  <TableCell>{p.product_sku}</TableCell>
                  <TableCell className="text-right font-medium">{format(p.total_cost)}</TableCell>
                  <TableCell className="text-right">{p.total_quantity}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// --- Main Bingo Page ---

const Bingo = () => {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const canViewAccounting = usePermissions('accounting:view');
  const [activeTab, setActiveTab] = useState('pnl');
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().setMonth(new Date().getMonth() - 1)),
    to: new Date(),
  });

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/login');
    }
  }, [loading, profile, navigate]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!canViewAccounting) {
    // This should be caught by the Layout component, but as a fallback:
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
            <div className="text-center">
                <Loader2 className="mx-auto h-16 w-16 animate-spin text-muted-foreground" />
                <p className="mt-2 text-lg text-muted-foreground">
                    Checking permissions...
                </p>
            </div>
        </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Accounting Dashboard</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
          <CardDescription>Select a date range for time-based reports.</CardDescription>
        </CardHeader>
        <CardContent>
          <DatePickerWithRange date={dateRange} setDate={setDateRange} />
        </CardContent>
      </Card>

      <Tabs defaultValue="pnl" onValueChange={(value) => setActiveTab(value)}>
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="pnl"><DollarSign className="h-4 w-4 mr-2" /> Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet"><Scale className="h-4 w-4 mr-2" /> Balance Sheet</TabsTrigger>
          <TabsTrigger value="sales"><BarChart3 className="h-4 w-4 mr-2" /> Sales Performance</TabsTrigger>
          <TabsTrigger value="purchases"><ShoppingCart className="h-4 w-4 mr-2" /> Purchases & Expenses</TabsTrigger>
          <TabsTrigger value="inventory"><Package className="h-4 w-4 mr-2" /> Inventory Valuation</TabsTrigger>
          <TabsTrigger value="receivables"><Users className="h-4 w-4 mr-2" /> Customer Receivables</TabsTrigger>
          <TabsTrigger value="journal"><FileText className="h-4 w-4 mr-2" /> Transaction Journal</TabsTrigger>
          <TabsTrigger value="ledger"><BookOpen className="h-4 w-4 mr-2" /> Account Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="pnl">
          <Card className="mt-4">
            <CardHeader><CardTitle>Profit & Loss Statement</CardTitle></CardHeader>
            <CardContent><ProfitAndLossReport dateRange={dateRange} isActive={activeTab === 'pnl'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="balance-sheet">
          <Card className="mt-4">
            <CardHeader><CardTitle>Balance Sheet</CardTitle></CardHeader>
            <CardContent><BalanceSheetReport isActive={activeTab === 'balance-sheet'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="sales">
          <Card className="mt-4">
            <CardHeader><CardTitle>Sales Performance</CardTitle></CardHeader>
            <CardContent><SalesPerformanceReport dateRange={dateRange} isActive={activeTab === 'sales'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="purchases">
          <Card className="mt-4">
            <CardHeader><CardTitle>Purchases Summary</CardTitle></CardHeader>
            <CardContent><PurchasesReport dateRange={dateRange} isActive={activeTab === 'purchases'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="inventory">
          <Card className="mt-4">
            <CardHeader><CardTitle>Inventory Valuation</CardTitle></CardHeader>
            <CardContent><InventoryValuationReport dateRange={dateRange} isActive={activeTab === 'inventory'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="receivables">
          <Card className="mt-4">
            <CardHeader><CardTitle>Customer Receivables</CardTitle></CardHeader>
            <CardContent><CustomerReceivablesReport dateRange={dateRange} isActive={activeTab === 'receivables'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="journal">
          <Card className="mt-4">
            <CardHeader><CardTitle>Transaction Journal</CardTitle></CardHeader>
            <CardContent><TransactionJournalReport dateRange={dateRange} isActive={activeTab === 'journal'} /></CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="ledger">
          <Card className="mt-4">
            <CardHeader><CardTitle>Account Ledger</CardTitle><CardDescription>View all transactions for a specific payment account.</CardDescription></CardHeader>
            <CardContent><AccountLedgerReport dateRange={dateRange} isActive={activeTab === 'ledger'} /></CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Bingo;