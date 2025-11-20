import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import type { Product } from '@/types';
import { useCurrency } from '@/hooks/useCurrency';

type ProductWithQuantity = Product & { quantity: number };

interface InventoryCardProps {
  product: ProductWithQuantity;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onNavigate: (id: string) => void;
}

export function InventoryCard({ product, onEdit, onDelete, onNavigate }: InventoryCardProps) {
  const { format } = useCurrency();
  const getStockStatus = (quantity: number) => {
    if (quantity <= 0) return { text: "Out of Stock", variant: "destructive" as const };
    if (quantity <= 10) return { text: "Low Stock", variant: "secondary" as const };
    return { text: "In Stock", variant: "default" as const };
  };
  const status = getStockStatus(product.quantity);

  return (
    <Card onClick={() => onNavigate(product.id)} className="cursor-pointer">
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-base font-medium">{product.name}</CardTitle>
          <p className="text-sm text-muted-foreground">{product.sku}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onEdit(product)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(product)} className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mt-4">
          <Badge variant={status.variant}>{status.text} ({product.quantity})</Badge>
          <div className="font-medium">{format(product.price)}</div>
        </div>
      </CardContent>
    </Card>
  );
}