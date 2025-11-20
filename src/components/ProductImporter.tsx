import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { ProductImportPreviewDialog } from './ProductImportPreviewDialog';
import type { StagedProduct } from '@/types/schemas';

interface ProductImporterProps {
  onImport: (products: StagedProduct[]) => void;
}

export function ProductImporter({ onImport }: ProductImporterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: header => header.trim(),
      complete: (results) => {
        setParsedData(results.data);
        setIsPreviewOpen(true);
        setIsLoading(false);
      },
      error: (error) => {
        showError(`Error parsing CSV: ${error.message}`);
        setIsLoading(false);
      }
    });
  };
  
  const generateSampleCsv = () => {
    const sampleData = [
        { name: 'Sample Widget', sku: 'SW-001', price: 19.99, barcode: '123456789012', description: 'A sample widget for demonstration.', invoice_description: '1x Super Widget', category: 'Widgets', unit: 'pcs', startingStock: 100, startingCost: 10.50, weight: 0.5, warranty_period_days: 365, warranty_period_unit: 'Days' },
        { name: 'Another Gadget', sku: 'AG-002', price: 49.99, barcode: '', description: '', invoice_description: '', category: 'Gadgets', unit: '', startingStock: 50, startingCost: 25.00, weight: 1.2, warranty_period_days: 1, warranty_period_unit: 'Years' },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'sample_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Products</DialogTitle>
        <DialogDescription>
          Upload a CSV file to begin the import process.
        </DialogDescription>
      </DialogHeader>
      <div className="py-8 flex flex-col items-center justify-center gap-4">
        {isLoading ? (
          <Loader2 className="h-8 w-8 animate-spin" />
        ) : (
          <>
            <Input id="csv-upload" type="file" accept=".csv" onChange={handleFileUpload} className="max-w-sm" />
            <Button variant="link" onClick={generateSampleCsv}>Download Sample CSV</Button>
          </>
        )}
      </div>
      <DialogFooter>
        <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
      </DialogFooter>

      <ProductImportPreviewDialog
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        initialRows={parsedData}
        onConfirmImport={onImport}
      />
    </>
  );
}