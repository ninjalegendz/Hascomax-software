import React, { useState } from 'react';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { showError } from '@/utils/toast';
import { CustomerImportPreviewDialog } from './CustomerImportPreviewDialog';
import type { StagedCustomer } from '@/types/schemas';

interface CustomerImporterProps {
  onImport: (customers: StagedCustomer[]) => void;
}

export function CustomerImporter({ onImport }: CustomerImporterProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [parsedData, setParsedData] = useState<any[]>([]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);

    try {
      Papa.parse<any>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false, // Ensure all values are treated as strings
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
    } catch (error) {
      showError((error as Error).message);
      setIsLoading(false);
    }
  };
  
  const generateSampleCsv = () => {
    const sampleData = [
        { name: 'Jane Doe', email: 'jane@example.com', phone: '555-123-4567', secondaryPhone: '', address: '456 Oak Ave, Sometown', status: 'Active', openingBalance: 100, balanceType: 'credit' },
        { name: 'John Smith', email: 'john@example.com', phone: '555-987-6543', secondaryPhone: '555-555-5555', address: '789 Pine Ln, Anotherville', status: 'Inactive', openingBalance: 50, balanceType: 'debit' },
    ];
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', 'sample_customers.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import Customers</DialogTitle>
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

      <CustomerImportPreviewDialog
        isOpen={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        initialRows={parsedData}
        onConfirmImport={onImport}
      />
    </>
  );
}