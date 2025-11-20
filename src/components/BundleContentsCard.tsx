import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { LineItem } from '@/types';

interface BundleContentsCardProps {
  lineItems: LineItem[];
}

export function BundleContentsCard({ lineItems }: BundleContentsCardProps) {
  const customizedBundles = lineItems.filter(item => item.isBundle && item.components);

  if (customizedBundles.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customized Bundle Contents</CardTitle>
        <CardDescription>
          The following bundles had their default components swapped for this transaction.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {customizedBundles.map((bundle, index) => (
          <div key={bundle.id || index}>
            <h4 className="font-semibold">{bundle.description}</h4>
            <div className="border rounded-md mt-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Component</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bundle.components?.map((comp) => (
                    <TableRow key={comp.sub_product_id}>
                      <TableCell>{comp.sub_product_name}</TableCell>
                      <TableCell>{comp.sub_product_sku}</TableCell>
                      <TableCell className="text-right">{comp.quantity * bundle.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}