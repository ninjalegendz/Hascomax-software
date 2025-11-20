import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/datepicker-with-range';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, ArrowUpDown } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { DateRange } from 'react-day-picker';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';
import { PrintControl } from '@/components/PrintControl';

type ReportType = 'sales_by_date' | 'sales_by_product' | 'sales_by_customer' | 'product_inventory' | 'customer_balances';

interface ReportColumn {
  key: string;
  label: string;
  type?: 'currency' | 'date';
}

interface Performer {
  id: string;
  first_name: string;
  last_name: string;
}

interface ReportData {
  columns: ReportColumn[];
  rows: any[];
  title: string;
  description: string;
  performers?: Performer[];
}

const reportOptions: { value: ReportType; label: string }[] = [
  { value: 'sales_by_date', label: 'Sales Summary by Date' },
  { value: 'sales_by_product', label: 'Sales by Product' },
  { value: 'sales_by_customer', label: 'Sales by Customer' },
  { value: 'product_inventory', label: 'Product Inventory & Value' },
  { value: 'customer_balances', label: 'Customer Balances' },
];

const Analytics = () => {
  const [reportType, setReportType] = useState<ReportType>('sales_by_date');
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [performerId, setPerformerId] = useState('all-performers');
  const [sorting, setSorting] = useState({ sortBy: 'date', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [filters, setFilters] = useState<object>({});
  const [isGenerated, setIsGenerated] = useState(false);
  const reportContentRef = useRef<HTMLDivElement>(null);
  const { format } = useCurrency();

  const { data: reportData, isLoading, isFetching, refetch } = useQuery<ReportData>({
    queryKey: ['analyticsReport', reportType, filters],
    queryFn: () => authenticatedFetch('/api/reports', {
      method: 'POST',
      body: JSON.stringify({ reportType, filters }),
    }),
    enabled: false,
  });

  const handleGenerateReport = () => {
    const currentFilters: any = { 
      performerId, 
      sortBy: sorting.sortBy, 
      sortOrder: sorting.sortOrder 
    };
    if (['sales_by_date', 'sales_by_product', 'sales_by_customer'].includes(reportType) && dateRange) {
      currentFilters.dateRange = dateRange;
    }
    setFilters(currentFilters);
    setIsGenerated(true);
    setTimeout(() => refetch(), 0);
  };

  useEffect(() => {
    if (isGenerated) {
      handleGenerateReport();
    }
  }, [sorting]);

  const handleSort = (columnKey: string) => {
    setSorting(prev => ({
      sortBy: columnKey,
      sortOrder: prev.sortBy === columnKey && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  const formatCell = (value: any, type?: 'currency' | 'date') => {
    if (value === null || value === undefined) return 'N/A';
    switch (type) {
      case 'currency':
        return format(value);
      case 'date':
        return formatDateSafe(value, 'PPP');
      default:
        return value;
    }
  };

  const reportTitle = reportData?.title || 'Analytics & Reports';
  const showSalesFilters = ['sales_by_date', 'sales_by_product', 'sales_by_customer'].includes(reportType);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Report Builder</CardTitle>
          <CardDescription>Select a report type and apply filters to generate a custom report.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select a report" /></SelectTrigger>
              <SelectContent>{reportOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {showSalesFilters && (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Performer</label>
                <Select value={performerId} onValueChange={setPerformerId}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Performers" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-performers">All Performers</SelectItem>
                    {reportData?.performers?.map(p => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <Button onClick={handleGenerateReport} disabled={isFetching}>
            {isFetching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Report
          </Button>
        </CardContent>
      </Card>

      {isGenerated && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{reportData?.title || 'Report'}</CardTitle>
              <CardDescription>{reportData?.description || 'Here are your results.'}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" disabled><Save className="mr-2 h-4 w-4" />Save Report</Button>
              <PrintControl documentRef={reportContentRef} fileName={reportTitle.replace(/ /g, '_')} />
            </div>
          </CardHeader>
          <CardContent>
            <div ref={reportContentRef} className="bg-background p-4">
              {(isLoading || isFetching) ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : reportData && reportData.rows.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {reportData.columns.map(col => (
                        <TableHead key={col.key}>
                          <Button variant="ghost" onClick={() => handleSort(col.key)}>
                            {col.label} <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.rows.map((row, rowIndex) => (
                      <TableRow key={rowIndex}>
                        {reportData.columns.map(col => (
                          <TableCell key={col.key} className={col.type === 'currency' ? 'text-right' : ''}>
                            {formatCell(row[col.key], col.type)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-16 text-muted-foreground">No data found for the selected criteria.</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Analytics;