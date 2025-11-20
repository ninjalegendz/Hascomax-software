import React, { useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react';
import { ReturnReceiptTemplate } from '@/components/ReturnReceiptTemplate';
import { PrintControl } from '@/components/PrintControl';
import { authenticatedFetch } from '@/lib/api';
import type { Return } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { showError, showSuccess } from '@/utils/toast';
import { useCurrency } from '@/hooks/useCurrency';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const ReturnDetails = () => {
  const { id } = useParams<{ id: string }>();
  const printRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { format } = useCurrency();

  const { data: returnData, isLoading, isError } = useQuery<Return>({
    queryKey: ['return', id],
    queryFn: () => authenticatedFetch(`/api/returns/${id}`),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => authenticatedFetch(`/api/returns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Return successfully deleted and reversed.');
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      navigate('/returns');
    },
    onError: (error) => {
      showError((error as Error).message);
    },
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isError || !returnData) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Return not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/returns"><ArrowLeft className="mr-2 h-4 w-4" />Back to Returns</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="icon"><Link to="/returns"><ArrowLeft className="h-4 w-4" /></Link></Button>
          <h1 className="text-2xl font-bold tracking-tight">Return {returnData.return_receipt_number}</h1>
        </div>
        <div className="flex gap-2">
          <PrintControl documentRef={printRef} fileName={`Return-${returnData.return_receipt_number}`} />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete Return
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this return and reverse all associated transactions, including refunds and stock adjustments. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
                  {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Yes, delete this return
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <ReturnReceiptTemplate ref={printRef} returnData={returnData} />
        </CardContent>
      </Card>

      {returnData.expenses && returnData.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Return Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnData.expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.description}</TableCell>
                    <TableCell className="text-right">{format(expense.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReturnDetails;