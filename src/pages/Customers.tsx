import React, { useState } from "react";
import { MoreHorizontal, PlusCircle, Upload, Loader2, ArrowUpDown, Download } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTablePagination } from "@/components/DataTablePagination";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { Customer } from "@/types";
import { useCustomers, useAddCustomer, useUpdateCustomer, useDeleteCustomer, useMergeCustomers, useImportCustomers, useBulkDeleteCustomers, CustomerFormValues } from "@/hooks/useCustomerData";
import { usePermissions } from "@/hooks/usePermissions";
import { MergeCustomersDialog } from "@/components/MergeCustomersDialog";
import { CustomerImporter } from "@/components/CustomerImporter";
import { type StagedCustomer } from "@/types/schemas";
import { CustomerEditorDialog } from "@/components/CustomerEditorDialog";
import { useCurrency } from "@/hooks/useCurrency";
import useLocalStorageState from "@/hooks/useLocalStorageState";
import { useIsMobile } from "@/hooks/use-mobile";
import { CustomerCard } from "@/components/CustomerCard";
import { BulkMergeDialog } from "@/components/BulkMergeDialog";
import { authenticatedFetch } from "@/lib/api";
import { showError, showSuccess } from "@/utils/toast";
import { useExport } from "@/hooks/useExport";

const Customers = () => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [mergeDestinationCustomer, setMergeDestinationCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('customers-sorting', { sortBy: 'created_at', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isBulkMergeOpen, setIsBulkMergeOpen] = useState(false);
  const [customersToMerge, setCustomersToMerge] = useState<Customer[]>([]);

  const navigate = useNavigate();
  const { format } = useCurrency();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { handleExport } = useExport();

  const canCreate = usePermissions('customers:create');
  const canEdit = usePermissions('customers:edit:details');
  const canDelete = usePermissions('customers:delete');
  const canViewFinancials = usePermissions('customers:view:financials');
  const canManageLinks = usePermissions('customers:manage:links');

  const { data, isLoading, isFetching } = useCustomers({ searchTerm, page: currentPage, pageSize, sortBy: sorting.sortBy, sortOrder: sorting.sortOrder, status: statusFilter });
  const addMutation = useAddCustomer();
  const updateMutation = useUpdateCustomer();
  const deleteMutation = useDeleteCustomer();
  const bulkDeleteMutation = useBulkDeleteCustomers();
  const mergeMutation = useMergeCustomers();
  const importMutation = useImportCustomers();

  const bulkMergeMutation = useMutation({
    mutationFn: async ({ destinationId, sourceIds }: { destinationId: string, sourceIds: string[] }) => {
        for (const sourceId of sourceIds) {
            await authenticatedFetch('/api/customers/merge', {
                method: 'POST',
                body: JSON.stringify({ sourceId, destinationId }),
            });
        }
    },
    onSuccess: () => {
        showSuccess("Customers merged successfully!");
        queryClient.invalidateQueries({ queryKey: ['customers'] });
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        setIsBulkMergeOpen(false);
        setSelectedCustomerIds([]);
    },
    onError: (error) => {
        showError(`Failed to merge customers: ${(error as Error).message}`);
    },
  });

  const customers = data?.customers || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSaveCustomer = (values: CustomerFormValues, id?: string) => {
    if (id) {
      updateMutation.mutate({ id, values }, { onSuccess: () => setIsAddDialogOpen(false) });
    } else {
      addMutation.mutate(values, { onSuccess: () => setIsAddDialogOpen(false) });
    }
  };

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  const handleDeleteClick = (customer: Customer) => {
    setCustomerToDelete(customer);
  };

  const confirmDelete = () => {
    if (customerToDelete) {
      deleteMutation.mutate(customerToDelete);
    }
    setCustomerToDelete(null);
  };

  const handleBulkDelete = () => {
    bulkDeleteMutation.mutate(selectedCustomerIds, {
      onSuccess: () => setSelectedCustomerIds([]),
    });
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsAddDialogOpen(true);
  };

  const handleAddClick = () => {
    setEditingCustomer(null);
    setIsAddDialogOpen(true);
  };

  const handleMerge = (customer: Customer) => {
    setMergeDestinationCustomer(customer);
    setIsMergeDialogOpen(true);
  };

  const handleConfirmMerge = (sourceCustomerId: string, destinationCustomerId: string) => {
    mergeMutation.mutate({ sourceId: sourceCustomerId, destinationId: destinationCustomerId });
    setIsMergeDialogOpen(false);
    setMergeDestinationCustomer(null);
  };

  const handleImportCustomers = (stagedCustomers: StagedCustomer[]) => {
    importMutation.mutate(stagedCustomers);
    setIsImportDialogOpen(false);
  };

  const handleBulkMergeClick = () => {
    const selectedCustomers = customers.filter(c => selectedCustomerIds.includes(c.id));
    setCustomersToMerge(selectedCustomers);
    setIsBulkMergeOpen(true);
  };

  const handleConfirmBulkMerge = (destinationId: string, sourceIds: string[]) => {
    bulkMergeMutation.mutate({ destinationId, sourceIds });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Customers</CardTitle>
            <CardDescription>Manage your customers and their details.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('customers')}>
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Export</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Export all customers to a CSV file</p></TooltipContent>
            </Tooltip>
            {canCreate && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsImportDialogOpen(true)}>
                      <Upload className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Import</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Import customers from a CSV file</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="sm" className="gap-1" onClick={handleAddClick}>
                      <PlusCircle className="h-3.5 w-3.5" />
                      <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Add Customer</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Create a new customer profile</p></TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-2 mb-4">
            <Input
              placeholder="Search customers..."
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
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            {(isLoading || isFetching) && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-10">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            {selectedCustomerIds.length > 0 && (
              <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-md mb-4">
                <p className="text-sm font-medium">{selectedCustomerIds.length} selected</p>
                {canDelete && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">Delete Selected</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete {selectedCustomerIds.length} customer(s). Their historical data like invoices will be retained. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleBulkDelete}>Continue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {selectedCustomerIds.length > 1 && canManageLinks && (
                  <Button variant="outline" size="sm" onClick={handleBulkMergeClick}>Merge Selected</Button>
                )}
              </div>
            )}
            {isMobile ? (
              <div className="space-y-4">
                {customers.map((customer) => (
                  <CustomerCard
                    key={customer.id}
                    customer={customer}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onMerge={handleMerge}
                    onNavigate={(id) => navigate(`/customers/${id}`)}
                    canEdit={canEdit}
                    canDelete={canDelete}
                    canManageLinks={canManageLinks}
                    canViewFinancials={canViewFinancials}
                  />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-9">
                        <Checkbox
                          checked={selectedCustomerIds.length === customers.length && customers.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCustomerIds(customers.map(c => c.id));
                            } else {
                              setSelectedCustomerIds([]);
                            }
                          }}
                          aria-label="Select all"
                          disabled={!canDelete}
                        />
                      </TableHead>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('customer_number')}>ID <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('name')}>Name <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('status')}>Status <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                      <TableHead><Button variant="ghost" onClick={() => handleSort('creator_name')}>Created By <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                      {canViewFinancials && <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('balance')}>Balance <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>}
                      <TableHead><span className="sr-only">Actions</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.length > 0 ? (
                      customers.map((customer) => (
                        <TableRow key={customer.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => navigate(`/customers/${customer.id}`)}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedCustomerIds.includes(customer.id)}
                              onCheckedChange={(checked) => {
                                setSelectedCustomerIds(prev => 
                                  checked ? [...prev, customer.id] : prev.filter(id => id !== customer.id)
                                );
                              }}
                              aria-label="Select row"
                              disabled={!canDelete || customer.name === 'Walk-in Customer'}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{customer.customerNumber}</TableCell>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-muted-foreground">{customer.email}</div>
                          </TableCell>
                          <TableCell><Badge variant={customer.status === "Active" ? "default" : "outline"}>{customer.status}</Badge></TableCell>
                          <TableCell>{customer.creatorName || 'N/A'}</TableCell>
                          {canViewFinancials && (
                            <TableCell className={`text-right font-medium ${customer.balance < 0 ? 'text-destructive' : ''}`}>
                              {format(customer.balance)} {customer.balance < 0 ? 'Dr' : customer.balance > 0 ? 'Cr' : ''}
                            </TableCell>
                          )}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /><span className="sr-only">Toggle menu</span></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                {canEdit && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(customer); }}>Edit</DropdownMenuItem>}
                                {canManageLinks && <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMerge(customer); }} disabled={customer.name === 'Walk-in Customer'}>Merge Into...</DropdownMenuItem>}
                                {canDelete && <DropdownMenuItem onSelect={(e) => e.preventDefault()} onClick={() => handleDeleteClick(customer)} disabled={customer.name === 'Walk-in Customer'} className="text-destructive">Delete</DropdownMenuItem>}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={canViewFinancials ? 7 : 6} className="h-24 text-center">No customers found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
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

      <CustomerEditorDialog 
        isOpen={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        customer={editingCustomer}
        onSave={handleSaveCustomer}
        isSaving={addMutation.isPending || updateMutation.isPending}
      />

      <MergeCustomersDialog
        isOpen={isMergeDialogOpen}
        onOpenChange={setIsMergeDialogOpen}
        destinationCustomer={mergeDestinationCustomer}
        allCustomers={customers}
        onConfirmMerge={handleConfirmMerge}
      />

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <CustomerImporter onImport={handleImportCustomers} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!customerToDelete} onOpenChange={(isOpen) => !isOpen && setCustomerToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This will permanently delete this customer. Their historical records will be retained.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BulkMergeDialog
        isOpen={isBulkMergeOpen}
        onOpenChange={setIsBulkMergeOpen}
        customers={customersToMerge}
        onConfirmMerge={handleConfirmBulkMerge}
        isMerging={bulkMergeMutation.isPending}
      />
    </>
  );
};

export default Customers;