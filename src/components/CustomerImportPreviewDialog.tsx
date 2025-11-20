import React, { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, XCircle, AlertTriangle, Trash2, GitMerge } from 'lucide-react';
import { customerSchema } from '@/types/schemas';
import { cn } from '@/lib/utils';
import { showError, showSuccess } from '@/utils/toast';
import { useUpdateCustomer } from '@/hooks/useCustomerData';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { authenticatedFetch } from '@/lib/api';
import { BulkMergeDialog } from './BulkMergeDialog';
import type { Customer } from '@/types';

const EXPECTED_HEADERS = ['name', 'email', 'phone', 'secondaryPhone', 'address', 'status', 'openingBalance', 'balanceType'];

type ValidationStatus = 'valid' | 'invalid' | 'duplicate' | 'merged';
export interface ValidationResult {
  id: string; // For stable keys
  data: any;
  status: ValidationStatus;
  errors: Record<string, string>; // field -> error message
  existingCustomerId?: string;
}

interface CustomerImportPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialRows: any[];
  onConfirmImport: (customers: any[]) => void;
}

export function CustomerImportPreviewDialog({
  isOpen,
  onOpenChange,
  initialRows,
  onConfirmImport,
}: CustomerImportPreviewDialogProps) {
  const [rows, setRows] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'valid' | 'issues'>('all');
  const [existingData, setExistingData] = useState<{ id: string, email: string, phone: string, secondary_phone: string }[]>([]);
  const [isMergingInFile, setIsMergingInFile] = useState(false);
  const [rowsToMergeInFile, setRowsToMergeInFile] = useState<Customer[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const updateCustomerMutation = useUpdateCustomer();

  useEffect(() => {
    if (isOpen) {
      const fetchExisting = async () => {
        try {
          const data = await authenticatedFetch('/api/customers/check-uniqueness');
          setExistingData(data);
        } catch (error) {
          showError("Could not fetch existing customer data for validation.");
        }
      };
      fetchExisting();
    } else {
      setSelectedRowIds([]);
    }
  }, [isOpen]);

  const validateRow = (rowData: any): Omit<ValidationResult, 'id' | 'data'> => {
    const validation = customerSchema.safeParse(rowData);
    let status: ValidationStatus = 'valid';
    const errors: Record<string, string> = {};
    let existingCustomerId: string | undefined;

    if (!validation.success) {
      status = 'invalid';
      validation.error.errors.forEach(e => {
        const path = e.path.join('.');
        if (path) errors[path] = e.message;
      });
    } else {
      const { email, phone } = validation.data;
      const existingByEmail = existingData.find(c => c.email && c.email === email);
      if (existingByEmail) {
        status = 'duplicate';
        errors['email'] = 'Email already exists in the system.';
        existingCustomerId = existingByEmail.id;
      }
      const existingByPhone = existingData.find(c => c.phone === phone || c.secondary_phone === phone);
      if (existingByPhone) {
        status = 'duplicate';
        errors['phone'] = 'Phone number already exists in the system.';
        existingCustomerId = existingByPhone.id;
      }
    }
    return { status, errors, existingCustomerId };
  };

  const revalidateAllRows = (currentRows: ValidationResult[]) => {
    const seenInFile = new Map<string, string>(); // key -> rowId
    return currentRows.map(row => {
      const validation = validateRow(row.data);
      let newRow = { ...row, ...validation };

      if (newRow.status === 'valid') {
        const { email, phone } = newRow.data;
        if (email) {
          if (seenInFile.has(`email:${email}`)) {
            newRow.status = 'duplicate';
            newRow.errors['email'] = 'Email is duplicated within this file.';
          } else {
            seenInFile.set(`email:${email}`, newRow.id);
          }
        }
        if (phone && !newRow.errors.phone) {
          if (seenInFile.has(`phone:${phone}`)) {
            newRow.status = 'duplicate';
            newRow.errors['phone'] = 'Phone is duplicated within this file.';
          } else {
            seenInFile.set(`phone:${phone}`, newRow.id);
          }
        }
      }
      return newRow;
    });
  };

  useEffect(() => {
    if (isOpen && existingData.length > 0) {
      const initialValidation = initialRows.map(row => ({
        id: crypto.randomUUID(),
        data: row,
        ...validateRow(row),
      }));
      setRows(revalidateAllRows(initialValidation));
    }
  }, [isOpen, initialRows, existingData]);

  const handleCellChange = (rowId: string, field: string, value: any) => {
    setRows(currentRows =>
      currentRows.map(row =>
        row.id === rowId
          ? { ...row, data: { ...row.data, [field]: value } }
          : row
      )
    );
  };

  const handleCellBlur = () => {
    setRows(revalidateAllRows(rows));
  };

  const handleDeleteRow = (rowId: string) => {
    const newRows = rows.filter(r => r.id !== rowId);
    setRows(revalidateAllRows(newRows));
  };

  const handleBulkDelete = () => {
    const newRows = rows.filter(r => !selectedRowIds.includes(r.id));
    setRows(revalidateAllRows(newRows));
    setSelectedRowIds([]);
  };

  const handleMerge = (row: ValidationResult) => {
    if (!row.existingCustomerId) return;
    const values = customerSchema.parse(row.data);
    updateCustomerMutation.mutate({ id: row.existingCustomerId, values }, {
      onSuccess: () => {
        showSuccess(`Merged data for ${values.name}.`);
        setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'merged', errors: {} } : r));
      }
    });
  };

  const handleInFileMergeClick = (row: ValidationResult) => {
    const { email, phone } = row.data;
    const duplicateGroup = rows.filter(r => 
        r.status === 'duplicate' && 
        !r.existingCustomerId &&
        ( (email && r.data.email === email) || (phone && r.data.phone === phone) )
    );
    const customersToMergeForDialog: Customer[] = duplicateGroup.map(r => ({
        id: r.id,
        user_id: '',
        name: r.data.name || '',
        customerNumber: 'N/A',
        phone: r.data.phone || '',
        email: r.data.email || '',
        address: r.data.address || '',
        status: r.data.status || 'Active',
        balance: 0,
        createdAt: new Date().toISOString(),
    }));
    setRowsToMergeInFile(customersToMergeForDialog);
    setIsMergingInFile(true);
  };

  const handleBulkMergeClick = () => {
    const selectedRows = rows.filter(r => selectedRowIds.includes(r.id));
    const customersToMergeForDialog: Customer[] = selectedRows.map(r => ({
        id: r.id,
        user_id: '',
        name: r.data.name || '',
        customerNumber: 'N/A',
        phone: r.data.phone || '',
        email: r.data.email || '',
        address: r.data.address || '',
        status: r.data.status || 'Active',
        balance: 0,
        createdAt: new Date().toISOString(),
    }));
    setRowsToMergeInFile(customersToMergeForDialog);
    setIsMergingInFile(true);
  };

  const handleConfirmInFileMerge = (destinationId: string, sourceIds: string[]) => {
    const newRows = rows.filter(r => !sourceIds.includes(r.id));
    setRows(revalidateAllRows(newRows));
    setIsMergingInFile(false);
    setSelectedRowIds([]);
    showSuccess("Duplicates merged in preview.");
  };

  const summary = useMemo(() => {
    return rows.reduce((acc, result) => {
      acc[result.status]++;
      return acc;
    }, { valid: 0, invalid: 0, duplicate: 0, merged: 0 });
  }, [rows]);

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'valid':
        return rows.filter(row => row.status === 'valid');
      case 'issues':
        return rows.filter(row => row.status === 'invalid' || row.status === 'duplicate');
      case 'all':
      default:
        return rows;
    }
  }, [rows, filter]);

  const canBulkMerge = useMemo(() => {
    if (selectedRowIds.length < 2) return false;
    const selectedRows = rows.filter(r => selectedRowIds.includes(r.id));
    if (selectedRows.some(r => r.status !== 'duplicate' || r.existingCustomerId)) {
      return false;
    }
    const firstRow = selectedRows[0];
    const { email, phone } = firstRow.data;
    return selectedRows.every(r => 
      (email && r.data.email === email) || (phone && r.data.phone === phone)
    );
  }, [selectedRowIds, rows]);

  const handleFinalImport = () => {
    const customersToImport = rows
      .filter(r => r.status === 'valid')
      .map(r => customerSchema.parse(r.data));

    if (customersToImport.length === 0) {
      showError("There are no valid customers to import.");
      return;
    }
    
    onConfirmImport(customersToImport);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review and edit your data before importing. Invalid rows cannot be imported. Duplicates can be merged.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button size="sm" variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>All ({rows.length})</Button>
                <Button size="sm" variant={filter === 'valid' ? 'secondary' : 'ghost'} onClick={() => setFilter('valid')}>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
                  Ready ({summary.valid})
                </Button>
                <Button size="sm" variant={filter === 'issues' ? 'secondary' : 'ghost'} onClick={() => setFilter('issues')}>
                  <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" />
                  Issues ({summary.invalid + summary.duplicate})
                </Button>
              </div>
            </div>
            {selectedRowIds.length > 0 && (
              <div className="flex items-center gap-4 bg-muted/50 p-2 rounded-md">
                <p className="text-sm font-medium">{selectedRowIds.length} selected</p>
                <Button variant="destructive" size="sm" onClick={handleBulkDelete}>Delete Selected</Button>
                <Button variant="outline" size="sm" onClick={handleBulkMergeClick} disabled={!canBulkMerge}>Merge Selected</Button>
              </div>
            )}
            <div className="max-h-[60vh] overflow-auto border rounded-md">
              <TooltipProvider>
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-9">
                        <Checkbox
                          checked={filteredRows.length > 0 && filteredRows.every(row => selectedRowIds.includes(row.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedRowIds(prev => [...new Set([...prev, ...filteredRows.map(r => r.id)])]);
                            } else {
                              const filteredIds = new Set(filteredRows.map(r => r.id));
                              setSelectedRowIds(prev => prev.filter(id => !filteredIds.has(id)));
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="w-12">Status</TableHead>
                      {EXPECTED_HEADERS.map(header => <TableHead key={header}>{header}</TableHead>)}
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedRowIds.includes(row.id)}
                            onCheckedChange={(checked) => {
                              setSelectedRowIds(prev => 
                                checked ? [...prev, row.id] : prev.filter(id => id !== row.id)
                              );
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger>
                              {row.status === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                              {row.status === 'duplicate' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                              {row.status === 'invalid' && <XCircle className="h-5 w-5 text-red-500" />}
                              {row.status === 'merged' && <GitMerge className="h-5 w-5 text-blue-500" />}
                            </TooltipTrigger>
                            <TooltipContent>
                              {Object.keys(row.errors).length > 0 ? 
                                <ul>{Object.entries(row.errors).map(([field, msg]) => <li key={field}><strong>{field}:</strong> {msg}</li>)}</ul> : 
                                <p className="capitalize">{row.status}</p>
                              }
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        {EXPECTED_HEADERS.map(header => {
                          const hasError = row.errors[header];
                          return (
                            <TableCell key={header}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Input
                                    value={row.data[header] || ''}
                                    onChange={(e) => handleCellChange(row.id, header, e.target.value)}
                                    onBlur={handleCellBlur}
                                    className={cn(
                                      hasError && row.status === 'invalid' && 'bg-red-500/10 border-red-500/50 focus-visible:ring-red-500',
                                      hasError && row.status === 'duplicate' && 'bg-yellow-500/10 border-yellow-500/50 focus-visible:ring-yellow-500'
                                    )}
                                    disabled={row.status === 'merged'}
                                  />
                                </TooltipTrigger>
                                {hasError && <TooltipContent>{row.errors[header]}</TooltipContent>}
                              </Tooltip>
                            </TableCell>
                          );
                        })}
                        <TableCell>
                          {row.status === 'duplicate' && row.existingCustomerId ? (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><GitMerge className="h-4 w-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm Merge</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will update the existing customer's record with the data from this row. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleMerge(row)}>Merge</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : row.status === 'duplicate' && !row.existingCustomerId ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={() => handleInFileMergeClick(row)}>
                                  <GitMerge className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Duplicate within file. Click to merge rows.</p></TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteRow(row.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
            <Button onClick={handleFinalImport} disabled={summary.invalid > 0 || summary.valid === 0}>
              Import {summary.valid} Customers
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BulkMergeDialog
        isOpen={isMergingInFile}
        onOpenChange={setIsMergingInFile}
        customers={rowsToMergeInFile}
        onConfirmMerge={handleConfirmInFileMerge}
        isMerging={false}
      />
    </>
  );
}