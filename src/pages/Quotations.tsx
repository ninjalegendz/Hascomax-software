import React, { useState } from "react";
import { MoreHorizontal, Loader2, ArrowUpDown, PlusCircle, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDateSafe } from "@/utils/date";
import { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTablePagination } from "@/components/DataTablePagination";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import type { Quotation } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/datepicker-with-range";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { useIsMobile } from "@/hooks/use-mobile";
import { QuotationCard } from "@/components/QuotationCard";
import { useExport } from "@/hooks/useExport";

const statusVariantMap: Record<Quotation["status"], "default" | "secondary" | "destructive" | "outline"> = {
  "Draft": "outline",
  "Sent": "secondary",
  "Accepted": "default",
  "Declined": "destructive",
  "Converted": "default",
};

const Quotations = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('quotations-sorting', { sortBy: 'created_at', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [quotationToDelete, setQuotationToDelete] = useState<Quotation | null>(null);

  const { profile } = useAuth();
  const { format } = useCurrency();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = usePermissions('quotations:create');
  const canDelete = usePermissions('quotations:delete');
  const isMobile = useIsMobile();
  const { handleExport } = useExport();

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', searchTerm, currentPage, pageSize, sorting, statusFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        searchTerm, 
        page: String(currentPage), 
        pageSize: String(pageSize), 
        sortBy: sorting.sortBy, 
        sortOrder: sorting.sortOrder,
        status: statusFilter
      });
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());
      const res = await authenticatedFetch(`/api/quotations?${params}`);
      return res as { quotations: Quotation[], count: number };
    },
    enabled: !!profile,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/quotations/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess("Quotation deleted successfully.");
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  const quotations = data?.quotations || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  const confirmDelete = () => {
    if (quotationToDelete) {
      deleteMutation.mutate(quotationToDelete.id);
    }
    setQuotationToDelete(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Quotations</CardTitle>
            <CardDescription>Manage your price quotes and estimates.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('quotations')}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            {canCreate && (
              <Button size="sm" className="gap-1" onClick={() => navigate('/quotations/new')}>
                <PlusCircle className="h-3.5 w-3.5" />
                New Quotation
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Input
              placeholder="Search by quote # or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
                <SelectItem value="Accepted">Accepted</SelectItem>
                <SelectItem value="Declined">Declined</SelectItem>
                <SelectItem value="Converted">Converted</SelectItem>
              </SelectContent>
            </Select>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
          {isMobile ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : quotations.length > 0 ? (
                quotations.map((quote) => (
                  <QuotationCard
                    key={quote.id}
                    quotation={quote}
                    onDeleteTrigger={setQuotationToDelete}
                    onNavigate={(id) => navigate(`/quotations/${id}`)}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No quotations found.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('quotation_number')}>Number <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('customer_name')}>Customer <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('issue_date')}>Issue Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('total')}>Total <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : quotations.length > 0 ? (
                    quotations.map((quote) => (
                      <TableRow key={quote.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/quotations/${quote.id}`)}>
                        <TableCell className="font-medium">{quote.quotation_number}</TableCell>
                        <TableCell>{quote.customer_name}</TableCell>
                        <TableCell>{formatDateSafe(quote.issue_date, 'PPP', '')}</TableCell>
                        <TableCell>{format(quote.total)}</TableCell>
                        <TableCell><Badge variant={statusVariantMap[quote.status] || 'outline'}>{quote.status}</Badge></TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {canDelete && (
                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setQuotationToDelete(quote)} className="text-destructive">Delete</DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No quotations found.</TableCell></TableRow>
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
      <AlertDialog open={!!quotationToDelete} onOpenChange={(isOpen) => !isOpen && setQuotationToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Quotations;