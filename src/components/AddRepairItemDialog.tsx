import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import type { Product } from '@/types';
import { Label } from '@/components/ui/label';

type ProductWithQuantity = Product & { quantity: number };

interface AddRepairItemDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddItem: (productId: string, quantity: number) => void;
}

export function AddRepairItemDialog({ isOpen, onOpenChange, onAddItem }: AddRepairItemDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<ProductWithQuantity | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { data: products, isLoading } = useQuery<ProductWithQuantity[]>({
    queryKey: ['products-for-sale'],
    queryFn: () => authenticatedFetch('/api/products-for-sale'),
    enabled: isOpen,
  });

  const filteredProducts = products?.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleAdd = () => {
    if (selectedProduct) {
      onAddItem(selectedProduct.id, quantity);
      onOpenChange(false);
      setSelectedProduct(null);
      setQuantity(1);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Part to Repair</DialogTitle>
          <DialogDescription>Search for a product to add as a spare part.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Input 
            placeholder="Search products by name or SKU..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          <div className="border rounded-md">
            <ScrollArea className="h-[300px]">
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
                    <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                  ) : filteredProducts.map(product => (
                    <TableRow 
                      key={product.id} 
                      onClick={() => setSelectedProduct(product)}
                      className={selectedProduct?.id === product.id ? 'bg-muted' : 'cursor-pointer'}
                    >
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.quantity}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={product.quantity <= 0}>Select</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
          {selectedProduct && (
            <div className="flex items-center gap-4 p-4 border rounded-md">
              <p className="font-medium flex-1">Selected: {selectedProduct.name}</p>
              <div className="flex items-center gap-2">
                <Label htmlFor="quantity">Quantity:</Label>
                <Input 
                  id="quantity"
                  type="number" 
                  value={quantity} 
                  onChange={(e) => setQuantity(Math.max(1, Math.min(parseInt(e.target.value) || 1, selectedProduct.quantity)))}
                  className="w-20"
                  max={selectedProduct.quantity}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAdd} disabled={!selectedProduct || quantity <= 0}>Add to Repair</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}