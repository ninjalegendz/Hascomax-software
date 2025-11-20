import React from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Package, DollarSign, ShoppingCart, FileText, FileQuestion, Loader2, ShieldX } from 'lucide-react';
import { authenticatedFetch } from '@/lib/api';
import { useCurrency } from '@/hooks/useCurrency';
import { formatDateSafe } from '@/utils/date';
import type { Product, Purchase, Invoice, Quotation, DamagedItem } from '@/types';

interface ProductDetailsData {
  product: Product & { quantity: number };
  purchases: Purchase[];
  sales: Invoice[];
  quotations: Quotation[];
  damages: DamagedItem[];
}

const InventoryItemDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { format } = useCurrency();

  const { data, isLoading, isError } = useQuery<ProductDetailsData>({
    queryKey: ['productDetails', id],
    queryFn: async () => {
        if (!id) throw new Error("No product ID provided");
        const rawData = await authenticatedFetch(`/api/products/${id}/details`);
        
        const formattedSales = rawData.sales.map((s: any) => ({
            ...s,
            invoiceNumber: s.invoice_number,
            customerName: s.customer_name,
            issueDate: s.issue_date,
            dueDate: s.due_date,
            lineItems: JSON.parse(s.line_items),
            createdAt: s.created_at,
        }));

        const formattedQuotations = rawData.quotations.map((q: any) => ({
            ...q,
            line_items: JSON.parse(q.line_items),
        }));

        const formattedDamages = rawData.damages.map((d: any) => ({
            ...d,
            logger_name: d.logger_name,
        }));

        return { ...rawData, sales: formattedSales, quotations: formattedQuotations, damages: formattedDamages };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (isError || !data) {
    return (
      <div className="text-center py-10">
        <h2 className="text-2xl font-bold text-destructive">Error loading product or product not found.</h2>
        <Button asChild variant="link" className="mt-4">
          <Link to="/inventory"><ArrowLeft className="mr-2 h-4 w-4" />Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  const { product, purchases, sales, quotations, damages } = data;
  const stockValue = product.quantity * product.price;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon"><Link to="/inventory"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{product.name}</h1>
          <p className="text-muted-foreground">SKU: {product.sku} {product.barcode && `| Barcode: ${product.barcode}`}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Current Stock</CardTitle><Package className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{product.quantity}</div>
            <p className="text-xs text-muted-foreground">{product.product_type === 'bundle' ? 'available bundles (calculated)' : 'units available'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Selling Price</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(product.price)}</div>
            <p className="text-xs text-muted-foreground">per unit</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Stock Value</CardTitle><DollarSign className="h-4 w-4 text-muted-foreground" /></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{format(stockValue)}</div>
            <p className="text-xs text-muted-foreground">based on selling price</p>
          </CardContent>
        </Card>
      </div>

      {product.product_type === 'bundle' && (
        <Card>
          <CardHeader>
            <CardTitle>Bundle Components</CardTitle>
            <CardDescription>This product is composed of the following items.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity per Bundle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.components?.map(comp => (
                  <TableRow key={comp.sub_product_id}>
                    <TableCell>{comp.sub_product_name}</TableCell>
                    <TableCell>{comp.sub_product_sku}</TableCell>
                    <TableCell className="text-right">{comp.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="purchases">
        <TabsList>
          <TabsTrigger value="purchases"><ShoppingCart className="mr-2 h-4 w-4" />Purchases ({purchases.length})</TabsTrigger>
          <TabsTrigger value="invoices"><FileText className="mr-2 h-4 w-4" />Invoices ({sales.length})</TabsTrigger>
          <TabsTrigger value="quotations"><FileQuestion className="mr-2 h-4 w-4" />Quotations ({quotations.length})</TabsTrigger>
          <TabsTrigger value="damages"><ShieldX className="mr-2 h-4 w-4" />Damages ({damages.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">
          <Card><CardHeader><CardTitle>Purchase History</CardTitle><CardDescription>All recorded purchases for this item.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Qty Ordered</TableHead><TableHead>Qty Received</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Unit Cost</TableHead></TableRow></TableHeader>
                <TableBody>{purchases.map(p => (<TableRow key={p.id}><TableCell>{formatDateSafe(p.purchase_date)}</TableCell><TableCell>{p.quantity_purchased}</TableCell><TableCell>{p.total_received}</TableCell><TableCell><Badge>{p.status}</Badge></TableCell><TableCell className="text-right">{format(p.unit_cost)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="invoices">
          <Card><CardHeader><CardTitle>Invoice History</CardTitle><CardDescription>All invoices and receipts including this item.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>{sales.map(s => (<TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/invoices/${s.id}`)}><TableCell>{s.invoiceNumber}</TableCell><TableCell>{s.customerName}</TableCell><TableCell>{formatDateSafe(s.issueDate)}</TableCell><TableCell><Badge>{s.status}</Badge></TableCell><TableCell className="text-right">{format(s.total)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="quotations">
          <Card><CardHeader><CardTitle>Quotation History</CardTitle><CardDescription>All quotations including this item.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Number</TableHead><TableHead>Customer</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                <TableBody>{quotations.map(q => (<TableRow key={q.id} className="cursor-pointer" onClick={() => navigate(`/quotations/${q.id}`)}><TableCell>{q.quotation_number}</TableCell><TableCell>{q.customer_name}</TableCell><TableCell>{formatDateSafe(q.issue_date)}</TableCell><TableCell><Badge>{q.status}</Badge></TableCell><TableCell className="text-right">{format(q.total)}</TableCell></TableRow>))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="damages">
          <Card>
            <CardHeader><CardTitle>Damage History</CardTitle><CardDescription>All recorded damages for this item.</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Quantity</TableHead><TableHead>Notes</TableHead><TableHead>Reported By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {damages.length > 0 ? damages.map(d => (
                    <TableRow key={d.id}>
                      <TableCell>{formatDateSafe(d.logged_at, "PPP p")}</TableCell>
                      <TableCell>{d.quantity}</TableCell>
                      <TableCell>{d.notes}</TableCell>
                      <TableCell>{d.logger_name}</TableCell>
                    </TableRow>
                  )) : (
                    <TableRow><TableCell colSpan={4} className="text-center h-24">No damages recorded for this item.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default InventoryItemDetails;