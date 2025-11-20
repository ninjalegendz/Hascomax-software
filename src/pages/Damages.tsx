import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, PlusCircle, MoreHorizontal, Download } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { DamagedItem } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { DamageEditorDialog } from '@/components/DamageEditorDialog';
import { showError, showSuccess } from '@/utils/toast';
import { z } from 'zod';
import { usePermissions } from '@/hooks/usePermissions';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useExport } from '@/hooks/useExport';

const damageSchema = z.object({
  product_id: z.string().min(1, "Product is required."),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1."),
  notes: z.string().optional(),
  status: z.enum(['Pending Assessment', 'Repairable', 'Unrepairable']),
});

const Damages = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<Partial<DamagedItem> | null>(null);
  const { handleExport } = useExport();
  
  const canCreate = usePermissions('damages:create');
  const canEdit = usePermissions('damages:edit');
  const canDelete = usePermissions('damages:delete');

  const { data: damagedItems, isLoading } = useQuery<DamagedItem[]>({
    queryKey: ['damages'],
    queryFn: () => authenticatedFetch('/api/damages'),
    enabled: !!profile,
  });

  const mutation = useMutation({
    mutationFn: ({ values, id }: { values: z.infer<typeof damageSchema>, id?: string }) => {
      const url = id ? `/api/damages/${id}` : '/api/damages';
      const method = id ? 'PUT' : 'POST';
      return authenticatedFetch(url, { method, body: JSON.stringify(values) });
    },
    onSuccess: (_, { id }) => {
      showSuccess(id ? 'Damage log updated!' : 'Damaged stock logged!');
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIsEditorOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => authenticatedFetch(`/api/damages/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      showSuccess('Damage log deleted. Note: Stock was not automatically adjusted.');
      queryClient.invalidateQueries({ queryKey: ['damages'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const startRepairMutation = useMutation({
    mutationFn: (damageLogId: string) => authenticatedFetch('/api/repairs/from-damage', {
      method: 'POST',
      body: JSON.stringify({ damageLogId }),
    }),
    onSuccess: (data) => {
      showSuccess('Repair order created successfully!');
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['repairs'] });
      navigate(`/repairs/${data.repairId}`);
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleSave = (values: z.infer<typeof damageSchema>, id?: string) => {
    mutation.mutate({ values, id });
  };

  const handleEdit = (log: DamagedItem) => {
    setSelectedLog(log);
    setIsEditorOpen(true);
  };

  const handleCreate = () => {
    setSelectedLog(null);
    setIsEditorOpen(true);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Damaged Stock</CardTitle>
            <CardDescription>A log of all items reported as damaged.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1" onClick={() => handleExport('damages')}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            {canCreate && (
              <Button size="sm" className="gap-1" onClick={handleCreate}>
                <PlusCircle className="h-3.5 w-3.5" />
                Log Damage
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Reported By</TableHead>
                  <TableHead>Date Reported</TableHead>
                  {(canEdit || canDelete) && <TableHead><span className="sr-only">Actions</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={(canEdit || canDelete) ? 8 : 7} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : damagedItems && damagedItems.length > 0 ? (
                  damagedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.product_name}</TableCell>
                      <TableCell>{item.product_sku}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell><Badge>{item.status || 'N/A'}</Badge></TableCell>
                      <TableCell>{item.notes}</TableCell>
                      <TableCell>{item.logger_name}</TableCell>
                      <TableCell>{formatDateSafe(item.logged_at, "PPP p")}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                              {canEdit && item.status === 'Repairable' && !item.repair_id && (
                                <DropdownMenuItem onClick={() => startRepairMutation.mutate(item.id)} disabled={startRepairMutation.isPending}>
                                  Start Repair
                                </DropdownMenuItem>
                              )}
                              {canEdit && <DropdownMenuItem onClick={() => handleEdit(item)}>Edit</DropdownMenuItem>}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this log. Stock will NOT be automatically adjusted. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => deleteMutation.mutate(item.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={(canEdit || canDelete) ? 8 : 7} className="h-24 text-center">No damaged items have been reported.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <DamageEditorDialog
        isOpen={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        onSave={handleSave}
        damageLog={selectedLog}
        isSaving={mutation.isPending}
      />
    </>
  );
};

export default Damages;