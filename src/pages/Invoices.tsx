import React, { useState } from "react";
import { MoreHorizontal, PlusCircle, Loader2, ArrowUpDown, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDateSafe } from "@/utils/date";
import { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DataTablePagination } from "@/components/DataTablePagination";
import { showError, showSuccess } from "@/utils/toast";
import type { Invoice } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/datepicker-with-range";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { useIsMobile } from "@/hooks/use-mobile";
import { InvoiceCard } from "@/components/InvoiceCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useExport } from "@/hooks/useExport";

const statusVariantMap: Record<Invoice["status"], "default" | "secondary" | "destructive" | "outline"> = {
  "Paid": "default",
  "Partially Paid": "secondary",
  "Sent": "secondary",
  "Draft": "outline",
  "Overdue": "destructive",
};

const Invoices = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('invoices-sorting', { sortBy: 'created_at', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  
  const { profile } = useAuth();
  const { format } = useCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const canDelete = usePermissions('invoices:delete');
  const { handleExport } = useExport();

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', searchTerm, currentPage, pageSize, sorting, statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        searchTerm, 
        page: String(currentPage), 
        pageSize: String(pageSize), 
        sortBy: sorting.sortBy, 
        sortOrder: sorting.sortOrder, 
        type: 'invoice',
        status: statusFilter
      });
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());
      const res = await authenticatedFetch(`/api/invoices?${params}`);
      const formattedData = res.invoices.map((i: any) => ({ 
        ...i, 
        invoiceNumber: i.invoice_number, 
        customerName: i.customer_name, 
        issueDate: i.issue_date, 
        dueDate: i.due_date, 
        lineItems: i.line_items, 
        createdAt: i.created_at, 
        creatorName: i.creator_name,
        deliveryCharge: i.delivery_charge,
        showProductDescriptions: !!i.show_product_descriptions,
        termsAndConditions: i.terms_and_conditions,
      }));
      return { invoices: formattedData, count: res.count };
    },
    enabled: !!profile,
  });

  const invoices = data?.invoices || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  async function confirmDelete() {
    if (!invoiceToDelete) return;
    try {
      await authenticatedFetch(`/api/invoices/${invoiceToDelete.id}`, { method: 'DELETE' });
      showSuccess("Invoice deleted.");
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setInvoiceToDelete(null);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Pending Invoices</CardTitle>
            <CardDescription>Invoices that have not received any payment.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('invoices')}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export all pending invoices to a CSV file</p></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" className="gap-1" onClick={() => navigate("/invoices/new")}>
                  <PlusCircle className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">New Invoice</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Create a new invoice.</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 mb-4">
            <Input
              placeholder="Search by invoice # or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
          {isMobile ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : invoices.length > 0 ? (
                invoices.map((invoice) => (
                  <InvoiceCard
                    key={invoice.id}
                    invoice={invoice}
                    onDelete={setInvoiceToDelete}
                    onNavigate={(id) => navigate(`/invoices/${id}`)}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No invoices found.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('invoice_number')}>Number <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('customer_name')}>Customer <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('issue_date')}>Issue Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('creator_name')}>Created By <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('total')}>Total <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : invoices.length > 0 ? (
                    invoices.map((invoice) => (
                      <TableRow key={invoice.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/invoices/${invoice.id}`)}>
                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>{formatDateSafe(invoice.issueDate, 'PPP', '')}</TableCell>
                        <TableCell>{invoice.creatorName || 'N/A'}</TableCell>
                        <TableCell>{format(invoice.total)}</TableCell>
                        <TableCell><Badge variant={statusVariantMap[invoice.status]}>{invoice.status}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>More actions</p>
                              </TooltipContent>
                            </Tooltip>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              {canDelete && <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setInvoiceToDelete(invoice)} className="text-destructive">Delete</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No invoices found.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        {totalPages > 0 && (
          <div className="p-4 border-t">
            <DataTablePagination 
              page={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              setPage={setCurrentPage}
              setPageSize={setPageSize}
              totalCount={totalCount}
            />
          </div>
        )}
      </Card>
      <AlertDialog open={!!invoiceToDelete} onOpenChange={(isOpen) => !isOpen && setInvoiceToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete this invoice.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Invoices;