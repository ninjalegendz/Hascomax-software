import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { productImportSchema } from '@/types/schemas';
import { cn } from '@/lib/utils';
import { showError } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';

const EXPECTED_HEADERS = ['name', 'sku', 'price', 'barcode', 'description', 'invoice_description', 'category', 'unit', 'startingStock', 'startingCost', 'weight', 'warranty_period_days', 'warranty_period_unit'];

type ValidationStatus = 'valid' | 'invalid' | 'duplicate';
interface ValidationResult {
  id: string;
  data: any;
  status: ValidationStatus;
  errors: Record<string, string>;
}

interface ProductImportPreviewDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialRows: any[];
  onConfirmImport: (products: any[]) => void;
}

export function ProductImportPreviewDialog({
  isOpen,
  onOpenChange,
  initialRows,
  onConfirmImport,
}: ProductImportPreviewDialogProps) {
  const [rows, setRows] = useState<ValidationResult[]>([]);
  const [filter, setFilter] = useState<'all' | 'valid' | 'issues'>('all');
  const [existingSkus, setExistingSkus] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      const fetchExisting = async () => {
        try {
          const data = await authenticatedFetch('/api/products/check-uniqueness');
          setExistingSkus(data.map((p: any) => p.sku.toUpperCase()));
        } catch (error) {
          showError("Could not fetch existing product data for validation.");
        }
      };
      fetchExisting();
    }
  }, [isOpen]);

  const validateRow = (rowData: any): Omit<ValidationResult, 'id' | 'data'> => {
    const validation = productImportSchema.safeParse(rowData);
    let status: ValidationStatus = 'valid';
    const errors: Record<string, string> = {};

    if (!validation.success) {
      status = 'invalid';
      validation.error.errors.forEach(e => {
        const path = e.path.join('.');
        if (path) errors[path] = e.message;
      });
    } else {
      const { sku } = validation.data;
      if (existingSkus.includes(sku.toUpperCase())) {
        status = 'duplicate';
        errors['sku'] = 'SKU already exists in the system.';
      }
    }
    return { status, errors };
  };

  const revalidateAllRows = (currentRows: ValidationResult[]) => {
    const seenSkus = new Set<string>();
    return currentRows.map(row => {
      const validation = validateRow(row.data);
      let newRow = { ...row, ...validation };

      if (newRow.status === 'valid') {
        const { sku } = newRow.data;
        if (sku) {
          const upperSku = sku.toUpperCase();
          if (seenSkus.has(upperSku)) {
            newRow.status = 'duplicate';
            newRow.errors['sku'] = 'SKU is duplicated within this file.';
          } else {
            seenSkus.add(upperSku);
          }
        }
      }
      return newRow;
    });
  };

  useEffect(() => {
    if (isOpen && existingSkus.length > 0) {
      const initialValidation = initialRows.map(row => ({
        id: crypto.randomUUID(),
        data: row,
        ...validateRow(row),
      }));
      setRows(revalidateAllRows(initialValidation));
    }
  }, [isOpen, initialRows, existingSkus]);

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

  const summary = useMemo(() => {
    return rows.reduce((acc, result) => {
      acc[result.status]++;
      return acc;
    }, { valid: 0, invalid: 0, duplicate: 0 });
  }, [rows]);

  const filteredRows = useMemo(() => {
    switch (filter) {
      case 'valid': return rows.filter(row => row.status === 'valid');
      case 'issues': return rows.filter(row => row.status === 'invalid' || row.status === 'duplicate');
      default: return rows;
    }
  }, [rows, filter]);

  const handleFinalImport = () => {
    const productsToImport = rows
      .filter(r => r.status === 'valid')
      .map(r => productImportSchema.parse(r.data));

    if (productsToImport.length === 0) {
      showError("There are no valid products to import.");
      return;
    }
    
    onConfirmImport(productsToImport);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>Import Preview</DialogTitle>
          <DialogDescription>Review and edit your data before importing.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="flex items-center gap-2">
            <Button size="sm" variant={filter === 'all' ? 'secondary' : 'ghost'} onClick={() => setFilter('all')}>All ({rows.length})</Button>
            <Button size="sm" variant={filter === 'valid' ? 'secondary' : 'ghost'} onClick={() => setFilter('valid')}>
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Ready ({summary.valid})
            </Button>
            <Button size="sm" variant={filter === 'issues' ? 'secondary' : 'ghost'} onClick={() => setFilter('issues')}>
              <AlertTriangle className="h-4 w-4 mr-2 text-yellow-500" /> Issues ({summary.invalid + summary.duplicate})
            </Button>
          </div>
          <div className="max-h-[60vh] overflow-auto border rounded-md">
            <TooltipProvider>
              <Table className="min-w-[1600px]">
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="w-12">Status</TableHead>
                    {EXPECTED_HEADERS.map(header => <TableHead key={header}>{header}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            {row.status === 'valid' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                            {row.status === 'duplicate' && <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                            {row.status === 'invalid' && <XCircle className="h-5 w-5 text-red-500" />}
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
                                />
                              </TooltipTrigger>
                              {hasError && <TooltipContent>{row.errors[header]}</TooltipContent>}
                            </Tooltip>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
          <Button onClick={handleFinalImport} disabled={summary.valid === 0}>
            Import {summary.valid} Products
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}