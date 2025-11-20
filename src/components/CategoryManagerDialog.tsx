import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Edit, Save } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { showError, showSuccess } from '@/utils/toast';

interface Category {
  id: string;
  name: string;
}

interface CategoryManagerDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function CategoryManagerDialog({ isOpen, onOpenChange }: CategoryManagerDialogProps) {
  const queryClient = useQueryClient();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const { data: categories, isLoading } = useQuery<Category[]>({
    queryKey: ['productCategories'],
    queryFn: () => authenticatedFetch('/api/product-categories'),
    enabled: isOpen,
  });

  const mutation = useMutation({
    mutationFn: ({ name, id }: { name: string, id?: string }) => {
      const url = id ? `/api/product-categories/${id}` : '/api/product-categories';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify({ name }) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Category updated!' : 'Category added!');
      queryClient.invalidateQueries({ queryKey: ['productCategories'] });
      setNewCategoryName('');
      setEditingCategoryId(null);
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleAddCategory = () => {
    if (newCategoryName.trim()) {
      mutation.mutate({ name: newCategoryName.trim() });
    }
  };

  const handleUpdateCategory = (id: string) => {
    if (editingCategoryName.trim()) {
      mutation.mutate({ name: editingCategoryName.trim(), id });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Product Categories</DialogTitle>
          <DialogDescription>Add or edit your product categories.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="New category name..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
            />
            <Button onClick={handleAddCategory} disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add
            </Button>
          </div>
          <div className="border rounded-md max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category Name</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={2} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : categories?.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell>
                      {editingCategoryId === cat.id ? (
                        <Input value={editingCategoryName} onChange={(e) => setEditingCategoryName(e.target.value)} />
                      ) : (
                        cat.name
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingCategoryId === cat.id ? (
                        <Button variant="ghost" size="icon" onClick={() => handleUpdateCategory(cat.id)}><Save className="h-4 w-4" /></Button>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name); }}><Edit className="h-4 w-4" /></Button>
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