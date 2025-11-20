import React, { useState } from "react";
import { z } from "zod";
import { MoreHorizontal, PlusCircle, Loader2, ArrowUpDown, Download } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { DateRange } from "react-day-picker";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/datepicker-with-range";
import { DataTablePagination } from "@/components/DataTablePagination";
import { showError, showSuccess } from "@/utils/toast";
import type { Purchase } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateSafe } from "@/utils/date";
import { authenticatedFetch } from "@/lib/api";
import { useCurrency } from "@/hooks/useCurrency";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReceivePurchaseDialog } from "@/components/ReceivePurchaseDialog";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { PurchaseEditorDialog } from "@/components/PurchaseEditorDialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { PurchaseCard } from "@/components/PurchaseCard";
import { usePermissions } from "@/hooks/usePermissions";
import { useExport } from "@/hooks/useExport";

const purchaseSchema = z.object({
  product_id: z.string().min(1, "Product is required."),
  quantity_purchased: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  unit_cost: z.coerce.number().min(0.01, "Cost must be positive."),
  purchase_date: z.date(),
  supplier: z.string().optional(),
});

const statusVariantMap: Record<Purchase["status"], "default" | "secondary" | "outline"> = {
  "Completed": "default",
  "Partially Received": "secondary",
  "Pending": "outline",
};

const Purchases = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [purchaseToDelete, setPurchaseToDelete] = useState<Purchase | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('purchases-sorting', { sortBy: 'purchase_date', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const { profile } = useAuth();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const { handleExport } = useExport();

  const canCreate = usePermissions('purchases:create');
  const canEdit = usePermissions('purchases:edit');
  const canDelete = usePermissions('purchases:delete');

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', searchTerm, currentPage, pageSize, sorting, statusFilter, dateRange],
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
      const res = await authenticatedFetch(`/api/purchases?${params}`);
      const formattedPurchases = res.purchases.map((p: any) => ({
        ...p,
        products: { name: p.product_name, sku: p.product_sku },
        creatorName: p.creator_name,
      }));
      return { purchases: formattedPurchases, count: res.count };
    },
    enabled: !!profile,
  });

  const purchases = data?.purchases || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const mutation = useMutation({
    mutationFn: ({ values, id }: { values: z.infer<typeof purchaseSchema>, id?: string }) => {
      const url = id ? `/api/purchases/${id}` : '/api/purchases';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify(values) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Purchase updated successfully!' : 'Purchase order created successfully!');
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsEditorOpen(false);
    },
    onError: (error) => {
      showError(`Failed: ${(error as Error).message}`);
    },
  });

  const handleSave = (values: z.infer<typeof purchaseSchema>, id?: string) => {
    mutation.mutate({ values, id });
  };

  const handleEditClick = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setIsEditorOpen(true);
  };

  const handleAddClick = () => {
    setEditingPurchase(null);
    setIsEditorOpen(true);
  };

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  async function confirmDelete() {
    if (!purchaseToDelete) return;
    try {
      await authenticatedFetch(`/api/purchases/${purchaseToDelete.id}`, { method: 'DELETE' });
      showSuccess("Purchase deleted.");
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
    } catch (error) {
      showError((error as Error).message);
    } finally {
      setPurchaseToDelete(null);
    }
  }

  const handleReceiveClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setIsReceiveOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Purchases</CardTitle>
            <CardDescription>Record and manage your incoming inventory.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('purchases')}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export all purchases to a CSV file</p></TooltipContent>
            </Tooltip>
            {canCreate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" className="gap-1" onClick={handleAddClick}>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Purchase</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Record a new stock purchase.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Input
              placeholder="Search by product name or SKU..."
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
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partially Received">Partially Received</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
          {isMobile ? (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : purchases.length > 0 ? (
                purchases.map((purchase) => (
                  <PurchaseCard
                    key={purchase.id}
                    purchase={purchase}
                    onEdit={handleEditClick}
                    onDeleteTrigger={setPurchaseToDelete}
                    onReceive={handleReceiveClick}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-10">No purchases found.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('product_name')}>Product <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('purchase_date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('quantity_purchased')}>Qty Ordered <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('total_received')}>Qty Received <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><Button variant="ghost" onClick={() => handleSort('creator_name')}>Created By <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('unit_cost')}>Unit Cost <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                    <TableHead><span className="sr-only">Actions</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : purchases.length > 0 ? (
                    purchases.map((purchase) => (
                      <TableRow key={purchase.id}>
                        <TableCell className="font-medium">{purchase.products.name} <span className="text-muted-foreground">({purchase.products.sku})</span></TableCell>
                        <TableCell>{formatDateSafe(purchase.purchase_date)}</TableCell>
                        <TableCell><Badge variant={statusVariantMap[purchase.status]}>{purchase.status}</Badge></TableCell>
                        <TableCell>{purchase.quantity_purchased}</TableCell>
                        <TableCell>{purchase.total_received}</TableCell>
                        <TableCell>{purchase.creatorName || 'N/A'}</TableCell>
                        <TableCell className="text-right">{format(purchase.unit_cost)}</TableCell>
                        <TableCell>
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
                              {canEdit && <DropdownMenuItem onClick={() => handleReceiveClick(purchase)}>View/Receive Items</DropdownMenuItem>}
                              {canEdit && <DropdownMenuItem onClick={() => handleEditClick(purchase)} disabled={purchase.total_received > 0}>Edit</DropdownMenuItem>}
                              {canDelete && <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => setPurchaseToDelete(purchase)} className="text-destructive">Delete</DropdownMenuItem>}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={8} className="h-24 text-center">No purchases recorded.</TableCell></TableRow>
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
      <ReceivePurchaseDialog
        isOpen={isReceiveOpen}
        onOpenChange={setIsReceiveOpen}
        purchase={selectedPurchase}
      />
      <PurchaseEditorDialog
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSave}
        isSaving={mutation.isPending}
        purchase={editingPurchase}
      />
      <AlertDialog open={!!purchaseToDelete} onOpenChange={(isOpen) => !isOpen && setPurchaseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this purchase record. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Purchases;