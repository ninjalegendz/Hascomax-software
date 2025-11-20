import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Edit, Save } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';

interface Unit {
  id: string;
  name: string;
}

interface UnitManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function UnitManagerDialog({ isOpen, onOpenChange }: UnitManagerDialogProps) {
  const queryClient = useQueryClient();
  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');

  const { data: units, isLoading } = useQuery<Unit[]>({
    queryKey: ['productUnits'],
    queryFn: () => authenticatedFetch('/api/product-units'),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: ({ name, id }: { name: string, id?: string }) => {
      const url = id ? `/api/product-units/${id}` : '/api/product-units';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify({ name }) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Unit updated!' : 'Unit added!');
      queryClient.invalidateQueries({ queryKey: ['productUnits'] });
      setNewUnitName('');
      setEditingUnitId(null);
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleAddUnit = () => {
    if (newUnitName.trim()) {
      mutation.mutate({ name: newUnitName.trim() });
    }
  };

  const handleUpdateUnit = (id: string) => {
    if (editingUnitName.trim()) {
      mutation.mutate({ name: editingUnitName.trim(), id });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Product Units</DialogTitle>
          <DialogDescription>Add or edit your product units.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New unit name..."
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
            />
            <Button onClick={handleAddUnit} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
          <div className="border rounded-md max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : units?.map((unit) => (
                  <TableRow key={unit.id}>
                    <TableCell>
                      {editingUnitId === unit.id ? (
                        <Input value={editingUnitName} onChange={(e) => setEditingUnitName(e.target.value)} />
                      ) : (
                        unit.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingUnitId === unit.id ? (
                        <Button variant="ghost" size="icon" onClick={() => handleUpdateUnit(unit.id)}><Save className="h-4 w-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => { setEditingUnitId(unit.id); setEditingUnitName(unit.name); }}><Edit className="h-4 w-4" /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}