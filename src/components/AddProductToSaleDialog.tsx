import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Barcode } from 'lucide-react';
import { showError } from '@/utils/toast';
import { authenticatedFetch } from '@/lib/api';
import type { Product } from '@/types';

type ProductWithQuantity = Product & { quantity: number };

interface AddProductToSaleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddToCart: (product: ProductWithQuantity) => void;
}

export function AddProductToSaleDialog({ isOpen, onOpenChange, onAddToCart }: AddProductToSaleDialogProps) {
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [barcodeSearch, setBarcodeSearch] = useState('');

  const { data: products, isLoading } = useQuery<ProductWithQuantity[]>({
    queryKey: ['products-for-sale'],
    queryFn: () => authenticatedFetch('/api/products-for-sale'),
    enabled: isOpen, // Only fetch when the dialog is open
  });

  const handleBarcodeAdd = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!barcodeSearch || !products) return;
    const product = products.find(p => p.barcode === barcodeSearch);
    if (product) {
      onAddToCart(product);
      setBarcodeSearch('');
    } else {
      showError("Product with this barcode not found.");
    }
  };

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearchTerm.toLowerCase())
  ) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Product to Sale</DialogTitle>
          <DialogDescription>Search for a product to add to the current sale.</DialogDescription>
        </DialogHeader>
        <div className="py-4 flex flex-col gap-4 flex-1 min-h-0">
          <form onSubmit={handleBarcodeAdd} className="flex gap-2">
            <div className="relative flex-grow">
              <Barcode className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Scan or enter barcode..." 
                value={barcodeSearch} 
                onChange={(e) => setBarcodeSearch(e.target.value)} 
                className="pl-8" 
              />
            </div>
            <Button type="submit">Add</Button>
          </form>
          <Input 
            placeholder="Search products by name or SKU..." 
            value={productSearchTerm} 
            onChange={(e) => setProductSearchTerm(e.target.value)} 
          />
          <div className="border rounded-md overflow-hidden">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredProducts.map(product => (
                    <TableRow key={product.id}>
                      <TableCell>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-muted-foreground">${product.price.toFixed(2)}</p>
                      </TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => onAddToCart(product)} disabled={product.quantity <= 0}>
                          Add to Cart
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}