import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, MoreHorizontal, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';

interface PaymentMethod {
  id: string;
  name: string;
}

const PaymentMethodDialog = ({ isOpen, method, onSave, onClose }: { isOpen: boolean, method?: PaymentMethod | null, onSave: (name: string, id?: string) => void, onClose: () => void }) => {
  const [name, setName] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(method?.name || '');
    }
  }, [isOpen, method]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), method?.id);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{method ? 'Edit' : 'Add'} Payment Method</DialogTitle>
        <DialogDescription>Enter the name for the payment method below.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="py-4">
          <Label htmlFor="name">Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button></DialogClose>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export function PaymentMethodsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);

  const { data: methods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ['paymentMethods'],
    queryFn: () => authenticatedFetch('/api/payment-methods'),
  });

  const mutation = useMutation({
    mutationFn: ({ name, id }: { name: string, id?: string }) => {
      const url = id ? `/api/payment-methods/${id}` : '/api/payment-methods';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify({ name }) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Payment method updated!' : 'Payment method added!');
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
      setIsDialogOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/payment-methods/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Payment method deleted!');
      queryClient.invalidateQueries({ queryKey: ['paymentMethods'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleSave = (name: string, id?: string) => {
    mutation.mutate({ name, id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Payment Methods</CardTitle>
          <CardDescription>Manage the payment options available for transactions.</CardDescription>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setSelectedMethod(null); setIsDialogOpen(true); }}>
          <PlusCircle className="h-3.5 w-3.5" />
          Add Method
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : methods?.map((method) => (
                <TableRow key={method.id}>
                  <TableCell className="font-medium">{method.name}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedMethod(method); setIsDialogOpen(true); }}>Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-destructive">Delete</Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will deactivate the payment method. It will no longer be available for new transactions but will remain on past records.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(method.id)}>Deactivate</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <PaymentMethodDialog isOpen={isDialogOpen} method={selectedMethod} onSave={handleSave} onClose={() => setIsDialogOpen(false)} />
      </Dialog>
    </Card>
  );
}