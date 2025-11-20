import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, PlusCircle, MoreHorizontal, Settings, ArrowUpDown, Download } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Expense, ExpenseCategory } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { showError, showSuccess } from '@/utils/toast';
import { usePermissions } from '@/hooks/usePermissions';
import { useCurrency } from '@/hooks/useCurrency';
import { ExpenseEditorDialog } from '@/components/ExpenseEditorDialog';
import { ExpenseCategoryManagerDialog } from '@/components/ExpenseCategoryManagerDialog';
import { DataTablePagination } from '@/components/DataTablePagination';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerWithRange } from '@/components/ui/datepicker-with-range';
import { DateRange } from 'react-day-picker';
import useLocalStorageState from '@/hooks/useLocalStorageState';
import { useExport } from '@/hooks/useExport';

const Expenses = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sorting, setSorting] = useLocalStorageState('expenses-sorting', { sortBy: 'date', sortOrder: 'DESC' as 'ASC' | 'DESC' });
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const { handleExport } = useExport();

  const canCreate = usePermissions('expenses:create');
  const canEdit = usePermissions('expenses:edit');
  const canDelete = usePermissions('expenses:delete');
  const canManageCategories = usePermissions('settings:manage:expense-categories');

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', searchTerm, currentPage, pageSize, sorting, categoryFilter, dateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ 
        searchTerm, 
        page: String(currentPage), 
        pageSize: String(pageSize), 
        sortBy: sorting.sortBy, 
        sortOrder: sorting.sortOrder,
        category: categoryFilter
      });
      if (dateRange?.from) params.append('startDate', dateRange.from.toISOString());
      if (dateRange?.to) params.append('endDate', dateRange.to.toISOString());
      const res = await authenticatedFetch(`/api/expenses?${params}`);
      return res as { expenses: Expense[], count: number };
    },
    enabled: !!profile,
  });

  const { data: categories } = useQuery<ExpenseCategory[]>({
    queryKey: ['expenseCategories'],
    queryFn: () => authenticatedFetch('/api/expense-categories'),
    enabled: !!profile,
  });

  const mutation = useMutation({
    mutationFn: async ({ values, id, receipt }: { values: any, id?: string, receipt?: File }) => {
      const url = id ? `/api/expenses/${id}` : '/api/expenses';
      const method = id ? 'PUT' : 'POST';
      const expense = await authenticatedFetch(url, { method, body: JSON.stringify(values) });
      
      if (receipt) {
        const formData = new FormData();
        formData.append('receipt', receipt);
        await authenticatedFetch(`/api/expenses/${expense.id}/receipt`, { method: 'POST', body: formData });
      }
      return { id };
    },
    onSuccess: ({ id }) => {
      showSuccess(id ? 'Expense updated!' : 'Expense logged!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setIsEditorOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/expenses/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Expense deleted!');
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleSave = (values: any, id?: string, receipt?: File) => {
    mutation.mutate({ values, id, receipt });
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedExpense(null);
    setIsEditorOpen(true);
  };

  const handleSort = (column: string) => {
    setSorting(prev => ({
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'ASC' ? 'DESC' : 'ASC'
    }));
  };

  const expenses = data?.expenses || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Business Expenses</CardTitle>
            <CardDescription>Track and manage all your business-related expenses.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('expenses')}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            {canManageCategories && (
              <Button size="sm" variant="outline" className="gap-1" onClick={() => setIsCategoryManagerOpen(true)}>
                <Settings className="h-3.5 w-3.5" />
                Manage Categories
              </Button>
            )}
            {canCreate && (
              <Button size="sm" className="gap-1" onClick={handleCreate}>
                <PlusCircle className="h-3.5 w-3.5" />
                Log Expense
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Input
              placeholder="Search by description or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <DatePickerWithRange date={dateRange} setDate={setDateRange} />
          </div>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Button variant="ghost" onClick={() => handleSort('date')}>Date <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead><Button variant="ghost" onClick={() => handleSort('category_name')}>Category <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Logged By</TableHead>
                  <TableHead className="text-right"><Button variant="ghost" onClick={() => handleSort('amount')}>Amount <ArrowUpDown className="ml-2 h-4 w-4 inline" /></Button></TableHead>
                  <TableHead><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : expenses.length > 0 ? (
                  expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatDateSafe(expense.date, "PPP")}</TableCell>
                      <TableCell className="font-medium">{expense.description}</TableCell>
                      <TableCell>{expense.category_name}</TableCell>
                      <TableCell>{expense.vendor}</TableCell>
                      <TableCell>{expense.creator_name}</TableCell>
                      <TableCell className="text-right">{format(expense.amount)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent>
                            {canEdit && <DropdownMenuItem onClick={() => handleEdit(expense)}>Edit</DropdownMenuItem>}
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this expense log.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(expense.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center">No expenses found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
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
      <ExpenseEditorDialog
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSave}
        expense={selectedExpense}
        isSaving={mutation.isPending}
      />
      <ExpenseCategoryManagerDialog
        isOpen={isCategoryManagerOpen}
        onOpenChange={setIsCategoryManagerOpen}
      />
    </>
  );
};

export default Expenses;