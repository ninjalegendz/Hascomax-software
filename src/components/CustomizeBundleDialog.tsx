import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';
import { Trash2, PlusCircle } from 'lucide-react';
import type { Product } from '@/types';
import { Input } from './ui/input';

export type BundleComponent = {
  sub_product_id: string;
  sub_product_name: string;
  sub_product_sku: string;
  quantity: number;
};

export type CartItemForBundle = {
  productId: string;
  name: string;
  components?: BundleComponent[];
};

interface CustomizeBundleDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  cartItem: CartItemForBundle | null;
  onSave: (updatedComponents: BundleComponent[]) => void;
  standardProducts: Product[];
}

export function CustomizeBundleDialog({ isOpen, onOpenChange, cartItem, onSave, standardProducts }: CustomizeBundleDialogProps) {
  const [components, setComponents] = useState<BundleComponent[]>([]);
  const [newComponentId, setNewComponentId] = useState<string>('');

  useEffect(() => {
    if (isOpen && cartItem?.components) {
      setComponents([...cartItem.components]);
    } else {
      setComponents([]);
      setNewComponentId('');
    }
  }, [isOpen, cartItem]);

  const updateComponentQuantity = (sub_product_id: string, quantity: number) => {
    setComponents(prev => prev.map(c => 
      c.sub_product_id === sub_product_id 
        ? { ...c, quantity: Math.max(1, quantity) } 
        : c
    ));
  };

  const removeComponent = (sub_product_id: string) => {
    setComponents(prev => prev.filter(c => c.sub_product_id !== sub_product_id));
  };

  const addComponent = (productId: string) => {
    if (!productId || components.some(c => c.sub_product_id === productId)) return;

    const productToAdd = standardProducts.find(p => p.id === productId);
    if (!productToAdd) return;

    setComponents(prev => [...prev, {
      sub_product_id: productToAdd.id,
      sub_product_name: productToAdd.name,
      sub_product_sku: productToAdd.sku || 'N/A',
      quantity: 1,
    }]);
    setNewComponentId('');
  };

  const handleSave = () => {
    onSave(components);
    onOpenChange(false);
  };

  const productOptions = standardProducts
    .filter(p => !components.some(c => c.sub_product_id === p.id))
    .map(p => ({ value: p.id, label: `${p.name} (${p.sku})` }));

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Customize Bundle: {cartItem?.name}</DialogTitle>
          <DialogDescription>Add, remove, or change quantities of components for this specific sale.</DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead className="w-24">Quantity</TableHead>
                <TableHead className="w-16">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map(comp => (
                <TableRow key={comp.sub_product_id}>
                  <TableCell>
                    <p className="font-medium">{comp.sub_product_name}</p>
                    <p className="text-sm text-muted-foreground">{comp.sub_product_sku}</p>
                  </TableCell>
                  <TableCell>
                    <Input 
                      type="number" 
                      value={comp.quantity} 
                      onChange={(e) => updateComponentQuantity(comp.sub_product_id, parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeComponent(comp.sub_product_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center gap-2 pt-4 border-t">
            <div className="flex-1">
              <Combobox
                options={productOptions}
                value={newComponentId}
                onChange={setNewComponentId}
                placeholder="Select a product to add..."
                searchPlaceholder="Search products..."
              />
            </div>
            <Button onClick={() => addComponent(newComponentId)} disabled={!newComponentId}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}