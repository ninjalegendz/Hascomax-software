import React, { useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Loader2, User, Wrench, Calendar, FileText, PackagePlus, Trash2, CheckCircle, XCircle, Replace, ShieldOff, CreditCard } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import type { Repair } from '@/types';
import { formatDateSafe } from '@/utils/date';
import { RepairImageUploader } from '@/components/RepairImageUploader';
import { Badge } from '@/components/ui/badge';
import { showError, showSuccess } from '@/utils/toast';
import { AddRepairItemDialog } from '@/components/AddRepairItemDialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCurrency } from '@/hooks/useCurrency';
import { CompleteRepairDialog } from '@/components/CompleteRepairDialog';
import { PrintControl } from '@/components/PrintControl';
import { RepairJobCardTemplate } from '@/components/RepairJobCardTemplate';
import { CreateReplacementDialog } from '@/components/CreateReplacementDialog';
import { VoidWarrantyDialog } from '@/components/VoidWarrantyDialog';
import { Input } from '@/components/ui/input';
import { IssueCreditDialog } from '@/components/IssueCreditDialog';
import { usePermissions } from '@/hooks/usePermissions';

const RepairDetails = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isReplacementOpen, setIsReplacementOpen] = useState(false);
  const [isVoidWarrantyOpen, setIsVoidWarrantyOpen] = useState(false);
  const [isIssueCreditOpen, setIsIssueCreditOpen] = useState(false);
  const jobCardRef = useRef<HTMLDivElement>(null);

  const canEdit = usePermissions('repairs:edit');

  const { data, isLoading, isError } = useQuery<{ repair: Repair }>({
    queryKey: ['repair', id],
    queryFn: () => authenticatedFetch(`/api/repairs/${id}`),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (status: string) => authenticatedFetch(`/api/repairs/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
    onSuccess: () => {
      showSuccess('Repair status updated!');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const addItemMutation = useMutation({
    mutationFn: (itemData: { productId: string, quantity: number }) => authenticatedFetch(`/api/repairs/${id}/items`, {
      method: 'POST',
      body: JSON.stringify(itemData),
    }),
    onSuccess: () => {
      showSuccess('Part added to repair.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const removeItemMutation = useMutation({
    mutationFn: (itemId: string) => authenticatedFetch(`/api/repairs/${id}/items/${itemId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      showSuccess('Part removed from repair.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const updateItemPriceMutation = useMutation({
    mutationFn: ({ itemId, price }: { itemId: string, price: number }) => authenticatedFetch(`/api/repairs/${id}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ price }),
    }),
    onSuccess: () => {
      showSuccess('Part price updated.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const completeMutation = useMutation({
    mutationFn: (values: { repairFee?: number; notes?: string }) => {
      const payload = {
        repairFee: values.repairFee ?? 0,
        notes: values.notes,
      };
      return authenticatedFetch(`/api/repairs/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (data) => {
      showSuccess('Repair completed and invoice generated!');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (error) => showError((error as Error).message),
  });

  const replacementMutation = useMutation({
    mutationFn: (values: any) => authenticatedFetch(`/api/repairs/${id}/create-replacement`, {
      method: 'POST',
      body: JSON.stringify(values),
    }),
    onSuccess: (data) => {
      showSuccess('Replacement invoice created successfully!');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      navigate(`/invoices/${data.invoiceId}`);
    },
    onError: (error) => showError((error as Error).message),
  });

  const repairedMutation = useMutation({
    mutationFn: () => authenticatedFetch(`/api/repairs/${id}/mark-repaired`, {
      method: 'POST',
    }),
    onSuccess: () => {
      showSuccess('Repair marked as repaired and item returned to stock.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      queryClient.invalidateQueries({ queryKey: ['damages'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const unrepairableMutation = useMutation({
    mutationFn: () => authenticatedFetch(`/api/repairs/${id}/mark-unrepairable`, {
      method: 'POST',
    }),
    onSuccess: () => {
      showSuccess('Repair marked as unrepairable.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      queryClient.invalidateQueries({ queryKey: ['damages'] });
    },
    onError: (error) => showError((error as Error).message),
  });

  const voidWarrantyMutation = useMutation({
    mutationFn: (values: { reason: string }) => authenticatedFetch(`/api/repairs/${id}/void-warranty`, {
      method: 'POST',
      body: JSON.stringify(values),
    }),
    onSuccess: () => {
      showSuccess('Warranty has been voided.');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      setIsVoidWarrantyOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const issueCreditMutation = useMutation({
    mutationFn: (values: { amount: number; notes?: string }) => authenticatedFetch(`/api/repairs/${id}/issue-credit`, {
      method: 'POST',
      body: JSON.stringify(values),
    }),
    onSuccess: () => {
      showSuccess('Store credit issued successfully!');
      queryClient.invalidateQueries({ queryKey: ['repair', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setIsIssueCreditOpen(false);
    },
    onError: (error) => showError((error as Error).message),
  });

  const handleUploadSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['repair', id] });
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Repair Order Not Found</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/repairs"><ArrowLeft className="mr-2 h-4 w-4" />Back to Repairs</Link>
        </Button>
      </div>
    );
  }

  const { repair } = data;
  const beforeImages = repair.images.filter(img => img.stage === 'before');
  const afterImages = repair.images.filter(img => img.stage === 'after');
  const isInternalRepair = !!repair.damage_log_id;

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="icon"><Link to="/repairs"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Repair Order {repair.repair_number}</h1>
              <p className="text-muted-foreground">Created by {repair.creator_name} on {formatDateSafe(repair.created_at)}</p>
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <PrintControl documentRef={jobCardRef} fileName={`JobCard-${repair.repair_number}`} />
              {repair.status === 'Received' && (
                <Button onClick={() => statusMutation.mutate('In Progress')} disabled={statusMutation.isPending}>
                  <Wrench className="mr-2 h-4 w-4" /> Start Repair
                </Button>
              )}
              {repair.status === 'In Progress' && (
                <>
                  {repair.is_warranty && (
                    <Button variant="outline" onClick={() => setIsVoidWarrantyOpen(true)}>
                      <ShieldOff className="mr-2 h-4 w-4" /> Void Warranty
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={unrepairableMutation.isPending}>
                        <XCircle className="mr-2 h-4 w-4" /> Mark as Unrepairable
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the repair as unrepairable. {isInternalRepair ? "The item will remain in the damaged stock log." : "A corresponding entry will be created in the damaged stock log."} This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => unrepairableMutation.mutate()}>Continue</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  {isInternalRepair ? (
                    <Button onClick={() => repairedMutation.mutate()} disabled={repairedMutation.isPending}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Mark as Repaired
                    </Button>
                  ) : (
                    <Button onClick={() => setIsCompleteOpen(true)}>
                      <CheckCircle className="mr-2 h-4 w-4" /> Complete Repair & Invoice
                    </Button>
                  )}
                </>
              )}
              {repair.status === 'Unrepairable' && !isInternalRepair && (
                <>
                  <Button onClick={() => setIsIssueCreditOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4" /> Issue Credit
                  </Button>
                  <Button onClick={() => setIsReplacementOpen(true)}>
                    <Replace className="mr-2 h-4 w-4" /> Create Replacement
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader><CardTitle>Before Images</CardTitle><CardDescription>Images of the item as it was received.</CardDescription></CardHeader>
              <CardContent><RepairImageUploader repairId={repair.id} stage="before" images={beforeImages} onUploadSuccess={handleUploadSuccess} /></CardContent>
            </Card>
            
            {repair.status !== 'Received' && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle>Spare Parts Used</CardTitle>
                      <CardDescription>Parts from inventory used in this repair.</CardDescription>
                    </div>
                    {canEdit && repair.status === 'In Progress' && (
                      <Button size="sm" onClick={() => setIsAddItemOpen(true)}><PackagePlus className="mr-2 h-4 w-4" /> Add Part</Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader><TableRow><TableHead>Part</TableHead><TableHead>SKU</TableHead><TableHead>Qty</TableHead><TableHead className="text-right">Price</TableHead><TableHead></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {repair.items.length > 0 ? repair.items.map(item => (
                          <TableRow key={item.id}>
                            <TableCell>{item.product_name}</TableCell>
                            <TableCell>{item.product_sku}</TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            <TableCell className="text-right">
                              <Input 
                                type="number" 
                                defaultValue={item.unit_price} 
                                onBlur={(e) => updateItemPriceMutation.mutate({ itemId: item.id, price: parseFloat(e.target.value) || 0 })}
                                className="h-8 w-24 text-right"
                                disabled={!canEdit || repair.status !== 'In Progress'}
                              />
                            </TableCell>
                            <TableCell>
                              {canEdit && repair.status === 'In Progress' && (
                                <Button variant="ghost" size="icon" onClick={() => removeItemMutation.mutate(item.id)}><Trash2 className="h-4 w-4" /></Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )) : <TableRow><TableCell colSpan={5} className="text-center h-24">No spare parts added yet.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>After Images</CardTitle><CardDescription>Images of the item after the repair is complete.</CardDescription></CardHeader>
                  <CardContent><RepairImageUploader repairId={repair.id} stage="after" images={afterImages} onUploadSuccess={handleUploadSuccess} /></CardContent>
                </Card>
              </>
            )}
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle>Repair Details</CardTitle></CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex items-center gap-2"><Wrench className="h-4 w-4 text-muted-foreground" /><span>Status: <Badge>{repair.status}</Badge></span></div>
                <div className="flex items-start gap-2">
                  <User className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div><p>Customer:</p><Link to={`/customers/${repair.customer_id}`} className="font-medium text-primary hover:underline">{repair.customer_name}</Link></div>
                </div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /><span>Date Received: {formatDateSafe(repair.received_date)}</span></div>
                {repair.original_invoice_id && (<div className="flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /><span>Original Receipt: <Link to={`/invoices/${repair.original_invoice_id}`} className="font-medium text-primary hover:underline">View</Link></span></div>)}
                <div className="flex items-center gap-2">
                  <ShieldOff className="h-4 w-4 text-muted-foreground" />
                  <span>Warranty: <Badge variant={repair.is_warranty ? 'default' : 'secondary'}>{repair.is_warranty ? 'Active' : 'Not Active'}</Badge></span>
                </div>
                {repair.warranty_void_reason && (
                  <div className="pt-2 border-t">
                    <p className="font-semibold">Warranty Void Reason:</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{repair.warranty_void_reason}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Reported Problem</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{repair.reported_problem}</p></CardContent>
            </Card>
          </div>
        </div>
      </div>
      <div className="hidden print:block">
        <RepairJobCardTemplate ref={jobCardRef} repair={repair} />
      </div>
      <AddRepairItemDialog isOpen={isAddItemOpen} onOpenChange={setIsAddItemOpen} onAddItem={(productId, quantity) => addItemMutation.mutate({ productId, quantity })} />
      <CompleteRepairDialog isOpen={isCompleteOpen} onOpenChange={setIsCompleteOpen} onConfirm={(values) => completeMutation.mutate(values)} isProcessing={completeMutation.isPending} isWarranty={repair.is_warranty} />
      <CreateReplacementDialog isOpen={isReplacementOpen} onOpenChange={setIsReplacementOpen} onConfirm={(values) => replacementMutation.mutate(values)} isProcessing={replacementMutation.isPending} repair={repair} isWarranty={repair.is_warranty} />
      <VoidWarrantyDialog isOpen={isVoidWarrantyOpen} onOpenChange={setIsVoidWarrantyOpen} onConfirm={voidWarrantyMutation.mutate} isProcessing={voidWarrantyMutation.isPending} />
      <IssueCreditDialog isOpen={isIssueCreditOpen} onOpenChange={setIsIssueCreditOpen} onConfirm={issueCreditMutation.mutate} isProcessing={issueCreditMutation.isPending} />
    </>
  );
};

export default RepairDetails;