import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle, Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';
import { useCurrency } from '@/hooks/useCurrency';

interface Courier {
  id: string;
  name: string;
  first_kg_price: number;
  additional_kg_price: number;
}

const CourierDialog = ({ isOpen, courier, onSave, onClose }: { isOpen: boolean, courier?: Courier | null, onSave: (data: Omit<Courier, 'id'>, id?: string) => void, onClose: () => void }) => {
  const [name, setName] = useState('');
  const [firstKgPrice, setFirstKgPrice] = useState(0);
  const [additionalKgPrice, setAdditionalKgPrice] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setName(courier?.name || '');
      setFirstKgPrice(courier?.first_kg_price || 0);
      setAdditionalKgPrice(courier?.additional_kg_price || 0);
    }
  }, [isOpen, courier]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), first_kg_price: firstKgPrice, additional_kg_price: additionalKgPrice }, courier?.id);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{courier ? 'Edit' : 'Add'} Courier</DialogTitle>
        <DialogDescription>Enter the details for the courier below.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit}>
        <div className="py-4 space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="first_kg_price">First KG Price</Label>
            <Input id="first_kg_price" type="number" value={firstKgPrice} onChange={(e) => setFirstKgPrice(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label htmlFor="additional_kg_price">Additional KG Price</Label>
            <Input id="additional_kg_price" type="number" value={additionalKgPrice} onChange={(e) => setAdditionalKgPrice(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button></DialogClose>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
};

export function CourierManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCourier, setSelectedCourier] = useState<Courier | null>(null);
  const { format } = useCurrency();

  const { data: couriers, isLoading } = useQuery<Courier[]>({
    queryKey: ['couriers'],
    queryFn: () => authenticatedFetch('/api/couriers'),
  });

  const mutation = useMutation({
    mutationFn: ({ data, id }: { data: Omit<Courier, 'id'>, id?: string }) => {
      const url = id ? `/api/couriers/${id}` : '/api/couriers';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Courier updated!' : 'Courier added!');
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
      setIsDialogOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/couriers/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Courier deactivated!');
      queryClient.invalidateQueries({ queryKey: ['couriers'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleSave = (data: Omit<Courier, 'id'>, id?: string) => {
    mutation.mutate({ data, id });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Couriers</CardTitle>
          <CardDescription>Manage the couriers available for delivery.</CardDescription>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { setSelectedCourier(null); setIsDialogOpen(true); }}>
          <PlusCircle className="h-3.5 w-3.5" />
          Add Courier
        </Button>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>First KG Price</TableHead>
                <TableHead>Additional KG Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
              ) : couriers?.map((courier) => (
                <TableRow key={courier.id}>
                  <TableCell className="font-medium">{courier.name}</TableCell>
                  <TableCell>{format(courier.first_kg_price)}</TableCell>
                  <TableCell>{format(courier.additional_kg_price)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCourier(courier); setIsDialogOpen(true); }}>Edit</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(courier.id)}>Deactivate</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <CourierDialog isOpen={isDialogOpen} courier={selectedCourier} onSave={handleSave} onClose={() => setIsDialogOpen(false)} />
      </Dialog>
    </Card>
  );
}